import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parentProjectsAPI, type ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { projectTrackingAPI, type ProjectTracking } from "@/integrations/firebase/projectTrackingAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { realtimeParentProjectsAPI, realtimeProjectTrackingAPI } from "@/integrations/firebase/realtimeAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, FolderOpen, MapPin, Trash2, Pencil, Search, X, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100, "Name too long"),
  description: z.string().trim().max(500, "Description too long").optional(),
  projectType: z.enum(["ISSM", "Obsidian"]).default("ISSM"),
});

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<"ISSM" | "Obsidian">("ISSM");
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ISSM" | "Obsidian">("ISSM");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Real-time subscriptions
  const [allProjects, setAllProjects] = useState<ParentProject[]>([]);
  const [allSites, setAllSites] = useState<ProjectTracking[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectsUnsubRef = useRef<(() => void) | null>(null);
  const sitesUnsubRef = useRef<(() => void) | null>(null);
  const usersUnsubRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let loadedCount = 0;
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === 3 && isMountedRef.current) setIsLoading(false);
    };

    // Subscribe to projects
    projectsUnsubRef.current = realtimeParentProjectsAPI.subscribeAll(
      (projs) => {
        if (isMountedRef.current) {
          setAllProjects(projs);
          checkComplete();
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load projects:", error);
          checkComplete();
        }
      }
    );

    // Subscribe to sites
    sitesUnsubRef.current = realtimeProjectTrackingAPI.subscribeAll(
      (sites) => {
        if (isMountedRef.current) {
          setAllSites(sites);
          checkComplete();
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load sites:", error);
          checkComplete();
        }
      }
    );

    // Subscribe to users
    usersUnsubRef.current = usersAPI.subscribeAll(
      (users) => {
        if (isMountedRef.current) {
          setAllUsers(users);
          checkComplete();
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load users:", error);
          checkComplete();
        }
      }
    );

    return () => {
      // Cleanup subscriptions
      projectsUnsubRef.current?.();
      sitesUnsubRef.current?.();
      usersUnsubRef.current?.();
    };
  }, []);

  const siteCountByProjectId = useMemo(() => {
    const counts = new Map<string, number>();

    allSites.forEach((site) => {
      if (!site.project_id) return;
      counts.set(site.project_id, (counts.get(site.project_id) || 0) + 1);
    });

    return counts;
  }, [allSites]);

  // Compute projects with counts
  const projects = useMemo(
    () =>
      allProjects.map((proj) => ({
        ...proj,
        site_count: siteCountByProjectId.get(proj.id) || 0,
      })),
    [allProjects, siteCountByProjectId]
  );

  // Get accessible projects for current user
  const userAccessibleProjects = useMemo(
    () =>
      projects.filter((project) => {
        const roleMatch = isAdmin || (project.assignedUsers || []).includes(appUser?.id || "");
        return roleMatch;
      }),
    [projects, isAdmin, appUser?.id]
  );

  // Get available tabs based on user's accessible projects
  // For admins, always show both tabs so they can create projects in empty tabs
  const availableTabs = useMemo(() => {
    if (isAdmin) {
      return ["ISSM", "Obsidian"];
    }

    const tabs = new Set<"ISSM" | "Obsidian">();
    userAccessibleProjects.forEach((project) => {
      const projectType = (project as any).projectType || "ISSM";
      tabs.add(projectType as "ISSM" | "Obsidian");
    });
    return Array.from(tabs).sort();
  }, [userAccessibleProjects, isAdmin]);

  // Update active tab if current tab is not available (only on first load or when tabs change)
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] as "ISSM" | "Obsidian");
    }
  }, [availableTabs]);

  // Filter projects based on user role, search term, and active tab
  const visibleProjects = useMemo(
    () =>
      projects.filter((project) => {
        // Tab-based filtering
        const projectType = (project as any).projectType || "ISSM";
        if (projectType !== activeTab) return false;

        // Role-based filtering
        const roleMatch = isAdmin || (project.assignedUsers || []).includes(appUser?.id || "");
        if (!roleMatch) return false;

        // Search-based filtering
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          project.name.toLowerCase().includes(searchLower) ||
          (project.description || "").toLowerCase().includes(searchLower)
        );
      }),
    [projects, searchTerm, activeTab, isAdmin, appUser?.id]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = projectSchema.parse({ name, description, projectType });

      if (editId) {
        // For updates, upload icon if a new file was selected
        let iconUrl = iconPreview || undefined;
        if (selectedIconFile) {
          iconUrl = await uploadProjectIcon(editId);
        }

        await parentProjectsAPI.update(editId, {
          name: parsed.name,
          ...(parsed.description ? { description: parsed.description } : {}),
          projectType: parsed.projectType,
          ...(iconUrl ? { projectIconUrl: iconUrl } : {}),
          ...(isAdmin ? { assignedUsers } : {}),
        });
      } else {
        // First, create the project without icon
        const result = await parentProjectsAPI.create({
          name: parsed.name,
          ...(parsed.description ? { description: parsed.description } : {}),
          projectType: parsed.projectType,
          assignedUsers: isAdmin ? assignedUsers : [],
        });

        // Then upload icon if selected and update the project with icon URL
        if (selectedIconFile && result.id) {
          try {
            const iconUrl = await uploadProjectIcon(result.id);
            await parentProjectsAPI.update(result.id, {
              projectIconUrl: iconUrl,
            });
          } catch (error) {
            console.error("Error uploading project icon:", error);
          }
        }
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["parent-projects"] });
      toast.success(editId ? "Project updated" : "Project created");
      closeDialog();
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error(`Failed to save project: ${err.message || "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await parentProjectsAPI.delete(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-projects"] });
      toast.success("Project deleted");
      setDeleteConfirmOpen(false);
      setProjectToDelete(null);
    },
    onError: (err: any) => toast.error(`Failed to delete: ${err.message || "Unknown error"}`),
  });

  const handleDeleteClick = (project: any) => {
    setProjectToDelete(project);
    setDeleteConfirmOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setName("");
    setDescription("");
    setProjectType(activeTab);
    setAssignedUsers([]);
    setSelectedIconFile(null);
    setIconPreview("");
  };

  const handleEditClick = (project: ParentProject) => {
    setEditId(project.id || null);
    setName(project.name);
    setDescription(project.description || "");
    setProjectType((project as any).projectType || "ISSM");
    setAssignedUsers(project.assignedUsers || []);
    setIconPreview(project.projectIconUrl || "");
    setSelectedIconFile(null);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditId(null);
    setName("");
    setDescription("");
    setProjectType(activeTab);
    setAssignedUsers([]);
    setSelectedIconFile(null);
    setIconPreview("");
    setDialogOpen(true);
  };

  const toggleUserAssignment = (userId: string) => {
    setAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file for the icon");
      return;
    }

    setSelectedIconFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIconPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProjectIcon = async (projectId: string): Promise<string | null> => {
    if (!selectedIconFile) return null;

    try {
      setUploadingIcon(true);
      const filePath = `projects/${projectId}/icon_${Date.now()}_${selectedIconFile.name}`;

      const { data, error } = await supabase.storage
        .from("company-logos")
        .upload(filePath, selectedIconFile, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      setSelectedIconFile(null);
      setIconPreview("");
      return urlData.publicUrl;
    } catch (error: any) {
      toast.error("Failed to upload icon");
      throw error;
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleRemoveIcon = () => {
    setSelectedIconFile(null);
    setIconPreview("");
    toast.success("Icon removed");
  };

  return (
    <div className="space-y-6 pb-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="border border-white/25 bg-white/15 text-white hover:bg-white/15">
                  Projects Tracking
                </Badge>
              </div>

              <div>
                <h1 className="text-3xl font-bold md:text-4xl">Projects Tracking</h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">
                  Manage and track all your projects and sites
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:min-w-[220px] lg:flex-col">
              {isAdmin && (
                <Button
                  onClick={handleAddNew}
                  className="w-full gap-2 bg-white text-blue-700 shadow-md hover:bg-blue-50 sm:w-auto"
                >
                  <Plus className="h-4 w-4" /> New Project
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Search projects</p>
              <p className="text-sm text-slate-500">Find projects by name or description.</p>
            </div>
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by project name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 rounded-xl border-slate-200 pl-12 pr-4 focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {availableTabs.length > 0 && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "ISSM" | "Obsidian")} className="w-full">
          <TabsList className={`grid w-full max-w-md ${availableTabs.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {availableTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
            ))}
          </TabsList>

        <TabsContent value="ISSM" className="mt-0">
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50/80">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Projects Overview</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""} visible
                  </p>
                </div>
                <Badge className="w-fit bg-blue-100 text-blue-700 hover:bg-blue-100">
                  Live project records
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-40" />
                    </Card>
                  ))}
                </div>
              ) : visibleProjects && visibleProjects.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {searchTerm && (
                      <div className="border-b border-slate-200 px-4 py-3 md:px-5">
                        <p className="text-sm text-slate-500">
                          Found <span className="font-semibold text-slate-900">{visibleProjects.length}</span> project{visibleProjects.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
                      {visibleProjects.map((project: any) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 active:shadow-md active:translate-y-0 group relative overflow-hidden"
                          onClick={() => navigate(`/projects/${project.id}`)}
                          onMouseEnter={() => setHoveredProjectId(project.id)}
                          onMouseLeave={() => setHoveredProjectId(null)}
                        >
                          {/* Background gradient on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                          <CardHeader className="flex flex-row items-start justify-between pb-3 relative z-10">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Icon with dynamic color */}
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 transition-all duration-300 overflow-hidden ${
                                hoveredProjectId === project.id
                                  ? "bg-gradient-to-br from-purple-400 to-purple-600 text-white scale-110"
                                  : "bg-primary/10 text-primary"
                              }`}>
                                {project.projectIconUrl ? (
                                  <img src={project.projectIconUrl} alt={project.name} className="h-full w-full object-cover" />
                                ) : (
                                  <FolderOpen className={`h-5 w-5 transition-transform duration-300 ${hoveredProjectId === project.id ? "scale-110" : "scale-100"}`} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="text-base truncate transition-colors duration-300 group-hover:text-primary">{project.name}</CardTitle>
                                {project.description && (
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 group-hover:text-slate-700 transition-colors duration-300">{project.description}</p>
                                )}
                              </div>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-700 active:scale-95 transition-all duration-150"
                                  onClick={() => handleEditClick(project)}
                                  title="Edit project"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 transition-all duration-150"
                                  onClick={() => handleDeleteClick(project)}
                                  title="Delete project"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="border-t pt-3 relative z-10">
                            <div className={`flex items-center gap-2 text-sm transition-colors duration-300 group-hover:text-primary`}>
                              <MapPin className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${hoveredProjectId === project.id ? "text-purple-600 scale-110" : "text-foreground"}`} />
                              <span className="font-medium text-foreground">{project.site_count} sites</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-14">
                  <FolderOpen className="h-12 w-12 text-slate-400/40 mb-4" />
                  <p className="text-slate-700 font-medium">
                    {searchTerm ? "No projects match your search." : "No projects yet. Create your first one!"}
                  </p>
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="mt-4"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Obsidian" className="mt-0">
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50/80">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-900">Projects Overview</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""} visible
                  </p>
                </div>
                <Badge className="w-fit bg-purple-100 text-purple-700 hover:bg-purple-100">
                  Live project records
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-40" />
                    </Card>
                  ))}
                </div>
              ) : visibleProjects && visibleProjects.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {searchTerm && (
                      <div className="border-b border-slate-200 px-4 py-3 md:px-5">
                        <p className="text-sm text-slate-500">
                          Found <span className="font-semibold text-slate-900">{visibleProjects.length}</span> project{visibleProjects.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
                      {visibleProjects.map((project: any) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 active:shadow-md active:translate-y-0 group relative overflow-hidden"
                          onClick={() => navigate(`/projects/${project.id}`)}
                          onMouseEnter={() => setHoveredProjectId(project.id)}
                          onMouseLeave={() => setHoveredProjectId(null)}
                        >
                          {/* Background gradient on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                          <CardHeader className="flex flex-row items-start justify-between pb-3 relative z-10">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Icon with dynamic color */}
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 transition-all duration-300 overflow-hidden ${
                                hoveredProjectId === project.id
                                  ? "bg-gradient-to-br from-purple-400 to-purple-600 text-white scale-110"
                                  : "bg-primary/10 text-primary"
                              }`}>
                                {project.projectIconUrl ? (
                                  <img src={project.projectIconUrl} alt={project.name} className="h-full w-full object-cover" />
                                ) : (
                                  <FolderOpen className={`h-5 w-5 transition-transform duration-300 ${hoveredProjectId === project.id ? "scale-110" : "scale-100"}`} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="text-base truncate transition-colors duration-300 group-hover:text-primary">{project.name}</CardTitle>
                                {project.description && (
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 group-hover:text-slate-700 transition-colors duration-300">{project.description}</p>
                                )}
                              </div>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-700 active:scale-95 transition-all duration-150"
                                  onClick={() => handleEditClick(project)}
                                  title="Edit project"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 transition-all duration-150"
                                  onClick={() => handleDeleteClick(project)}
                                  title="Delete project"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="border-t pt-3 relative z-10">
                            <div className={`flex items-center gap-2 text-sm transition-colors duration-300 group-hover:text-primary`}>
                              <MapPin className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${hoveredProjectId === project.id ? "text-purple-600 scale-110" : "text-foreground"}`} />
                              <span className="font-medium text-foreground">{project.site_count} sites</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-14">
                  <FolderOpen className="h-12 w-12 text-slate-400/40 mb-4" />
                  <p className="text-slate-700 font-medium">
                    {searchTerm ? "No projects match your search." : "No projects yet. Create your first one!"}
                  </p>
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="mt-4"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      )}

      {/* Create/Edit Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Factory Setup"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project"
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectType">Project Type *</Label>
              <select
                id="projectType"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as "ISSM" | "Obsidian")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="ISSM">ISSM</option>
                <option value="Obsidian">Obsidian</option>
              </select>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Assign Users</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {allUsers && allUsers.length > 0 ? (
                    allUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`user-${user.id}`}
                          checked={assignedUsers.includes(user.id!)}
                          onChange={() => toggleUserAssignment(user.id!)}
                          className="rounded"
                        />
                        <label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer text-sm">
                          <div className="text-foreground">{user.email}</div>
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No users available</p>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {assignedUsers.length === 0
                    ? "No users assigned - project will only be visible to admins"
                    : `${assignedUsers.length} user(s) assigned`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="icon">Project Icon (optional)</Label>
              <div className="flex flex-col gap-3">
                {iconPreview && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/10">
                      <img
                        src={iconPreview}
                        alt="Icon preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          console.error("Failed to load icon preview");
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Icon selected</p>
                      <p className="text-xs text-slate-500">Will be uploaded on save</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700 flex-shrink-0"
                      onClick={handleRemoveIcon}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="relative">
                  <input
                    id="icon"
                    type="file"
                    accept="image/*"
                    onChange={handleIconUpload}
                    className="hidden"
                    disabled={uploadingIcon}
                  />
                  <label htmlFor="icon">
                    <Button
                      variant="outline"
                      className="w-full gap-2 cursor-pointer"
                      asChild
                      disabled={uploadingIcon}
                    >
                      <span>
                        <Upload className="h-4 w-4" />
                        {iconPreview ? "Change Icon" : "Upload Icon"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="justify-start gap-2">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
              {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
          </DialogHeader>
          {projectToDelete && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="font-semibold text-foreground">{projectToDelete.name}</p>
                <p className="text-sm text-slate-600 mt-2">This project contains:</p>
                <ul className="text-sm text-slate-600 mt-2 space-y-1 ml-4">
                  <li>• {projectToDelete?.site_count || 0} sites</li>
                </ul>
              </div>

              {(projectToDelete?.site_count || 0) > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 p-4">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    ⚠️ This project has {projectToDelete?.site_count || 0} site(s) inside
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    All sites will be permanently deleted along with this project.
                  </p>
                </div>
              )}

              <p className="text-sm text-slate-600">
                Are you sure you want to delete this project and all its contents? This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            {(projectToDelete?.site_count || 0) > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  navigate(`/projects/${projectToDelete.id}`);
                  setDeleteConfirmOpen(false);
                }}
              >
                View Sites First
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(projectToDelete?.id || "")}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
