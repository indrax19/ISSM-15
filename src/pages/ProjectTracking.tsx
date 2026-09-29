import { useState, useEffect, useRef, useMemo, memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectTrackingAPI, type ProjectTracking as ProjectTrackingType } from "@/integrations/firebase/projectTrackingAPI";
import { realtimeProjectTrackingAPI } from "@/integrations/firebase/realtimeAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, X, Upload, ImageIcon, Trash2, Pencil, FileUp, FileIcon, CheckCircle2, Monitor, AlertCircle, FolderOpen } from "lucide-react";
import { storage } from "@/integrations/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { BulkImportProjects } from "@/components/BulkImportProjects";

// Memoized metrics component to prevent unnecessary re-renders
const MetricsCards = memo(({ totalSites, completedSites, inProgressSites, pendingSites }: {
  totalSites: number;
  completedSites: number;
  inProgressSites: number;
  pendingSites: number;
}) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Sites</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalSites}</p>
          </div>
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <FolderOpen className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Completed Sites</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{completedSites}</p>
          </div>
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">In Progress</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{inProgressSites}</p>
          </div>
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
            <Monitor className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{pendingSites}</p>
          </div>
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
));

MetricsCards.displayName = "MetricsCards";

export default function ProjectTracking() {
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const [formData, setFormData] = useState<Partial<ProjectTrackingType>>({
    millName: "",
    city: "",
    district: "",
    address: "",
    state: "",
    cityDistrict: "", // Keep for backward compatibility
    pocName: "",
    pocPhone: "",
    projectStatus: "Not Yet Started",
    supplierName: "",
    logisticsStatus: "Pending Dispatch",
    poStatus: "Pending",
    poDate: new Date().toISOString().split("T")[0],
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    supervisorName: "",
    technicianNames: [],
    teamStatus: "Scheduled",
    hardwareStatus: "",
    hardwareDeliveryStatus: "Pending Dispatch",
  });

  const [technicianInput, setTechnicianInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"ISSM" | "Obsidian">("ISSM");
  const [projectCategory, setProjectCategory] = useState<"ISSM" | "Obsidian">("ISSM");

  // Real-time subscription
  const [projects, setProjects] = useState<ProjectTrackingType[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
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
    unsubscribeRef.current = realtimeProjectTrackingAPI.subscribeAll(
      (projs) => {
        if (isMountedRef.current) {
          setProjects(projs);
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load projects:", error);
        }
      }
    );

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  // Get all projects the user can access
  const userAccessibleProjects = useMemo(() => {
    return projects.filter((p) => {
      // Admins can see all projects
      if (isAdmin) return true;
      // Non-admins can only see projects they're assigned to
      return (p.assignedUsers || []).includes(appUser?.id || "");
    });
  }, [projects, isAdmin, appUser?.id]);

  // Calculate available categories based on accessible projects
  const availableCategories = useMemo(() => {
    const categories = new Set<"ISSM" | "Obsidian">();
    userAccessibleProjects.forEach((p) => {
      const cat = p.category || "ISSM";
      categories.add(cat as "ISSM" | "Obsidian");
    });
    return Array.from(categories).sort();
  }, [userAccessibleProjects]);

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

  // Filter projects by selected category (from accessible projects only)
  const filteredProjects = userAccessibleProjects.filter((p) => {
    const projectCategory = p.category || "ISSM";
    return projectCategory === selectedCategory;
  });

  // Calculate dashboard metrics
  const totalSites = filteredProjects.length;
  const completedSites = filteredProjects.filter((p) => p.projectStatus === "Complete").length;
  const inProgressSites = filteredProjects.filter((p) => p.projectStatus === "In Progress").length;
  const pendingSites = filteredProjects.filter(
    (p) => p.projectStatus === "Not Yet Started" || p.projectStatus === "No PO Yet"
  ).length;

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await projectTrackingAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_tracking"] });
      toast.success("Project deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete project");
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (data: Partial<ProjectTrackingType>) => {
      if (!data.millName?.trim()) {
        throw new Error("Mill Name is required");
      }
      if (!data.city?.trim()) {
        throw new Error("City is required");
      }
      if (!data.district?.trim()) {
        throw new Error("District is required");
      }

      // Combine city and district for backward compatibility
      const processedData = {
        ...data,
        cityDistrict: `${data.city || ""}, ${data.district || ""}`,
        category: projectCategory,
      };

      if (editingId) {
        await projectTrackingAPI.update(editingId, processedData as ProjectTrackingType);
        return { projectId: editingId, isUpdate: true };
      }

      const result = await projectTrackingAPI.create(processedData as ProjectTrackingType);
      return { projectId: result.id, isUpdate: false };
    },
    onSuccess: async (result) => {
      if (result?.projectId && selectedFile) {
        try {
          const photoUrl = await uploadProjectPhoto(result.projectId);
          if (photoUrl) {
            await projectTrackingAPI.update(result.projectId, { projectPhotoUrl: photoUrl } as Partial<ProjectTrackingType>);
          }
        } catch (error) {
          console.error("Photo upload error:", error);
          toast.error("Project saved, but photo upload failed");
        }
      }

      if (result?.projectId && selectedIconFile) {
        try {
          const iconUrl = await uploadProjectIcon(result.projectId);
          if (iconUrl) {
            await projectTrackingAPI.update(result.projectId, { projectIconUrl: iconUrl } as Partial<ProjectTrackingType>);
          }
        } catch (error) {
          console.error("Icon upload error:", error);
          toast.error("Project saved, but icon upload failed");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["project_tracking"] });
      toast.success(editingId ? "Project updated" : "Project created");
      resetForm();
      setShowForm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save project");
    },
  });

  const resetForm = () => {
    setFormData({
      millName: "",
      city: "",
      district: "",
      address: "",
      state: "",
      cityDistrict: "", // Keep for backward compatibility
      pocName: "",
      pocPhone: "",
      projectStatus: "Not Yet Started",
      supplierName: "",
      logisticsStatus: "Pending Dispatch",
      poStatus: "Pending",
      poDate: new Date().toISOString().split("T")[0],
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      supervisorName: "",
      technicianNames: [],
      teamStatus: "Scheduled",
      hardwareStatus: "",
      hardwareDeliveryStatus: "Pending Dispatch",
    });
    setTechnicianInput("");
    setSelectedFile(null);
    setPhotoPreview("");
    setSelectedIconFile(null);
    setIconPreview("");
    setEditingId(null);
    setProjectCategory("ISSM");
  };

  const handleAddTechnician = () => {
    if (technicianInput.trim()) {
      setFormData({
        ...formData,
        technicianNames: [...(formData.technicianNames || []), technicianInput],
      });
      setTechnicianInput("");
    }
  };

  const handleRemoveTechnician = (index: number) => {
    setFormData({
      ...formData,
      technicianNames: formData.technicianNames?.filter((_, i) => i !== index) || [],
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    toast.success("Photo selected. It will be uploaded when you save the project.");
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file for the icon");
      return;
    }

    setSelectedIconFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIconPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    toast.success("Icon selected. It will be uploaded when you save the project.");
  };

  const uploadProjectPhoto = async (projectId: string): Promise<string | null> => {
    if (!selectedFile) return null;

    try {
      setUploading(true);
      const filePath = `projects/${projectId}/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, selectedFile);
      const downloadUrl = await getDownloadURL(storageRef);
      setSelectedFile(null);
      setPhotoPreview("");
      return downloadUrl;
    } catch (error: any) {
      toast.error("Failed to upload photo");
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview("");
    toast.success("Photo removed");
  };

  const uploadProjectIcon = async (projectId: string): Promise<string | null> => {
    if (!selectedIconFile) return null;

    try {
      setUploadingIcon(true);
      const filePath = `projects/${projectId}/icon_${Date.now()}_${selectedIconFile.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, selectedIconFile);
      const downloadUrl = await getDownloadURL(storageRef);
      setSelectedIconFile(null);
      setIconPreview("");
      return downloadUrl;
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

  const handleEdit = (project: ProjectTrackingType) => {
    // Parse cityDistrict into separate city and district for existing records
    let city = project.city || "";
    let district = project.district || "";

    if (project.cityDistrict && !city && !district) {
      const parts = project.cityDistrict.split(',').map(part => part.trim());
      city = parts[0] || "";
      district = parts[1] || "";
    }

    setFormData({
      ...project,
      city,
      district,
    });
    setEditingId(project.id!);
    setPhotoPreview(project.projectPhotoUrl || "");
    setIconPreview(project.projectIconUrl || "");
    setProjectCategory(project.category || "ISSM");
    setShowForm(true);
  };


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Gradient Header Card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Badge className="border border-white/25 bg-white/15 text-white hover:bg-white/15 w-fit">
                Project Management
              </Badge>
              <div>
                <h1 className="text-3xl font-bold md:text-4xl">Project Tracking</h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">
                  Monitor and manage all your project sites with real-time updates and comprehensive tracking.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:min-w-[220px] lg:flex-col">
              <Button
                onClick={() => setShowImportDialog(true)}
                variant="outline"
                className="w-full gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
              >
                <FileUp className="h-4 w-4" /> Bulk Import
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="w-full gap-2 bg-white text-blue-700 shadow-md hover:bg-blue-50 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Add Site
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs - Only show available categories */}
      {!showForm && availableCategories.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <Tabs value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as "ISSM" | "Obsidian")} className="w-full">
              <TabsList className={`grid w-full max-w-md ${availableCategories.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {availableCategories.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="text-base">{cat}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Metrics */}
      {!showForm && (
        <MetricsCards
          totalSites={totalSites}
          completedSites={completedSites}
          inProgressSites={inProgressSites}
          pendingSites={pendingSites}
        />
      )}

      {/* Bulk Import Dialog */}
      <BulkImportProjects
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      {/* Form Modal / Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <Card className="w-full max-w-4xl rounded-none bg-white shadow-2xl sm:h-auto sm:rounded-3xl border-0 flex flex-col">
            <CardHeader className="sticky top-0 z-10 border-b bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl text-white">{editingId ? "Edit Project" : "Add New Project"}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="h-10 w-10 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 p-6 sm:p-8">
            {/* Site Information */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Site Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    value={projectCategory}
                    onChange={(e) => setProjectCategory(e.target.value as "ISSM" | "Obsidian")}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ISSM">ISSM</option>
                    <option value="Obsidian">Obsidian</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Mill Name *</Label>
                  <Input
                    value={formData.millName || ""}
                    onChange={(e) => setFormData({ ...formData, millName: e.target.value })}
                    placeholder="Enter mill name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Input
                    value={formData.district || ""}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    placeholder="Enter district"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={formData.state || ""}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Enter state"
                  />
                </div>
              </div>
            </div>

            {/* POC Details */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Point of Contact Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>POC Name</Label>
                  <Input
                    value={formData.pocName || ""}
                    onChange={(e) => setFormData({ ...formData, pocName: e.target.value })}
                    placeholder="Enter POC name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>POC Phone</Label>
                  <Input
                    value={formData.pocPhone || ""}
                    onChange={(e) => setFormData({ ...formData, pocPhone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </div>

            {/* Project Status */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Project Status</h3>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.projectStatus || "Not Yet Started"}
                  onValueChange={(value: any) => setFormData({ ...formData, projectStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Complete">Complete</SelectItem>
                    <SelectItem value="Partially Completed">Partially Completed</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Not Yet Started">Not Yet Started</SelectItem>
                    <SelectItem value="No PO Yet">No PO Yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supplier */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Supplier</h3>
              <div className="space-y-2">
                <Label>Supplier Name</Label>
                <Input
                  value={formData.supplierName || ""}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  placeholder="Enter supplier name (can be custom)"
                />
              </div>
            </div>

            {/* Logistics Status */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Client Site / Logistics Status</h3>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.logisticsStatus || "Pending Dispatch"}
                  onValueChange={(value: any) => setFormData({ ...formData, logisticsStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending Dispatch">Pending Dispatch</SelectItem>
                    <SelectItem value="Dispatched">Dispatched</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Arrived at Destination">Arrived at Destination</SelectItem>
                    <SelectItem value="Delayed – Logistics">Delayed – Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* PO Status and Date */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Purchase Order (PO)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>PO Status</Label>
                  <Select
                    value={formData.poStatus || "Pending"}
                    onValueChange={(value: any) => setFormData({ ...formData, poStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Issued">Issued</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>PO Date</Label>
                  <Input
                    type="date"
                    value={formData.poDate || ""}
                    onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Project Documentation / Photo */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Project Documentation</h3>
              <div className="space-y-2 sm:space-y-3 pt-4 border-t">
                <Label>Project Photo / Picture</Label>
                <p className="text-xs text-muted-foreground">
                  Upload project site photo. It will be saved when you save the project.
                </p>

                {photoPreview ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Project photo preview"
                        className="max-h-48 rounded border object-cover w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("photo-upload")?.click()}
                        className="gap-2 flex-1"
                        disabled={uploading}
                      >
                        <Upload className="h-4 w-4" />
                        {selectedFile ? "Change Photo" : "Upload Photo"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => document.getElementById("photo-upload")?.click()}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50 transition"
                  >
                    <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      Click to upload project photo
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG (Max 10MB)</p>
                  </div>
                )}

                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Custom Icon Upload */}
              <div className="pt-4 border-t">
                <Label>Custom Project Icon</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Upload a custom icon for this project. If not uploaded, default file icon will be used.
                </p>

                {iconPreview ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={iconPreview}
                        alt="Project icon preview"
                        className="h-16 w-16 rounded border object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("icon-upload")?.click()}
                        className="gap-2 flex-1"
                        disabled={uploadingIcon}
                      >
                        <Upload className="h-4 w-4" />
                        {selectedIconFile ? "Change Icon" : "Upload Icon"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveIcon}
                        className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={uploadingIcon}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    {selectedIconFile && (
                      <p className="text-xs text-muted-foreground">Selected: {selectedIconFile.name}</p>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => document.getElementById("icon-upload")?.click()}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50 transition"
                  >
                    <FileIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      Click to upload custom icon
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, ICO (Max 2MB)</p>
                  </div>
                )}

                <input
                  id="icon-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Project Timeline */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Project Timeline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate || ""}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate || ""}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              {formData.startDate && formData.endDate && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Project Duration: <span className="font-semibold text-foreground">
                      {Math.ceil(
                        (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                      )} days
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Supervisor / Team */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Supervisor / Team</h3>
              <div className="space-y-2">
                <Label>Supervisor Name</Label>
                <Input
                  value={formData.supervisorName || ""}
                  onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                  placeholder="Enter supervisor name"
                />
              </div>
              <div className="space-y-2 mt-4">
                <Label>Technician Names</Label>
                <div className="flex gap-2">
                  <Input
                    value={technicianInput}
                    onChange={(e) => setTechnicianInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTechnician();
                      }
                    }}
                    placeholder="Enter technician name"
                  />
                  <Button onClick={handleAddTechnician} size="sm">Add</Button>
                </div>
                {formData.technicianNames && formData.technicianNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.technicianNames.map((tech, idx) => (
                      <Badge key={idx} variant="outline" className="gap-2">
                        {tech}
                        <button
                          onClick={() => handleRemoveTechnician(idx)}
                          className="text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Team Status */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Team Status</h3>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.teamStatus || "Scheduled"}
                  onValueChange={(value: any) => setFormData({ ...formData, teamStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Mobilized">Mobilized</SelectItem>
                    <SelectItem value="Travelling">Travelling</SelectItem>
                    <SelectItem value="Onsite – Work In Progress">Onsite – Work In Progress</SelectItem>
                    <SelectItem value="Onsite – Completed">Onsite – Completed</SelectItem>
                    <SelectItem value="Returned to Base">Returned to Base</SelectItem>
                    <SelectItem value="Standby / Idle">Standby / Idle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hardware Status */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Hardware / ISSM Status</h3>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.hardwareStatus || "Pending Dispatch"}
                  onValueChange={(value: any) => setFormData({ ...formData, hardwareStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending Dispatch">Pending Dispatch</SelectItem>
                    <SelectItem value="Dispatched">Dispatched</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Arrived at Destination">Arrived at Destination</SelectItem>
                    <SelectItem value="Delayed – Logistics">Delayed – Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hardware Delivery Status */}
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm">Hardware / Client Delivery Status</h3>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.hardwareDeliveryStatus || "Pending Dispatch"}
                  onValueChange={(value: any) => setFormData({ ...formData, hardwareDeliveryStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending Dispatch">Pending Dispatch</SelectItem>
                    <SelectItem value="Dispatched">Dispatched</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Arrived at Destination">Arrived at Destination</SelectItem>
                    <SelectItem value="Delayed – Logistics">Delayed – Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 border-slate-300 bg-white"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveProjectMutation.mutate(formData)}
                disabled={saveProjectMutation.isPending || !formData.millName}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saveProjectMutation.isPending ? "Saving..." : editingId ? "Update Project" : "Create Project"}
              </Button>
            </div>
          </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
