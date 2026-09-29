import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sslSubProjectsAPI, type SslSubProject } from "@/integrations/firebase/sslSubProjectsAPI";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeSslProject, useRealtimeSslSubProjects } from "@/hooks/useSslProjectTracking";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { BulkImportSslSubProjects } from "@/components/BulkImportSslSubProjects";
import { ProjectProfileSelector } from "@/components/ProjectProfileSelector";
import { companyProfileAPI, DeploymentCertificate } from "@/integrations/firebase/firestore";
import { downloadDeploymentCertificatePDF } from "@/lib/pdfGenerator";
import { sslDeploymentCertificateAPI } from "@/integrations/firebase/sslDeploymentCertificateAPI";

const SslSubProjectFormPreview = lazy(() => import("@/pages/SslSubProjectForm"));

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

const getVisitType = (site: SslSubProject) => {
  const report = site.maintenanceReport;
  if (!report?.visitType) return "";
  return report.visitType === "Other" ? report.otherVisitType || "Other" : report.visitType;
};

const getSlaYear = (site: SslSubProject) =>
  site.maintenanceReport?.slaYear || site.maintenanceReport?.documentDate?.slice(0, 4) || "";

const getOverallVisitStatus = (site: SslSubProject) => site.maintenanceReport?.overallStatus || "";

const needsVisitFollowUp = (site: SslSubProject) => {
  const status = getOverallVisitStatus(site).toLowerCase();
  return status.includes("minor issues") || status.includes("action required") || status.includes("major issue");
};

const getCertificateFormStorageKey = (siteId: string) => `ssl_certificate_form_${siteId}`;

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

