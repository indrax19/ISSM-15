import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectTrackingAPI, type ProjectTracking } from "@/integrations/firebase/projectTrackingAPI";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeProject, useRealtimeSites } from "@/hooks/useProjectTracking";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, MapPin, Pencil, Trash2, Eye, Download, Wifi, Zap, FileUp, CheckCircle, Clock, FileText, Loader2, Copy } from "lucide-react";
import { RealtimeStatusIndicator, DataLoadingSkeleton, ConnectionBadge } from "@/components/RealtimeStatusIndicator";
import { format, differenceInHours } from "date-fns";
import { exportProjectTrackingToExcel } from "@/lib/excelExport";
import { downloadProjectSitePDF } from "@/lib/pdfGenerator";
import { BulkImportProjects } from "@/components/BulkImportProjects";
import { ProjectProfileSelector } from "@/components/ProjectProfileSelector";
import { companyProfileAPI, DeploymentCertificate } from "@/integrations/firebase/firestore";
import { downloadDeploymentCertificatePDF } from "@/lib/pdfGenerator";

const PROJECT_STATUS_PROGRESS_ITEMS = [
  { key: "preRepositoryCompleted", weight: 10 },
  { key: "cablingCompleted", weight: 20 },
  { key: "camerasInstalled", weight: 15 },
  { key: "nvrInstalled", weight: 15 },
  { key: "osInstalled", weight: 20 },
  { key: "softwareInstalled", weight: 15 },
  { key: "systemLive", weight: 5 },
] as const;

const getProjectCompletionPercent = (site: ProjectTracking) => {
  if (site.projectNotStarted || site.projectStatus === "Not Yet Started") return 0;
  if (site.projectCompleted || site.projectStatus === "Complete") return 100;

  return PROJECT_STATUS_PROGRESS_ITEMS.reduce(
    (completion, { key, weight }) => completion + (site[key] ? weight : 0),
    0
  );
};

// Helper functions to determine new-site status
const getUpdateStatus = (site: any, viewedIds?: Set<string>, currentUserId?: string): "new" | null => {
  if (!site.created_at || !site.updated_at) return null;

  // Only show for genuinely new sites, not later updates
  if (site.created_at !== site.updated_at) return null;

  // Hide for the person who added it
  if (site.created_by && currentUserId && site.created_by === currentUserId) return null;

  // Don't show badge if site has been viewed
  if (viewedIds?.has(site.id)) return null;

  return "new";
};

const isRecentlyModified = (site: any, viewedIds?: Set<string>, currentUserId?: string): boolean => {
  return getUpdateStatus(site, viewedIds, currentUserId) !== null;
};

const getCertificateFormStorageKey = (siteId: string) => `certificate_form_${siteId}`;

