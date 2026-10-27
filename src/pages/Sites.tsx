import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { technicalProjectsAPI, type TechnicalProject } from "@/integrations/firebase/technicalProjectsAPI";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, FolderOpen, MapPin, Trash2, Pencil, Search, X, ImageIcon, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/config";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100, "Name too long"),
  description: z.string().trim().max(500, "Description too long").optional(),
});

export default function Sites() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"ISSM" | "Obsidian">("ISSM");

  // Real-time subscriptions
  const [allProjects, setAllProjects] = useState<TechnicalProject[]>([]);
  const [allSites, setAllSites] = useState<SiteDetails[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectsUnsubRef = useRef<(() => void) | null>(null);
  const sitesUnsubRef = useRef<(() => void) | null>(null);
  const usersUnsubRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const categoryInitializedRef = useRef(false);

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
      if (loadedCount === 3) setIsLoading(false);
    };

    // Subscribe to projects new
    projectsUnsubRef.current = technicalProjectsAPI.subscribeAll(
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
    sitesUnsubRef.current = siteDetailsAPI.subscribeAll(
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

    // Subscribe to usersusers and dsys8d
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
      projectsUnsubRef.current?.();
      sitesUnsubRef.current?.();
      usersUnsubRef.current?.();
    };
  }, []);

  const siteCountByProjectId = useMemo(() => {
    const counts = new Map<string, number>();

    allSites.forEach((site) => {
      if (!site.technical_project_id) return;
      counts.set(site.technical_project_id, (counts.get(site.technical_project_id) || 0) + 1);
    });

    return counts;
  }, [allSites]);

  // Compute projects with counts (memoized to avoid recalculation)
  const projects = useMemo(
    () =>
      allProjects.map((proj) => ({
        ...proj,
        site_count: siteCountByProjectId.get(proj.id) || 0,
      })),
    [allProjects, siteCountByProjectId]
  );

  // Filter projects based on user role and category (without search, for category availability)
  const accessibleProjects = useMemo(
    () =>
      projects?.filter((project) => {
        // Role-based filtering
        const roleMatch = isAdmin || (project.assignedUsers || []).includes(appUser?.id || "");
        return roleMatch;
      }) || [],
    [projects, isAdmin, appUser?.id]
  );

  // Calculate available categories based on accessible projects
  const availableCategories = useMemo(() => {
    const categories = new Set<"ISSM" | "Obsidian">();
    accessibleProjects.forEach((p) => {
      const cat = p.category || "ISSM";
      categories.add(cat as "ISSM" | "Obsidian");
    });
    return Array.from(categories).sort();
  }, [accessibleProjects]);

  // Ensure selected category is available, otherwise switch to first available (only on initial load)
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (availableCategories.length > 0 && !categoryInitializedRef.current) {
      categoryInitializedRef.current = true;
      setSelectedCategory(availableCategories[0]);
    } else if (availableCategories.length > 0 && !availableCategories.includes(selectedCategory)) {
      // Only reset if category becomes unavailable
      setSelectedCategory(availableCategories[0]);
    }
  }, [availableCategories]);

  // Filter projects based on user role, search term, and category (memoized)
  const visibleProjects = useMemo(
    () =>
      projects?.filter((project) => {
        // Role-based filtering
        const roleMatch = isAdmin || (project.assignedUsers || []).includes(appUser?.id || "");
        if (!roleMatch) return false;

        // Category-based filtering - treat projects without category as ISSM
        const projectCategory = project.category || "ISSM";
        if (projectCategory !== selectedCategory) {
          return false;
        }

        // Search-based filtering
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          project.name.toLowerCase().includes(searchLower) ||
          (project.description || "").toLowerCase().includes(searchLower)
        );
      }) || [],
    [projects, searchTerm, selectedCategory, isAdmin, appUser?.id]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = projectSchema.parse({ name, description });
      if (editId) {
        await technicalProjectsAPI.update(editId, {
          name: parsed.name,
          ...(parsed.description ? { description: parsed.description } : {}),
          category: projectCategory,
          ...(isAdmin ? { assignedUsers } : {}),
        });
        return { projectId: editId, isUpdate: true };
      } else {
        const result = await technicalProjectsAPI.create({
          name: parsed.name,
          ...(parsed.description ? { description: parsed.description } : {}),
          category: projectCategory,
          assignedUsers: isAdmin ? assignedUsers : [],
        });
        return { projectId: result.id, isUpdate: false };
      }
    },
    onSuccess: async (result) => {
      if (result?.projectId && selectedIconFile) {
        try {
          const iconUrl = await uploadProjectIcon(result.projectId);
          if (iconUrl) {
            await technicalProjectsAPI.update(result.projectId, { iconUrl });
          }
        } catch (error) {
          console.error("Icon upload error:", error);
          toast.error("Project saved, but icon upload failed");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["technical-projects"] });
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
      await technicalProjectsAPI.delete(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-projects"] });
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

  const [projectCategory, setProjectCategory] = useState<"ISSM" | "Obsidian">("ISSM");

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setName("");
    setDescription("");
    setAssignedUsers([]);
    setSelectedIconFile(null);
    setIconPreview("");
    setProjectCategory("ISSM");
  };

  const handleEditClick = (project: TechnicalProject) => {
    setEditId(project.id || null);
    setName(project.name);
    setDescription(project.description || "");
    setAssignedUsers(project.assignedUsers || []);
    setIconPreview(project.iconUrl || "");
    setSelectedIconFile(null);
    setProjectCategory(project.category || "ISSM");
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    closeDialog();
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
      const filePath = `technical_projects/${projectId}/icon_${Date.now()}_${selectedIconFile.name}`;

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
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Technical Details</h1>
            <p className="text-muted-foreground">Manage technical projects and site configurations</p>
          </div>
          {isAdmin && (
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>

        {/* Category Tabs - Only show available categories */}
        {availableCategories.length > 0 && (
          <Tabs value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as "ISSM" | "Obsidian")} className="w-full">
            <TabsList className={`grid w-full max-w-md ${availableCategories.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {availableCategories.map((cat) => (
                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-40" />
            </Card>
          ))}
        </div>
      ) : visibleProjects && visibleProjects.length > 0 ? (
        <div className="space-y-4">
          {searchTerm && (
            <p className="text-sm text-muted-foreground">
              Found {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""}
            </p>
          )}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project: any) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 active:shadow-md active:translate-y-0 group relative overflow-hidden"
                onClick={() => navigate(`/technical-projects/${project.id}`)}
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
                      {project.iconUrl ? (
                        <img src={project.iconUrl} alt={project.name} className="h-full w-full object-cover" />
                      ) : (
                        <FolderOpen className={`h-5 w-5 transition-transform duration-300 ${hoveredProjectId === project.id ? "scale-110" : "scale-100"}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate transition-colors duration-300 group-hover:text-primary">{project.name}</CardTitle>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 group-hover:text-muted-foreground/80 transition-colors duration-300">{project.description}</p>
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
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
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
          </CardContent>
        </Card>
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
                placeholder="e.g. Factory Technical Setup"
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
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={projectCategory}
                onChange={(e) => setProjectCategory(e.target.value as "ISSM" | "Obsidian")}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                    <p className="text-sm text-muted-foreground">No users available</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
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
                      <p className="text-xs text-muted-foreground">Will be uploaded on save</p>
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
                <p className="text-sm text-muted-foreground mt-2">This project contains:</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
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

              <p className="text-sm text-muted-foreground">
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
                  navigate(`/technical-projects/${projectToDelete.id}`);
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