export default function SslProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [viewSite, setViewSite] = useState<any>(null);
  const [selectedVisitForPreview, setSelectedVisitForPreview] = useState<SslSubProject | null>(null);
  const [viewedSiteIds, setViewedSiteIds] = useState<Set<string>>(() => {
    // Load viewed sites from localStorage on mount
    const storageKey = `viewed_ssl_sub_projects_${id}_${appUser?.id}`;
    const stored = localStorage.getItem(storageKey);
    return new Set(stored ? JSON.parse(stored) : []);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisitType, setFilterVisitType] = useState("");
  const [filterSlaYear, setFilterSlaYear] = useState("");
  const [filterOverallStatus, setFilterOverallStatus] = useState("");
  const [filterCity, setFilterCity] = useState("");
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
    const storageKey = `viewed_ssl_sub_projects_${id}_${appUser?.id}`;
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
  } = useRealtimeSslProject(id);

  const {
    data: sites = [],
    isLoading: sitesLoading,
    error: sitesError,
    isConnected: sitesConnected,
  } = useRealtimeSslSubProjects(id);

  const filteredSites = useMemo(
    () => sites
      .filter((site) => {
        const report = site.maintenanceReport;
        const searchValue = searchTerm.trim().toLowerCase();
        const matchesSearch = !searchValue || [
          report?.formNumber,
          report?.documentDate,
          site.millName,
          site.unitNo,
          site.city,
          site.district,
          getVisitType(site),
          report?.visitNumber,
          getSlaYear(site),
          getOverallVisitStatus(site),
        ].filter(Boolean).some((value) => value!.toLowerCase().includes(searchValue));
        const matchesVisitType = !filterVisitType || getVisitType(site) === filterVisitType;
        const matchesSlaYear = !filterSlaYear || getSlaYear(site) === filterSlaYear;
        const matchesOverallStatus = !filterOverallStatus || getOverallVisitStatus(site) === filterOverallStatus;
        const matchesCity = !filterCity || (site.city || "").toLowerCase() === filterCity.toLowerCase();

        return matchesSearch && matchesVisitType && matchesSlaYear && matchesOverallStatus && matchesCity;
      })
      .sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      }),
    [sites, searchTerm, filterVisitType, filterSlaYear, filterOverallStatus, filterCity]
  );

  const { uniqueCities, uniqueVisitTypes, uniqueSlaYears, uniqueOverallStatuses } = useMemo(() => ({
    uniqueCities: Array.from(new Set(sites.map((site) => site.city).filter(Boolean))),
    uniqueVisitTypes: Array.from(new Set(sites.map(getVisitType).filter(Boolean))).sort(),
    uniqueSlaYears: Array.from(new Set(sites.map(getSlaYear).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    uniqueOverallStatuses: Array.from(new Set(sites.map(getOverallVisitStatus).filter(Boolean))).sort(),
  }), [sites]);

  const hasActiveFilters = useMemo(
    () => Boolean(searchTerm || filterVisitType || filterSlaYear || filterOverallStatus || filterCity),
    [searchTerm, filterVisitType, filterSlaYear, filterOverallStatus, filterCity]
  );

  const deleteSiteMutation = useMutation({
    mutationFn: (siteId: string) => sslSubProjectsAPI.delete(siteId),
    onSuccess: () => {
      // Real-time listener will automatically update the UI
      // No need to invalidate queries
      toast.success("Sub Project deleted successfully");
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      const errorMessage =
        error?.code === "permission-denied"
          ? "You don't have permission to delete this sub project"
          : error?.message || "Failed to delete sub project";
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
    if (confirm("Are you sure you want to delete this sub project?")) {
      deleteSiteMutation.mutate(siteId);
    }
  };

  const duplicateSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const siteToClone = sites.find(s => s.id === siteId);
      if (!siteToClone) throw new Error("Sub project not found");

      const newSiteData = { ...siteToClone };
      delete newSiteData.id;
      delete newSiteData.created_at;
      delete newSiteData.updated_at;
      delete newSiteData.created_by;

      if (siteToClone.maintenanceReport) {
        return sslSubProjectsAPI.createMaintenanceVisit({
          ...newSiteData,
          project_id: id,
          maintenanceReport: { ...siteToClone.maintenanceReport, formNumber: "" },
        });
      }

      return sslSubProjectsAPI.create({ ...newSiteData, project_id: id });
    },
    onSuccess: () => {
      toast.success("Sub Project duplicated successfully");
    },
    onError: (error: any) => {
      console.error("Duplicate error:", error);
      const errorMessage = error?.message || "Failed to duplicate sub project";
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

  const openVisitFormForPrint = (site: SslSubProject) => {
    if (!site.id) return;
    window.open(`/sla-sub-projects/${site.id}/${id}?print=1`, "_blank", "noopener,noreferrer");
  };

  const handleViewVisit = (site: SslSubProject) => {
    if (site.id) setViewedSiteIds((previous) => new Set(previous).add(site.id!));
    if (site.maintenanceReport) {
      setSelectedVisitForPreview(site);
    } else {
      setViewSite(site);
    }
  };

  const handleDownloadVisit = (site: SslSubProject) => {
    if (site.maintenanceReport) {
      openVisitFormForPrint(site);
    } else {
      setSiteForDownload(site);
      setShowProfileSelector(true);
    }
  };

  const createCertificateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedSiteForCert?.id) throw new Error("No site selected");
      const { create } = sslDeploymentCertificateAPI;

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

      return create(certData);
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

  const getVisitStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes("fully operational")) return "bg-emerald-100 text-emerald-800";
    if (normalized.includes("minor issues")) return "bg-blue-100 text-blue-800";
    if (normalized.includes("major issue")) return "bg-rose-100 text-rose-800";
    if (normalized.includes("action required") || normalized.includes("additional work")) return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const visitStats = {
    total: filteredSites.length,
    preventive: filteredSites.filter((site) => getVisitType(site) === "Preventive").length,
    corrective: filteredSites.filter((site) => getVisitType(site) === "Corrective").length,
    followUp: filteredSites.filter(needsVisitFollowUp).length,
  };

  return (
    <div className="space-y-6">
      {/* Real-time Status Display */}
      <RealtimeStatusIndicator
        isConnected={projectConnected && sitesConnected}
        error={projectError || sitesError}
        isLoading={projectLoading || sitesLoading}
      />

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/80 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/sla")} className="mt-1 shrink-0 border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Back to SLA projects">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">SLA Maintenance Visits</p>
              {projectLoading ? (
                <div className="mt-2 h-8 w-48 animate-pulse rounded bg-slate-200" />
              ) : (
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{project?.name ?? "Project"}</h1>
              )}
              {project?.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{project.description}</p>}
            </div>
          </div>
          {isUserAssigned && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2 border-slate-300 bg-white" size="sm">
                <FileUp className="h-4 w-4" />Bulk Import
              </Button>
              <Button onClick={() => navigate(`/sla-sub-projects/new/${id}`)} className="gap-2 bg-[#124c78] text-white shadow-sm hover:bg-[#0d3d62]" size="sm">
                <Plus className="h-4 w-4" />New SLA Visit
              </Button>
            </div>
          )}
        </div>
      </section>

      {!isUserAssigned && (
        <Card className="border border-amber-300 bg-amber-50">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
              <span>⚠️</span> You don't have permission to edit this project. Contact an administrator for access.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        {[
          { label: "Total Visits", value: visitStats.total, icon: FileText, tone: "blue" },
          { label: "Preventive", value: visitStats.preventive, icon: CheckCircle, tone: "green" },
          { label: "Corrective", value: visitStats.corrective, icon: Zap, tone: "amber" },
          { label: "Needs Follow-up", value: visitStats.followUp, icon: Clock, tone: "rose" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
              </div>
              <div className={`rounded-xl p-3 ${tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub Projects List */}
      {sitesLoading ? (
        <DataLoadingSkeleton />
      ) : sites && sites.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Maintenance Visits <span className="text-slate-500">({filteredSites.length})</span></h2>
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
                    Showing <span className="font-semibold text-slate-900">{filteredSites.length}</span> visit{filteredSites.length === 1 ? "" : "s"}
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterVisitType("");
                      setFilterSlaYear("");
                      setFilterOverallStatus("");
                      setFilterCity("");
                    }}
                    className="border-gray-300 hover:bg-gray-50"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Search visits</Label>
                  <Input placeholder="ID, mill, location, or visit no." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Visit Type</Label>
                  <Select value={filterVisitType || "all"} onValueChange={(value) => setFilterVisitType(value === "all" ? "" : value)}>
                    <SelectTrigger className="border-slate-200 bg-white"><SelectValue placeholder="All visit types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All visit types</SelectItem>
                      {uniqueVisitTypes.map((visitType) => <SelectItem key={visitType} value={visitType}>{visitType}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">SLA Year</Label>
                  <Select value={filterSlaYear || "all"} onValueChange={(value) => setFilterSlaYear(value === "all" ? "" : value)}>
                    <SelectTrigger className="border-slate-200 bg-white"><SelectValue placeholder="All years" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {uniqueSlaYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">System Status</Label>
                  <Select value={filterOverallStatus || "all"} onValueChange={(value) => setFilterOverallStatus(value === "all" ? "" : value)}>
                    <SelectTrigger className="border-slate-200 bg-white"><SelectValue placeholder="All statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {uniqueOverallStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Location</Label>
                  <Select value={filterCity || "all"} onValueChange={(value) => setFilterCity(value === "all" ? "" : value)}>
                    <SelectTrigger className="border-slate-200 bg-white"><SelectValue placeholder="All locations" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {uniqueCities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <Table className="min-w-[1050px]">
              <TableHeader className="bg-slate-50">
                <TableRow className="border-b border-slate-200 hover:bg-slate-50">
                  <TableHead className="h-12 text-xs font-semibold uppercase tracking-wide text-slate-500">ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mill / Unit</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visit Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visit No. / Year</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">System Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.length ? filteredSites.map((site) => {
                  const report = site.maintenanceReport;
                  const recent = isRecentlyModified(site, viewedSiteIds, appUser?.id);
                  const visitType = getVisitType(site);
                  const visitStatus = getOverallVisitStatus(site);

                  return (
                    <TableRow key={site.id} className={`border-b border-slate-100 transition-colors hover:bg-blue-50/50 ${recent ? "bg-blue-50/40" : ""}`}>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#124c78]">{report?.formNumber || "—"}</span>
                          {getUpdateStatus(site, viewedSiteIds, appUser?.id) && <Badge className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">New</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">{report?.documentDate ? format(new Date(report.documentDate), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900">{site.millName || "—"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Unit {site.unitNo || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        <p>{site.city || "—"}</p>
                        {site.district && <p className="mt-0.5 text-xs text-slate-500">{site.district}</p>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="border-slate-200 bg-slate-50 font-medium text-slate-700">{visitType || "Not recorded"}</Badge></TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-800">{report?.visitNumber || "—"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Year {getSlaYear(site) || "—"}</p>
                      </TableCell>
                      <TableCell>
                        {visitStatus ? <Badge className={`${getVisitStatusColor(visitStatus)} max-w-56 whitespace-normal`}>{visitStatus}</Badge> : <span className="text-sm text-slate-400">Not recorded</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" aria-label="View SLA form" title="View SLA form" onClick={() => handleViewVisit(site)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-700" aria-label="Download SLA form PDF" title="Download SLA form PDF" onClick={() => handleDownloadVisit(site)}><Download className="h-4 w-4" /></Button>
                          {isUserAssigned && <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" aria-label="Edit visit" title="Edit visit" onClick={() => navigate(`/sla-sub-projects/${site.id}/${id}`)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-700" aria-label="Duplicate visit" title="Duplicate visit" onClick={() => handleDuplicateSite(site.id!)} disabled={duplicateSiteMutation.isPending}><Copy className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label="Delete visit" title="Delete visit" onClick={() => handleDeleteSite(site.id!)}><Trash2 className="h-4 w-4" /></Button>
                          </>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">No visits match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredSites.length ? filteredSites.map((site) => {
              const report = site.maintenanceReport;
              const visitStatus = getOverallVisitStatus(site);
              const recent = isRecentlyModified(site, viewedSiteIds, appUser?.id);

              return (
                <Card key={site.id} className={`border-slate-200 shadow-sm ${recent ? "border-blue-200 bg-blue-50/40" : ""}`}>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#124c78]">{report?.formNumber || "SLA visit"}</span>
                          {getUpdateStatus(site, viewedSiteIds, appUser?.id) && <Badge className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">New</Badge>}
                        </div>
                        <h3 className="mt-1 truncate font-semibold text-slate-900">{site.millName || "—"}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{site.unitNo ? `Unit ${site.unitNo}` : "Unit not specified"}</p>
                      </div>
                      {visitStatus ? <Badge className={`${getVisitStatusColor(visitStatus)} max-w-40 whitespace-normal text-center`}>{visitStatus}</Badge> : <Badge variant="outline" className="text-slate-500">Not recorded</Badge>}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date</p><p className="mt-1 text-sm font-medium text-slate-800">{report?.documentDate ? format(new Date(report.documentDate), "MMM d, yyyy") : "—"}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visit Type</p><p className="mt-1 text-sm font-medium text-slate-800">{getVisitType(site) || "—"}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Location</p><p className="mt-1 text-sm font-medium text-slate-800">{[site.city, site.district].filter(Boolean).join(", ") || "—"}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visit No. / Year</p><p className="mt-1 text-sm font-medium text-slate-800">{report?.visitNumber || "—"} / {getSlaYear(site) || "—"}</p></div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewVisit(site)}><Eye className="mr-1.5 h-4 w-4" />View Form</Button>
                      <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Download SLA form PDF" title="Download SLA form PDF" onClick={() => handleDownloadVisit(site)}><Download className="h-4 w-4" /></Button>
                      {isUserAssigned && <>
                        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Edit visit" title="Edit visit" onClick={() => navigate(`/sla-sub-projects/${site.id}/${id}`)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Duplicate visit" title="Duplicate visit" onClick={() => handleDuplicateSite(site.id!)} disabled={duplicateSiteMutation.isPending}><Copy className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 text-red-600" aria-label="Delete visit" title="Delete visit" onClick={() => handleDeleteSite(site.id!)}><Trash2 className="h-4 w-4" /></Button>
                      </>}
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-900">No visits match these filters</p>
                  <p className="mt-1 text-sm text-slate-500">Adjust or clear your filters to see visits.</p>
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
            <p className="text-gray-900 font-semibold mb-2">No maintenance visits yet</p>
            <p className="text-gray-600 text-sm mb-6">Create the first SLA visit for this project to get started.</p>
            {isUserAssigned && (
              <Button
                onClick={() => navigate(`/sla-sub-projects/new/${id}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create SLA Visit
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedVisitForPreview} onOpenChange={(open) => !open && setSelectedVisitForPreview(null)}>
        <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-[1500px] overflow-y-auto p-3 sm:w-[calc(100vw-2rem)] sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>Preview SLA maintenance form {selectedVisitForPreview?.maintenanceReport?.formNumber || ""}</DialogTitle>
          </DialogHeader>
          {selectedVisitForPreview?.id && (
            <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading SLA visit form…</div>}>
              <SslSubProjectFormPreview
                siteIdOverride={selectedVisitForPreview.id}
                projectIdOverride={id}
                previewOnly
                onClosePreview={() => setSelectedVisitForPreview(null)}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* View Sub Project Details Modal */}
      <Dialog open={!!viewSite} onOpenChange={(open) => !open && setViewSite(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900">{viewSite?.millName || "Sub Project Details"}</DialogTitle>
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
                    <h3 className="text-lg font-semibold text-gray-900">📄 Sub Project Document</h3>
                  </CardHeader>
                  <CardContent className="pt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Uploaded File</p>
                      <p className="text-base font-semibold text-gray-900 break-all">{viewSite.siteDocumentName || "Sub project document"}</p>
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
                      <p className="text-xs font-semibold text-gray-600 uppercase">Supplier Name</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.supplierName || "—"}</p>
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
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">POC Name</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.pocName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">POC Phone</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.pocPhone || "—"}</p>
                    </div>
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
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Hardware Delivery Status</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{viewSite.hardwareDeliveryStatus || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Remarks Section */}
              {viewSite.remarks && (
                <Card className="border border-cyan-200 bg-cyan-50">
                  <CardHeader className="pb-3 border-b border-cyan-200">
                    <h3 className="text-lg font-semibold text-gray-900">💬 Remarks</h3>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-base text-gray-900 whitespace-pre-wrap">{viewSite.remarks}</p>
                  </CardContent>
                </Card>
              )}

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
      <BulkImportSslSubProjects
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900">Create Deployment Certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-gray-600">Sub Project: <span className="text-gray-900">{selectedSiteForCert?.millName}</span></p>
            </div>

            <div className="space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-date" className="font-semibold text-gray-900">Client Date</Label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issm-name" className="font-semibold text-gray-900">
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
                  <Label htmlFor="issm-designation" className="font-semibold text-gray-900">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="issm-date" className="font-semibold text-gray-900">
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