const loadCertificateFormData = (siteId: string) => {
  try {
    const stored = localStorage.getItem(getCertificateFormStorageKey(siteId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getFormDataWithSiteInfo = (site: any, defaultData: any) => {
  const savedData = loadCertificateFormData(site.id);
  if (savedData) {
    return savedData;
  }
  return {
    ...defaultData,
    client_name: site.pocName || "",
    issm_name: site.supervisorName || "",
    issm_designation: "Deployment Administrator",
  };
};

const saveCertificateFormData = (siteId: string, data: any) => {
  try {
    localStorage.setItem(getCertificateFormStorageKey(siteId), JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

const clearCertificateFormData = (siteId: string) => {
  try {
    localStorage.removeItem(getCertificateFormStorageKey(siteId));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [viewSite, setViewSite] = useState<any>(null);
  const [viewedSiteIds, setViewedSiteIds] = useState<Set<string>>(() => {
    // Load viewed sites from localStorage on mount
    const storageKey = `viewed_sites_${id}_${appUser?.id}`;
    const stored = localStorage.getItem(storageKey);
    return new Set(stored ? JSON.parse(stored) : []);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [siteForDownload, setSiteForDownload] = useState<any>(null);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [selectedSiteForCert, setSelectedSiteForCert] = useState<any>(null);
  const getDefaultFormData = () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      certificate_type: "issm",
      client_name: "",
      client_designation: "",
      client_date: today,
      deployment_date: today,
      issm_name: "",
      issm_designation: "",
      issm_date: today,
    };
  };

  const [certificateFormData, setCertificateFormData] = useState(getDefaultFormData());
  const [companyProfiles, setCompanyProfiles] = useState<any[]>([]);
  const [selectedCompanyProfile, setSelectedCompanyProfile] = useState<string>("");
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const [isSavingCert, setIsSavingCert] = useState(false);

  // Persist viewed sites to localStorage whenever they change
  useEffect(() => {
    const storageKey = `viewed_sites_${id}_${appUser?.id}`;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(viewedSiteIds)));
  }, [viewedSiteIds, id, appUser?.id]);

  // Persist certificate form data whenever it changes (for same site)
  useEffect(() => {
    if (selectedSiteForCert?.id && showCertificateDialog) {
      saveCertificateFormData(selectedSiteForCert.id, certificateFormData);
    }
  }, [certificateFormData, selectedSiteForCert?.id, showCertificateDialog]);

  // Load company profiles
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const profiles = await companyProfileAPI.getAll();
        setCompanyProfiles(profiles);
        if (profiles.length > 0) {
          setSelectedCompanyProfile(profiles[0].id || "");
        }
      } catch (error) {
        console.log("Failed to load company profiles");
      }
    };
    loadProfiles();
  }, []);

  // Real-time subscriptions
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
    isConnected: projectConnected,
  } = useRealtimeProject(id);

  const {
    data: sites = [],
    isLoading: sitesLoading,
    error: sitesError,
    isConnected: sitesConnected,
  } = useRealtimeSites(id);

  // Filter sites and sort by most recently updated first (memoized to avoid recalculation)
  const filteredSites = useMemo(
    () =>
      sites
        .filter((site) => {
          const searchValue = searchTerm.trim().toLowerCase();
          const matchesSearch =
            !searchValue ||
            [site.millName, site.city, site.district, site.address, site.pocName, site.pocPhone]
              .filter(Boolean)
              .some((value) => value!.toLowerCase().includes(searchValue));

          const matchesStatus = !filterStatus || site.projectStatus === filterStatus;
          const matchesCity =
            !filterCity ||
            (site.city || "").toLowerCase().includes(filterCity.toLowerCase());
          const matchesSupplier =
            !filterSupplier ||
            (site.supplierName || "").toLowerCase().includes(filterSupplier.toLowerCase());

          return matchesSearch && matchesStatus && matchesCity && matchesSupplier;
        })
        .sort((a, b) => {
          // Sort by updated_at descending (newest first)
          const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return dateB - dateA;
        }),
    [sites, searchTerm, filterStatus, filterCity, filterSupplier]
  );

  // Get unique values for filters (memoized to avoid recalculation)
  const { uniqueCities, uniqueStatuses, uniqueSuppliers } = useMemo(
    () => ({
      uniqueCities: Array.from(new Set(sites.map((s) => s.city).filter(Boolean))),
      uniqueStatuses: Array.from(new Set(sites.map((s) => s.projectStatus).filter(Boolean))),
      uniqueSuppliers: Array.from(new Set(sites.map((s) => s.supplierName).filter(Boolean))),
    }),
    [sites]
  );

  const hasActiveFilters = useMemo(
    () => Boolean(searchTerm || filterStatus || filterCity || filterSupplier),
    [searchTerm, filterStatus, filterCity, filterSupplier]
  );

  const deleteSiteMutation = useMutation({
    mutationFn: (siteId: string) => projectTrackingAPI.delete(siteId),
    onSuccess: () => {
      // Real-time listener will automatically update the UI
      // No need to invalidate queries
      toast.success("Site deleted successfully");
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      const errorMessage =
        error?.code === "permission-denied"
          ? "You don't have permission to delete this site"
          : error?.message || "Failed to delete site";
      toast.error(errorMessage);
    },
  });

  // Check if current user is assigned to this project
  const isUserAssigned = project && (isAdmin || (project.assignedUsers || []).includes(appUser?.id || ""));

  const handleDeleteSite = (siteId: string) => {
    if (!isUserAssigned) {
      toast.error("Permission Denied: You don't have access to edit this project");
      return;
    }
    if (confirm("Are you sure you want to delete this site?")) {
      deleteSiteMutation.mutate(siteId);
    }
  };

  const duplicateSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const siteToClone = sites.find(s => s.id === siteId);
      if (!siteToClone) throw new Error("Site not found");

      const newSiteData = { ...siteToClone };
      delete newSiteData.id;
      delete newSiteData.created_at;
      delete newSiteData.updated_at;
      delete newSiteData.created_by;

      return projectTrackingAPI.create({ ...newSiteData, projectId: id });
    },
    onSuccess: () => {
      toast.success("Site duplicated successfully");
    },
    onError: (error: any) => {
      console.error("Duplicate error:", error);
      const errorMessage = error?.message || "Failed to duplicate site";
      toast.error(errorMessage);
    },
  });

  const handleDuplicateSite = (siteId: string) => {
    if (!isUserAssigned) {
      toast.error("Permission Denied: You don't have access to edit this project");
      return;
    }
    duplicateSiteMutation.mutate(siteId);
  };

  const createCertificateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedSiteForCert?.id) throw new Error("No site selected");
      const { deploymentCertificateAPI } = await import("@/integrations/firebase/firestore");

      const selectedProfile = companyProfiles.find(p => p.id === selectedCompanyProfile);
      const certData: DeploymentCertificate = {
        site_id: selectedSiteForCert.id,
        company_name: project?.name || "",
        site_address: selectedSiteForCert.address || "",
        mill_name: selectedSiteForCert.millName || "",
        certificate_type: data.certificate_type as "digital-eye" | "uqaab" | "issm",
        client_name: data.client_name,
        client_designation: data.client_designation,
        client_date: data.client_date,
        deployment_date: data.deployment_date,
        issm_name: data.issm_name,
        issm_designation: data.issm_designation,
        issm_date: data.issm_date,
        companyProfileId: selectedCompanyProfile,
        companyProfileName: selectedProfile?.company_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return deploymentCertificateAPI.create(certData);
    },
    onSuccess: async () => {
      toast.success(`Certificate created for ${selectedSiteForCert?.millName}`);

      // Download the certificate PDF
      if (selectedCompanyProfile) {
        try {
          setIsDownloadingCert(true);
          const selectedProfile = companyProfiles.find(p => p.id === selectedCompanyProfile);
          await downloadDeploymentCertificatePDF(
            project?.name || "",
            selectedSiteForCert?.address || "",
            selectedSiteForCert?.millName || "",
            certificateFormData.client_name,
            certificateFormData.client_designation,
            certificateFormData.client_date,
            certificateFormData.deployment_date,
            certificateFormData.issm_name,
            certificateFormData.issm_designation,
            certificateFormData.issm_date,
            selectedProfile?.logo_url,
            selectedProfile?.logo_url,
            selectedCompanyProfile,
            certificateFormData.certificate_type as "digital-eye" | "uqaab" | "issm"
          );
          toast.success("Certificate PDF downloaded!");
        } catch (error) {
          console.error("Failed to download certificate:", error);
        } finally {
          setIsDownloadingCert(false);
        }
      }

      if (selectedSiteForCert?.id) {
        clearCertificateFormData(selectedSiteForCert.id);
      }
      setShowCertificateDialog(false);
      setCertificateFormData({
        certificate_type: "digital-eye",
        client_name: "",
        client_designation: "",
        client_date: "",
        deployment_date: "",
        issm_name: "",
        issm_designation: "",
        issm_date: "",
      });
      setSelectedSiteForCert(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create certificate");
    },
  });

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "Complete":
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "In Progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Partially Completed":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Not Yet Started":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  // Calculate status statistics
  const statusStats = {
    total: sites.length,
    completed: sites.filter(s => s.projectStatus === "Completed" || s.projectStatus === "Complete").length,
    inProgress: sites.filter(s => s.projectStatus === "In Progress").length,
    pending: sites.filter(s => !["Completed", "Complete", "In Progress"].includes(s.projectStatus)).length,
  };

  return (
    <div className="space-y-6">
      {/* Real-time Status Display */}
      <RealtimeStatusIndicator
        isConnected={projectConnected && sitesConnected}
        error={projectError || sitesError}
        isLoading={projectLoading || sitesLoading}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            className="flex-shrink-0 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div className="flex-1 min-w-0">
            {projectLoading ? (
              <>
                <div className="h-6 md:h-8 w-40 bg-gray-200 animate-pulse rounded mb-2"></div>
                <div className="h-3 md:h-4 w-48 bg-gray-200 animate-pulse rounded"></div>
              </>
            ) : (
              <>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">{project?.name ?? "Project"}</h1>
                {project?.description && <p className="text-gray-600 text-sm line-clamp-2 mt-1">{project.description}</p>}
              </>
            )}
          </div>
        </div>
        {isUserAssigned && (
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowImportDialog(true)}
              variant="outline"
              className="gap-2 border-gray-300 hover:bg-gray-50"
              size="sm"
            >
              <FileUp className="h-4 w-4" /> Bulk Import
            </Button>
            <Button
              onClick={() => navigate(`/project-sites/new/${id}`)}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
              size="sm"
            >
              <Plus className="h-4 w-4" /> Add New Site
            </Button>
          </div>
        )}
      </div>

      {!isUserAssigned && (
        <Card className="border border-amber-300 bg-amber-50">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
              <span>⚠️</span> You don't have permission to edit this project. Contact an administrator for access.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status Statistics */}
      {sites && sites.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sites</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{statusStats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">{statusStats.completed}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{statusStats.inProgress}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-amber-600 mt-2">{statusStats.pending}</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sites List */}
      {sitesLoading ? (
        <DataLoadingSkeleton />
      ) : sites && sites.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Sites <span className="text-gray-600">({filteredSites.length})</span></h2>
              {sitesConnected && <div className="flex items-center gap-1 text-xs font-medium text-green-600"><Wifi className="h-3.5 w-3.5" /> Live</div>}
            </div>
            <Button
              variant="outline"
              onClick={() => exportProjectTrackingToExcel(filteredSites)}
              disabled={filteredSites.length === 0}
              className="gap-2 border-gray-300 hover:bg-gray-50 w-full sm:w-auto"
              size="sm"
            >
              <Download className="h-4 w-4" /> Download Excel
            </Button>
          </div>

          {/* Filters */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Found <span className="font-semibold text-gray-900">{filteredSites.length}</span> site{filteredSites.length === 1 ? "" : "s"}
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterStatus("");
                      setFilterCity("");
                      setFilterSupplier("");
                    }}
                    className="border-gray-300 hover:bg-gray-50"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Search</Label>
                  <Input
                    placeholder="Mill name, city, POC, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Project Status</Label>
                  <Select
                    value={filterStatus || "all"}
                    onValueChange={(val) => setFilterStatus(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="border border-gray-300">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">City</Label>
                  <Select
                    value={filterCity || "all"}
                    onValueChange={(val) => setFilterCity(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="border border-gray-300">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {uniqueCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Supplier Name</Label>
                  <Select
                    value={filterSupplier || "all"}
                    onValueChange={(val) => setFilterSupplier(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="border border-gray-300">
                      <SelectValue placeholder="All Suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {uniqueSuppliers.map((supplier) => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
            <Table className="min-w-[1320px] table-fixed">
              <TableHeader className="bg-gray-50 border-b-2 border-gray-200">
                <TableRow className="hover:bg-gray-50">
                  <TableHead className="w-16 font-semibold text-gray-700 h-12">Sr.</TableHead>
                  <TableHead className="w-44 font-semibold text-gray-700">Mill Name</TableHead>
                  <TableHead className="w-32 font-semibold text-gray-700">City</TableHead>
                  <TableHead className="w-64 font-semibold text-gray-700">Address</TableHead>
                  <TableHead className="w-24 font-semibold text-gray-700">Unit #</TableHead>
                  <TableHead className="w-40 font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="w-64 font-semibold text-gray-700">POC Name</TableHead>
                  <TableHead className="w-40 font-semibold text-gray-700">Last Updated</TableHead>
                  <TableHead className="w-44 font-semibold text-gray-700 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.length > 0 ? (
                  filteredSites.map((site, index) => {
                    const updateStatus = getUpdateStatus(site, viewedSiteIds, appUser?.id);
                    const isRecent = isRecentlyModified(site, viewedSiteIds, appUser?.id);

                    return (
                      <TableRow
                        key={site.id}
                        className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${isRecent ? "bg-blue-50" : ""}`}
                      >
                        <TableCell className="font-medium text-center text-gray-600 py-4">{filteredSites.length - index}</TableCell>
                        <TableCell className="font-semibold text-gray-900 py-4 whitespace-normal break-words">
                          <div className="flex min-w-0 items-start gap-2">
                            {site.millName || "—"}
                            {updateStatus && (
                              <Badge
                                className="bg-green-100 text-green-800 border-green-300"
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                New
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 py-4 whitespace-normal break-words">{site.city || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-700 py-4 whitespace-normal break-words">{site.address || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-700 py-4 whitespace-normal break-words">{site.unitNo || "—"}</TableCell>
                        <TableCell className="py-4 whitespace-normal">
                          <Badge className={`${getProjectStatusColor(site.projectStatus)} max-w-full whitespace-normal text-center font-medium`}>
                            {site.projectStatus || "—"}<span className="ml-1">{getProjectCompletionPercent(site)}%</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 whitespace-normal break-words">
                          <div className="space-y-1 text-sm">
                            <div><span className="text-xs text-gray-500">Project:</span> {site.pocProjectName || site.pocName || "—"}</div>
                            <div className="text-xs text-gray-600">{site.pocProjectPhone || site.pocPhone || "—"}</div>
                            <div><span className="text-xs text-gray-500">Site:</span> {site.pocSiteName || "—"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 py-4 whitespace-normal break-words">
                          {site.updated_at ? format(new Date(site.updated_at), "MMM d, yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          <div className="space-y-2">
                            <div className="mx-auto grid w-[124px] grid-cols-3 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                onClick={() => {
                                  setViewSite(site);
                                  setViewedSiteIds(prev => new Set(prev).add(site.id));
                                }}
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                                onClick={() => {
                                  setSiteForDownload(site);
                                  setShowProfileSelector(true);
                                }}
                                title="Download PDF"
                                aria-label="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {isUserAssigned && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-700"
                                    onClick={() => navigate(`/project-sites/${site.id}/${id}`)}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                                    onClick={() => handleDuplicateSite(site.id!)}
                                    title="Duplicate"
                                    disabled={duplicateSiteMutation.isPending}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-9 p-0 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
                                    onClick={() => handleDeleteSite(site.id!)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                onClick={() => {
                                  setSelectedSiteForCert(site);
                                  setCertificateFormData(getFormDataWithSiteInfo(site, getDefaultFormData()));
                                  setShowCertificateDialog(true);
                                }}
                                title="Create Certificate"
                                aria-label="Create Certificate"
                              >
                                <BadgeCheck className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No sites match your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredSites.length > 0 ? (
              filteredSites.map((site) => {
                const updateStatus = getUpdateStatus(site, viewedSiteIds, appUser?.id);
                const isRecent = isRecentlyModified(site, viewedSiteIds, appUser?.id);

                return (
                  <Card
                    key={site.id}
                    className={`border border-gray-200 shadow-sm hover:shadow-md transition-all ${isRecent ? "bg-blue-50 border-blue-300" : ""}`}
                  >
                    <CardContent className="p-4 space-y-4">
                      {/* Header with Mill Name and Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base text-gray-900 truncate">{site.millName || "—"}</h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {site.updated_at ? format(new Date(site.updated_at), "MMM d, yyyy HH:mm") : "—"}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {updateStatus && (
                            <Badge className="bg-green-100 text-green-800 text-xs border-green-300">
                              <Zap className="h-3 w-3 mr-1" />
                              New
                            </Badge>
                          )}
                          <Badge className={`${getProjectStatusColor(site.projectStatus)} text-xs font-medium`}>
                            {site.projectStatus || "—"}<span className="ml-1">{getProjectCompletionPercent(site)}%</span>
                          </Badge>
                        </div>
                      </div>

                      {/* Location Info */}
                      <div className="border-t pt-4 grid grid-cols-2 gap-3 text-sm">
                        {site.city && (
                          <div>
                            <p className="text-xs font-medium text-gray-600">City</p>
                            <p className="font-semibold text-gray-900 mt-1">{site.city}</p>
                          </div>
                        )}
                        {site.district && (
                          <div>
                            <p className="text-xs font-medium text-gray-600">District</p>
                            <p className="font-semibold text-gray-900 mt-1">{site.district}</p>
                          </div>
                        )}
                        {site.state && (
                          <div>
                            <p className="text-xs font-medium text-gray-600">State</p>
                            <p className="font-semibold text-gray-900 mt-1">{site.state}</p>
                          </div>
                        )}
                        {site.supplierName && (
                          <div>
                            <p className="text-xs font-medium text-gray-600">Supplier</p>
                            <p className="font-semibold text-gray-900 truncate mt-1">{site.supplierName}</p>
                          </div>
                        )}
                      </div>

                      {/* Address */}
                      {site.address && (
                        <div className="text-sm">
                          <p className="text-xs font-medium text-gray-600 mb-1">Address</p>
                          <p className="font-medium text-gray-900">{site.address}</p>
                        </div>
                      )}

                      {/* POC Info */}
                      <div className="border-t pt-3 space-y-1 text-sm">
                        <p className="text-xs font-medium text-gray-600 mb-2">Point of Contact</p>
                        <p><span className="text-xs text-gray-500">Project:</span> {site.pocProjectName || site.pocName || "—"}</p>
                        <p className="text-xs text-gray-600">{site.pocProjectPhone || site.pocPhone || "—"}</p>
                        <p><span className="text-xs text-gray-500">Site:</span> {site.pocSiteName || "—"}</p>
                      </div>

                      {/* Actions */}
                      <div className="border-t pt-3 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setViewSite(site);
                              setViewedSiteIds(prev => new Set(prev).add(site.id));
                            }}
                            className="h-9 w-9 p-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSiteForDownload(site);
                              setShowProfileSelector(true);
                            }}
                            className="h-9 w-9 p-0 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                            title="Download PDF"
                            aria-label="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {isUserAssigned && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-700"
                                onClick={() => navigate(`/project-sites/${site.id}/${id}`)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleDeleteSite(site.id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            title="Create Certificate"
                            aria-label="Create Certificate"
                            onClick={() => {
                              setSelectedSiteForCert(site);
                              setCertificateFormData(getFormDataWithSiteInfo(site, getDefaultFormData()));
                              setShowCertificateDialog(true);
                            }}
                          >
                            <BadgeCheck className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MapPin className="h-8 w-8 text-gray-400 mb-3" />
                  <p className="text-gray-900 font-semibold">No sites match</p>
                  <p className="text-gray-600 text-sm mt-1">Try adjusting your filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-3 bg-gray-100 rounded-lg mb-4">
              <MapPin className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-900 font-semibold mb-2">No sites yet</p>
            <p className="text-gray-600 text-sm mb-6">Create your first site to get started!</p>
            {isUserAssigned && (
              <Button
                onClick={() => navigate(`/project-sites/new/${id}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Site
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Site Details Modal */}
      <Dialog open={!!viewSite} onOpenChange={(open) => !open && setViewSite(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900">{viewSite?.millName || "Site Details"}</DialogTitle>
          </DialogHeader>
          {viewSite && (
            <div className="space-y-6">
              {/* Project Photo */}
              {viewSite.projectPhotoUrl && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={viewSite.projectPhotoUrl} alt="Project" className="w-full max-h-80 object-cover" />
                </div>
              )}

              {viewSite.siteDocumentUrl && (
                <Card className="border border-amber-200 bg-amber-50">
                  <CardHeader className="pb-3 border-b border-amber-200">
                    <h3 className="text-lg font-semibold text-gray-900">📄 Site Document</h3>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Uploaded File</p>
                      <p className="text-base font-semibold text-gray-900 break-all">{viewSite.siteDocumentName || "Site document"}</p>
                    </div>
                    <Button asChild className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                      <a href={viewSite.siteDocumentUrl} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                        Open Document
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Project Status Badge */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">Project Status:</span>
                <Badge className={`${getProjectStatusColor(viewSite.projectStatus)} font-semibold text-base py-2 px-4`}>
                  {viewSite.projectStatus || "—"}
                </Badge>
              </div>

              {/* Location Information Section */}
              <Card className="border border-blue-200 bg-blue-50">
                <CardHeader className="pb-3 border-b border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Location Information
                  </h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">City</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.city || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">District</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.district || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">State</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.state || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Unit No</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.unitNo || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase">Address</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.address || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Point of Contact Section */}
              <Card className="border border-green-200 bg-green-50">
                <CardHeader className="pb-3 border-b border-green-200">
                  <h3 className="text-lg font-semibold text-gray-900">👤 Point of Contact</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                      ["POC Project", viewSite.pocProjectName || viewSite.pocName, viewSite.pocProjectPhone, viewSite.pocProjectEmail],
                      ["POC Site", viewSite.pocSiteName, viewSite.pocSitePhone, viewSite.pocSiteEmail],
                      ["POC Technical", viewSite.pocTechnicalName, viewSite.pocTechnicalPhone, viewSite.pocTechnicalEmail],
                    ].map(([label, name, phone, email]) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-gray-600 uppercase">{label}</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">{name || "—"}</p>
                        <p className="text-sm text-gray-600 mt-1">{phone || "—"}</p>
                        <p className="text-sm text-gray-600 break-words">{email || "—"}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Status Overview Section */}
              <Card className="border border-purple-200 bg-purple-50">
                <CardHeader className="pb-3 border-b border-purple-200">
                  <h3 className="text-lg font-semibold text-gray-900">⚙️ Status Overview</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Team Status</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.teamStatus || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">PO Status</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.poStatus || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Logistics Status</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.logisticsStatus || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Information Section */}
              <Card className="border border-orange-200 bg-orange-50">
                <CardHeader className="pb-3 border-b border-orange-200">
                  <h3 className="text-lg font-semibold text-gray-900">👥 Team Information</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Supervisor Name</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.supervisorName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Technicians</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.technicianNames?.join(", ") || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Section */}
              <Card className="border border-indigo-200 bg-indigo-50">
                <CardHeader className="pb-3 border-b border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-900">📅 Timeline & Delivery</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Start Date</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.startDate ? format(new Date(viewSite.startDate), "MMM d, yyyy") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">End Date</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.endDate ? format(new Date(viewSite.endDate), "MMM d, yyyy") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">PO Date</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.poDate ? format(new Date(viewSite.poDate), "MMM d, yyyy") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Duration (Days)</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.projectDurationDays || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Remarks Section */}
              {(viewSite.remarksHistory?.length || viewSite.remarks) ? (
                <Card className="border border-cyan-200 bg-cyan-50">
                  <CardHeader className="pb-3 border-b border-cyan-200">
                    <h3 className="text-lg font-semibold text-gray-900">Remarks History</h3>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {(viewSite.remarksHistory || [{ text: viewSite.remarks, authorName: "Previous entry", createdAt: viewSite.updated_at }])
                      .slice()
                      .reverse()
                      .map((remark: any, index: number) => (
                        <div key={`${remark.createdAt || "remark"}-${index}`} className="rounded-md border border-cyan-200 bg-white/60 p-3">
                          <p className="text-base text-gray-900 whitespace-pre-wrap">{remark.text}</p>
                          <p className="mt-2 text-xs text-gray-600">
                            Added by {remark.authorName || "Unknown user"}
                            {remark.createdAt && ` • ${format(new Date(remark.createdAt), "MMM d, yyyy HH:mm")}`}
                          </p>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ) : null}

              {/* Last Updated */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-600">
                  ⏰ Last Updated: {viewSite.updated_at ? format(new Date(viewSite.updated_at), "MMM d, yyyy HH:mm") : "—"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <BulkImportProjects
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        projectId={id}
      />

      {/* Company Profile Selector Dialog */}
      <ProjectProfileSelector
        open={showProfileSelector}
        onOpenChange={setShowProfileSelector}
        onSelect={(profileId) => {
          if (siteForDownload) {
            downloadProjectSitePDF(siteForDownload, profileId);
          }
        }}
      />

      {/* Create Certificate Dialog */}
      <Dialog open={showCertificateDialog} onOpenChange={setShowCertificateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900">Create Deployment Certificate</DialogTitle>
            <p className="text-sm text-gray-600">Complete the certificate details below before creating the PDF.</p>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Selected Site</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{selectedSiteForCert?.millName || "—"}</p>
              </div>
              <MapPin className="h-5 w-5 flex-shrink-0 text-blue-600" />
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Certificate Setup</h3>
                <p className="text-xs text-gray-500">Choose the branding and certificate format.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-semibold text-gray-900">Company Profile</Label>
                <Select value={selectedCompanyProfile} onValueChange={setSelectedCompanyProfile}>
                  <SelectTrigger className="border border-gray-300">
                    <SelectValue placeholder="Select company profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyProfiles.length === 0 ? (
                      <div className="p-2 text-sm text-gray-600">No company profiles available</div>
                    ) : (
                      companyProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id || ""}>
                          {profile.company_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-gray-900">Certificate Type</Label>
                <Select value={certificateFormData.certificate_type} onValueChange={(value) => setCertificateFormData({ ...certificateFormData, certificate_type: value })}>
                  <SelectTrigger className="border border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issm">ISSM</SelectItem>
                    <SelectItem value="obsidian">Obsidian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Client Details</h3>
                <p className="text-xs text-gray-500">Information shown for the client representative.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-name" className="font-semibold text-gray-900">Client Name</Label>
                  <Input
                    id="client-name"
                    value={certificateFormData.client_name}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, client_name: e.target.value })}
                    className="border border-gray-300"
                    placeholder="Enter client name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-designation" className="font-semibold text-gray-900">Client Designation</Label>
                  <Input
                    id="client-designation"
                    value={certificateFormData.client_designation}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, client_designation: e.target.value })}
                    className="border border-gray-300"
                    placeholder="e.g., Manager, Director"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-date" className="text-sm font-semibold text-gray-900">Client Date</Label>
                  <Input
                    id="client-date"
                    type="date"
                    value={certificateFormData.client_date}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, client_date: e.target.value })}
                    className="border border-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deployment-date" className="font-semibold text-gray-900">Deployment Date</Label>
                  <Input
                    id="deployment-date"
                    type="date"
                    value={certificateFormData.deployment_date}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, deployment_date: e.target.value })}
                    className="border border-gray-300"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Deployment Sign-off</h3>
                <p className="text-xs text-gray-500">Add the responsible team member and sign-off date.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="issm-name" className="text-sm font-semibold text-gray-900">
                    {certificateFormData.certificate_type === "obsidian" ? "Obsidian Name" : certificateFormData.certificate_type === "issm" ? "ISSM Name" : "Uqaab Name"}
                  </Label>
                  <Input
                    id="issm-name"
                    value={certificateFormData.issm_name}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, issm_name: e.target.value })}
                    className="border border-gray-300"
                    placeholder={certificateFormData.certificate_type === "obsidian" ? "Enter Obsidian name" : certificateFormData.certificate_type === "issm" ? "Enter ISSM name" : "Enter Uqaab name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issm-designation" className="text-sm font-semibold text-gray-900">
                    {certificateFormData.certificate_type === "obsidian" ? "Obsidian Designation" : certificateFormData.certificate_type === "issm" ? "ISSM Designation" : "Uqaab Designation"}
                  </Label>
                  <Input
                    id="issm-designation"
                    value={certificateFormData.issm_designation}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, issm_designation: e.target.value })}
                    className="border border-gray-300"
                    placeholder="e.g., Engineer, Supervisor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issm-date" className="text-sm font-semibold text-gray-900">
                    {certificateFormData.certificate_type === "obsidian" ? "Obsidian Date" : certificateFormData.certificate_type === "issm" ? "ISSM Date" : "Uqaab Date"}
                  </Label>
                  <Input
                    id="issm-date"
                    type="date"
                    value={certificateFormData.issm_date}
                    onChange={(e) => setCertificateFormData({ ...certificateFormData, issm_date: e.target.value })}
                    className="border border-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCertificateDialog(false);
                setCertificateFormData(getDefaultFormData());
                setSelectedSiteForCert(null);
              }}
              className="border-gray-300 hover:bg-gray-50"
              disabled={createCertificateMutation.isPending || isDownloadingCert || isSavingCert}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsSavingCert(true);
                if (selectedSiteForCert?.id) {
                  saveCertificateFormData(selectedSiteForCert.id, certificateFormData);
                }
                setIsSavingCert(false);
                toast.success("Certificate form saved successfully");
              }}
              variant="outline"
              className="border-blue-300 hover:bg-blue-50 text-blue-600"
              disabled={createCertificateMutation.isPending || isDownloadingCert || isSavingCert}
            >
              {isSavingCert ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Form"
              )}
            </Button>
            <Button
              onClick={() => createCertificateMutation.mutate(certificateFormData)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={createCertificateMutation.isPending || isDownloadingCert || isSavingCert || !selectedCompanyProfile}
            >
              {createCertificateMutation.isPending || isDownloadingCert ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isDownloadingCert ? "Downloading..." : "Creating..."}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Create & Download
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
