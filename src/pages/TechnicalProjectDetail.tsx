import { useState, useEffect, useRef, useMemo, memo, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { technicalProjectsAPI } from "@/integrations/firebase/technicalProjectsAPI";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ClickableAnydeskId from "@/components/ClickableAnydeskId";
import ClickableRustdeskId from "@/components/ClickableRustdeskId";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Eye,
  Download,
  Upload,
  X,
  Search,
  FolderOpen,
  Users,
  ShieldCheck,
  Monitor,
  Network,
  Camera,
  ClipboardCheck,
  FileText,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { exportSiteDataToExcel } from "@/lib/excelExport";
import { useAllIssues, useIssuesBySite, type IssueWithDuration } from "@/hooks/useIssues";
import AddIssueDialog from "@/components/AddIssueDialog";
import IssuesTable from "@/components/IssuesTable";
import StatusUpdateDialog from "@/components/StatusUpdateDialog";
import StatusHistoryPanel from "@/components/StatusHistoryPanel";
import { companyProfileAPI, deploymentCertificateAPI, DeploymentCertificate } from "@/integrations/firebase/firestore";
import { downloadDeploymentCertificatePDF } from "@/lib/pdfGenerator";
import { BulkImportSites } from "@/components/BulkImportSites";

const getDisplayValue = (value: ReactNode) => {
  if (value === undefined || value === null || value === "") return "—";
  return value;
};

const DetailSection = memo(({
  title,
  icon,
  accentClass,
  children,
}: {
  title: string;
  icon: ReactNode;
  accentClass: string;
  children: ReactNode;
}) => (
  <Card className="overflow-hidden border border-slate-200 shadow-sm">
    <CardHeader className={`border-b ${accentClass}`}>
      <CardTitle className="flex items-center gap-3 text-base text-slate-900">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          {icon}
        </span>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      <div className="divide-y divide-slate-100">{children}</div>
    </CardContent>
  </Card>
));

DetailSection.displayName = "DetailSection";

const DetailRow = memo(({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) => (
  <div className="grid gap-2 px-4 py-3 md:grid-cols-[220px_1fr] md:gap-4 md:px-5">
    <div className="text-sm font-medium text-slate-500">{label}</div>
    <div
      className={`text-sm text-slate-900 ${mono ? "font-mono" : ""} ${highlight ? "font-semibold text-blue-700" : ""}`}
    >
      {getDisplayValue(value)}
    </div>
  </div>
));

DetailRow.displayName = "DetailRow";

export default function TechnicalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState<SiteDetails | null>(null);
  const [issuesSiteId, setIssuesSiteId] = useState<string | null>(null);
  const [showAddIssueDialog, setShowAddIssueDialog] = useState(false);
  const [selectedIssueForStatus, setSelectedIssueForStatus] = useState<IssueWithDuration | null>(null);
  const [showStatusUpdateDialog, setShowStatusUpdateDialog] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [selectedSiteForCert, setSelectedSiteForCert] = useState<SiteDetails | null>(null);
  const [companyProfiles, setCompanyProfiles] = useState<any[]>([]);
  const [selectedCompanyProfile, setSelectedCompanyProfile] = useState<string>("");
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const [isSavingCert, setIsSavingCert] = useState(false);

  const [project, setProject] = useState<any>(null);
  const [sites, setSites] = useState<SiteDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);

  // Load issues for the current site
  const { issues, isLoading: issuesLoading } = useIssuesBySite(issuesSiteId || "");
  const { issues: allIssues } = useAllIssues();

  const projectUnsubRef = useRef<(() => void) | null>(null);
  const sitesUnsubRef = useRef<(() => void) | null>(null);

  const getDefaultCertFormData = () => {
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

  const [certificateFormData, setCertificateFormData] = useState(getDefaultCertFormData());

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);

    projectUnsubRef.current = technicalProjectsAPI.subscribeById(
      id,
      (proj) => {
        if (proj) {
          const hasAccess = isAdmin || (proj.assignedUsers || []).includes(appUser?.id || "");
          if (!hasAccess) {
            toast.error("You don't have access to this project");
            navigate("/sites");
            return;
          }
          setProject(proj);
        } else {
          toast.error("Project not found");
          navigate("/sites");
        }
      },
      (error) => {
        console.error("Failed to load project:", error);
        toast.error("Failed to load project");
        navigate("/sites");
      }
    );

    sitesUnsubRef.current = siteDetailsAPI.subscribeByProjectId(
      id,
      (loadedSites) => {
        setSites(loadedSites);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load sites:", error);
        setIsLoading(false);
      }
    );

    return () => {
      projectUnsubRef.current?.();
      sitesUnsubRef.current?.();
    };
  }, [id, isAdmin, appUser, navigate]);

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

  const deleteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      await siteDetailsAPI.delete(siteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-details"] });
      toast.success("Site deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete site");
    },
  });

  const handleDeleteSite = (siteId: string) => {
    if (!window.confirm("Are you sure you want to delete this site?")) {
      return;
    }
    deleteMutation.mutate(siteId);
  };

  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      (site.millName && site.millName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.millLocation && site.millLocation.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.pocName && site.pocName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.supervisorName && site.supervisorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.anydeskId && site.anydeskId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.anydeskId2 && site.anydeskId2.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.rustdeskId && site.rustdeskId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (site.rustdeskId2 && site.rustdeskId2.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredSites.length / itemsPerPage);
  const startIdx = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIdx = itemsPerPage === -1 ? filteredSites.length : startIdx + itemsPerPage;
  const paginatedSites = filteredSites.slice(startIdx, endIdx);

  const openIssueCountsBySite = useMemo(() => {
    return allIssues.reduce<Record<string, number>>((counts, issue) => {
      if (issue.status !== "Resolved" && issue.site_id) {
        counts[issue.site_id] = (counts[issue.site_id] || 0) + 1;
      }
      return counts;
    }, {});
  }, [allIssues]);

  const getIssuesButtonTitle = (site: SiteDetails) => {
    const openIssueCount = site.id ? openIssueCountsBySite[site.id] || 0 : 0;
    return openIssueCount > 0
      ? `View Issues (${openIssueCount} pending)`
      : "View Issues (no pending issues)";
  };

  const renderChecklistBadge = (value?: boolean) => (
    <Badge
      className={value ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}
    >
      {value ? "Yes" : "No"}
    </Badge>
  );

  const remoteReadySites = sites.filter(
    (site) => site.anydeskId || site.anydeskId2 || site.rustdeskId || site.rustdeskId2 || site.remoteanydeskAccountName || site.tailscaleIp
  ).length;
  const documentedSites = sites.filter(
    (site) => site.hardwareCompleted || site.completionCertificate || site.roiCreated
  ).length;
  const assignedContacts = sites.filter((site) => site.pocName || site.supervisorName).length;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/sites")}
                  className="h-10 w-10 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Badge className="border border-white/25 bg-white/15 text-white hover:bg-white/15">
                  Technical Details
                </Badge>
              </div>

              <div>
                <h1 className="text-3xl font-bold md:text-4xl">{project.name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-50 md:text-base">
                  {project.description || "Track all site configuration, credentials, contacts, and readiness from one place."}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:min-w-[280px] lg:flex-col">
              {sites.length > 0 && (
                <Button
                  onClick={() => exportSiteDataToExcel(sites)}
                  variant="outline"
                  className="w-full gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
                >
                  <Download className="h-4 w-4" /> Download Sites
                </Button>
              )}
              <Button
                onClick={() => setShowBulkImportDialog(true)}
                variant="outline"
                className="w-full gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
              >
                <Upload className="h-4 w-4" /> Import Sites
              </Button>
              <Button
                onClick={() => navigate(`/technical-projects/${id}/sites/new`)}
                className="w-full gap-2 bg-white text-blue-700 shadow-md hover:bg-blue-50 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> New Site
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Sites</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{sites.length}</p>
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
                <p className="text-sm font-medium text-slate-500">Contacts Added</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{assignedContacts}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Remote Ready</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{remoteReadySites}</p>
              </div>
              <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Checklist Started</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{documentedSites}</p>
              </div>
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
                <ClipboardCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Search site records</p>
              <p className="text-sm text-slate-500">Find data by mill name, location, supervisor, or AnyDesk ID.</p>
            </div>
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by mill name, location, supervisor, or anydesk ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 sm:h-12 rounded-xl border-slate-200 pl-12 pr-4 focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50/50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">Site Data Overview</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {filteredSites.length} site{filteredSites.length !== 1 ? "s" : ""} visible
              </p>
            </div>
            <Badge className="w-fit bg-blue-100 text-blue-700 hover:bg-blue-100">
              Live project records
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSites.length > 0 ? (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {paginatedSites.map((site) => (
                  <Card key={site.id} className="border border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{site.millName || "—"}</div>
                              <div className="text-xs text-slate-500">{site.millLocation || "—"}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-medium text-slate-500">POC</p>
                              <p className="mt-1 font-medium text-slate-900">{site.pocName || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500">Supervisor</p>
                              <p className="mt-1 text-slate-700">{site.supervisorName || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500">Anydesk</p>
                              <div className="mt-1 space-y-1">
                                <div className="text-xs text-slate-400">1:</div>
                                <ClickableAnydeskId anydeskId={site.anydeskId} />
                                {(site.anydeskId2) && (
                                  <>
                                    <div className="text-xs text-slate-400">2:</div>
                                    <ClickableAnydeskId anydeskId={site.anydeskId2} />
                                  </>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500">Rustdesk</p>
                              <div className="mt-1 space-y-1">
                                <div className="text-xs text-slate-400">1:</div>
                                <ClickableRustdeskId rustdeskId={site.rustdeskId} />
                                {(site.rustdeskId2) && (
                                  <>
                                    <div className="text-xs text-slate-400">2:</div>
                                    <ClickableRustdeskId rustdeskId={site.rustdeskId2} />
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => setSelectedSite(site)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setSelectedSiteForCert(site);
                            setCertificateFormData(getDefaultCertFormData());
                            setShowCertificateDialog(true);
                          }}
                          title="Add Deployment Certificate"
                        >
                          <BadgeCheck className="h-4 w-4" />
                        </Button>
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-10 rounded-lg border border-amber-100 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                            onClick={() => setIssuesSiteId(site.id!)}
                            title={getIssuesButtonTitle(site)}
                            aria-label={getIssuesButtonTitle(site)}
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                          {(site.id ? openIssueCountsBySite[site.id] || 0 : 0) > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold p-0 hover:bg-red-600">
                              {site.id ? openIssueCountsBySite[site.id] || 0 : 0}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 rounded-lg border border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => navigate(`/technical-projects/${id}/sites/${site.id}`)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="col-span-2 h-10 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteSite(site.id!)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                      <TableHead className="font-semibold text-slate-600">Mill Name</TableHead>
                      <TableHead className="font-semibold text-slate-600">Location</TableHead>
                      <TableHead className="font-semibold text-slate-600">POC Name</TableHead>
                      <TableHead className="font-semibold text-slate-600">Supervisor</TableHead>
                      <TableHead className="font-semibold text-slate-600">Anydesk ID</TableHead>
                      <TableHead className="font-semibold text-slate-600">Rustdesk ID</TableHead>
                      <TableHead className="font-semibold text-slate-600">Updated</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSites.map((site) => (
                      <TableRow key={site.id} className="transition-colors hover:bg-blue-50/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{site.millName || "—"}</div>
                              {site.unitNo && (
                                <div className="text-xs text-slate-500">Unit {site.unitNo}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{site.millLocation || "—"}</TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900">{site.pocName || "—"}</div>
                            {site.pocContact && (
                              <div className="text-xs text-slate-500">{site.pocContact}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{site.supervisorName || "—"}</TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-600">AnyDesk 1</div>
                              <ClickableAnydeskId anydeskId={site.anydeskId} />
                              {site.anydeskPassword && (
                                <div className="font-mono text-xs text-slate-500">{site.anydeskPassword}</div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-600">AnyDesk 2</div>
                              <ClickableAnydeskId anydeskId={site.anydeskId2} />
                              {site.anydeskPassword2 && (
                                <div className="font-mono text-xs text-slate-500">{site.anydeskPassword2}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-600">RustDesk 1</div>
                              <ClickableRustdeskId rustdeskId={site.rustdeskId} />
                              {site.rustdeskPassword && (
                                <div className="font-mono text-xs text-slate-500">{site.rustdeskPassword}</div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-600">RustDesk 2</div>
                              <ClickableRustdeskId rustdeskId={site.rustdeskId2} />
                              {site.rustdeskPassword2 && (
                                <div className="font-mono text-xs text-slate-500">{site.rustdeskPassword2}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {site.updated_at ? format(new Date(site.updated_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="grid grid-cols-2 gap-2 w-fit justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => setSelectedSite(site)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                              onClick={() => {
                                setSelectedSiteForCert(site);
                                setCertificateFormData(getDefaultCertFormData());
                                setShowCertificateDialog(true);
                              }}
                              title="Add Deployment Certificate"
                            >
                              <BadgeCheck className="h-4 w-4" />
                            </Button>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-9 rounded-lg border border-amber-100 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                onClick={() => setIssuesSiteId(site.id!)}
                                title={getIssuesButtonTitle(site)}
                                aria-label={getIssuesButtonTitle(site)}
                              >
                                <AlertCircle className="h-4 w-4" />
                              </Button>
                              {(site.id ? openIssueCountsBySite[site.id] || 0 : 0) > 0 && (
                                <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold p-0 hover:bg-red-600">
                                  {site.id ? openIssueCountsBySite[site.id] || 0 : 0}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-lg border border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => navigate(`/technical-projects/${id}/sites/${site.id}`)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="col-span-2 h-9 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDeleteSite(site.id!)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col gap-4 border-t border-slate-200 p-4 md:p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Items per page:</span>
                  <select
                    value={itemsPerPage === -1 ? "all" : itemsPerPage}
                    onChange={(e) => {
                      const value = e.target.value;
                      setItemsPerPage(value === "all" ? -1 : parseInt(value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 md:gap-6">
                  <span className="text-sm text-slate-600">
                    Showing {itemsPerPage === -1 ? filteredSites.length : Math.min(startIdx + 1, filteredSites.length)}–{itemsPerPage === -1 ? filteredSites.length : Math.min(endIdx, filteredSites.length)} of {filteredSites.length}
                  </span>

                  {itemsPerPage !== -1 && totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="h-9 min-w-9 p-0"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
                <MapPin className="h-10 w-10" />
              </div>
              <p className="text-base font-medium text-slate-700">
                {searchTerm ? "No sites match your search" : "No sites yet. Create your first one!"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add site details to make this project dashboard more useful.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSite && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-white/20 bg-white/15 text-white hover:bg-white/15">
                      Site Details
                    </Badge>
                    {selectedSite.millLocation && (
                      <Badge className="border border-white/20 bg-white/10 text-white hover:bg-white/10">
                        {selectedSite.millLocation}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold md:text-3xl">
                      {selectedSite.millName || "Unnamed Site"}
                    </h2>
                    <p className="mt-1 text-sm text-blue-50">
                      Quick access to contact info, credentials, network setup, and completion records.
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedSite(null)}
                  className="h-10 w-10 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6 sm:py-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Supervisor</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{selectedSite.supervisorName || "—"}</p>
                      </div>
                      <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Anydesk IDs</p>
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="text-xs text-slate-400">ID 1:</div>
                            <ClickableAnydeskId
                              anydeskId={selectedSite.anydeskId}
                              className="text-base font-semibold text-slate-900 hover:text-blue-700"
                              showIcon={false}
                            />
                          </div>
                          {(selectedSite.anydeskId2) && (
                            <div>
                              <div className="text-xs text-slate-400">ID 2:</div>
                              <ClickableAnydeskId
                                anydeskId={selectedSite.anydeskId2}
                                className="text-base font-semibold text-slate-900 hover:text-blue-700"
                                showIcon={false}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-orange-100 bg-gradient-to-br from-orange-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rustdesk IDs</p>
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="text-xs text-slate-400">ID 1:</div>
                            <ClickableRustdeskId
                              rustdeskId={selectedSite.rustdeskId}
                              className="text-base font-semibold text-slate-900 hover:text-orange-700"
                              showIcon={false}
                            />
                          </div>
                          {(selectedSite.rustdeskId2) && (
                            <div>
                              <div className="text-xs text-slate-400">ID 2:</div>
                              <ClickableRustdeskId
                                rustdeskId={selectedSite.rustdeskId2}
                                className="text-base font-semibold text-slate-900 hover:text-orange-700"
                                showIcon={false}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
                        <Monitor className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last Updated</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {selectedSite.updated_at ? format(new Date(selectedSite.updated_at), "MMM d, yyyy") : "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                <DetailSection
                  title="Site Information"
                  icon={<MapPin className="h-5 w-5 text-blue-600" />}
                  accentClass="bg-gradient-to-r from-blue-50 to-indigo-50"
                >
                  <DetailRow label="Mill Name" value={selectedSite.millName} highlight />
                  <DetailRow label="Location" value={selectedSite.millLocation} />
                  <DetailRow label="Unit No" value={selectedSite.unitNo} />
                  <DetailRow label="POC Name" value={selectedSite.pocName} />
                  <DetailRow label="POC Contact" value={selectedSite.pocContact} />
                  <DetailRow
                    label="Date"
                    value={selectedSite.date ? format(new Date(selectedSite.date), "MMM d, yyyy") : "—"}
                  />
                  <DetailRow
                    label="Created Date"
                    value={selectedSite.created_at ? format(new Date(selectedSite.created_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                  />
                  <DetailRow
                    label="Last Updated"
                    value={selectedSite.updated_at ? format(new Date(selectedSite.updated_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                    highlight
                  />
                </DetailSection>

                <DetailSection
                  title="Personnel Information"
                  icon={<Users className="h-5 w-5 text-emerald-600" />}
                  accentClass="bg-gradient-to-r from-emerald-50 to-teal-50"
                >
                  <DetailRow label="Supervisor Name" value={selectedSite.supervisorName} />
                  <DetailRow label="Technician Name" value={selectedSite.technicianName} />
                </DetailSection>

                <DetailSection
                  title="GPU / Computer Information"
                  icon={<Monitor className="h-5 w-5 text-violet-600" />}
                  accentClass="bg-gradient-to-r from-violet-50 to-fuchsia-50"
                >
                  <DetailRow label="GPU Username" value={selectedSite.gpuUserName} />
                  <DetailRow label="GPU Password" value={selectedSite.gpuPassword} mono />
                  <DetailRow label="Anydesk ID 1" value={<ClickableAnydeskId anydeskId={selectedSite.anydeskId} showIcon={true} />} />
                  <DetailRow label="Anydesk Password 1" value={selectedSite.anydeskPassword} mono />
                  <DetailRow label="Anydesk ID 2" value={<ClickableAnydeskId anydeskId={selectedSite.anydeskId2} showIcon={true} />} />
                  <DetailRow label="Anydesk Password 2" value={selectedSite.anydeskPassword2} mono />
                  <DetailRow label="TailScale IP" value={selectedSite.tailscaleIp} mono />
                  <DetailRow label="Remote AnyDesk Password" value={selectedSite.remoteanydeskPassword} mono />
                  <DetailRow label="Remote AnyDesk Account" value={selectedSite.remoteanydeskAccountName} mono />
                  <DetailRow label="Rustdesk ID 1" value={<ClickableRustdeskId rustdeskId={selectedSite.rustdeskId} showIcon={true} />} />
                  <DetailRow label="Rustdesk Password 1" value={selectedSite.rustdeskPassword} mono />
                  <DetailRow label="Rustdesk ID 2" value={<ClickableRustdeskId rustdeskId={selectedSite.rustdeskId2} showIcon={true} />} />
                  <DetailRow label="Rustdesk Password 2" value={selectedSite.rustdeskPassword2} mono />
                  <DetailRow label="PC NIC" value={selectedSite.pcNic} mono />
                </DetailSection>

                <DetailSection
                  title="Network Configuration"
                  icon={<Network className="h-5 w-5 text-cyan-600" />}
                  accentClass="bg-gradient-to-r from-cyan-50 to-sky-50"
                >
                  <DetailRow label="Subnet" value={selectedSite.subnet} mono />
                  <DetailRow label="Default Gateway" value={selectedSite.defaultGateway} mono />
                  <DetailRow label="DNS" value={selectedSite.dns} mono />
                  <DetailRow label="Live IP" value={selectedSite.liveIp} mono highlight />
                </DetailSection>

                <DetailSection
                  title="NVR Configuration"
                  icon={<Camera className="h-5 w-5 text-rose-600" />}
                  accentClass="bg-gradient-to-r from-rose-50 to-orange-50"
                >
                  <DetailRow label="NVR IP-1" value={selectedSite.nvrIp} mono />
                  <DetailRow label="NVR IP-2" value={selectedSite.nvrIp2} mono />
                  <DetailRow label="NVR Username" value={selectedSite.nvrUsername} mono />
                  <DetailRow label="NVR Password" value={selectedSite.nvrPassword} mono />
                </DetailSection>

                <DetailSection
                  title="Camera Credentials"
                  icon={<Camera className="h-5 w-5 text-amber-600" />}
                  accentClass="bg-gradient-to-r from-amber-50 to-yellow-50"
                >
                  <DetailRow label="Camera Username" value={selectedSite.cameraUsername} mono />
                  <DetailRow label="Camera Password" value={selectedSite.cameraPassword} mono />
                </DetailSection>

                {selectedSite.cameras && selectedSite.cameras.length > 0 && (
                  <DetailSection
                    title="Camera IPs"
                    icon={<Camera className="h-5 w-5 text-indigo-600" />}
                    accentClass="bg-gradient-to-r from-indigo-50 to-blue-50"
                  >
                    {selectedSite.cameras.map((cam, idx) => (
                      <DetailRow
                        key={idx}
                        label={cam.name || `Camera ${idx + 1}`}
                        value={cam.ip}
                        mono
                      />
                    ))}
                  </DetailSection>
                )}

                <DetailSection
                  title="Completion Checklist"
                  icon={<ClipboardCheck className="h-5 w-5 text-lime-600" />}
                  accentClass="bg-gradient-to-r from-lime-50 to-green-50"
                >
                  <DetailRow label="Hardware Completed" value={renderChecklistBadge(selectedSite.hardwareCompleted)} />
                  <DetailRow label="Data Copy" value={renderChecklistBadge(selectedSite.dataCopy)} />
                  <DetailRow
                    label="Patch 1 Date"
                    value={selectedSite.patch1Date ? format(new Date(selectedSite.patch1Date), "MMM d, yyyy") : "—"}
                  />
                  <DetailRow
                    label="Patch 2 Date"
                    value={selectedSite.patch2Date ? format(new Date(selectedSite.patch2Date), "MMM d, yyyy") : "—"}
                  />
                  <DetailRow
                    label="Completion Certificate"
                    value={renderChecklistBadge(selectedSite.completionCertificate)}
                  />
                  <DetailRow label="ROI Created" value={renderChecklistBadge(selectedSite.roiCreated)} />
                </DetailSection>
              </div>

              {selectedSite.additionalDetails && (
                <DetailSection
                  title="Additional Details"
                  icon={<FileText className="h-5 w-5 text-slate-700" />}
                  accentClass="bg-gradient-to-r from-slate-100 to-slate-50"
                >
                  <div className="px-5 py-4 text-sm leading-6 text-slate-600 whitespace-pre-wrap">
                    {selectedSite.additionalDetails}
                  </div>
                </DetailSection>
              )}

              {selectedSite.completionFormImageUrl && (
                <Card className="mt-5 overflow-hidden border border-slate-200 shadow-sm">
                  <CardHeader className="border-b bg-gradient-to-r from-slate-100 to-slate-50">
                    <CardTitle className="flex items-center gap-3 text-base text-slate-900">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                        <FileText className="h-5 w-5 text-slate-700" />
                      </span>
                      Completion Form
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white p-4">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img
                        src={selectedSite.completionFormImageUrl}
                        alt="Completion Form"
                        className="w-full max-h-96 object-contain"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSite(null)}
                  className="flex-1 border-slate-300 bg-white"
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedSiteForCert(selectedSite);
                    setCertificateFormData(getDefaultCertFormData());
                    setShowCertificateDialog(true);
                  }}
                  className="flex-1 gap-2 border-blue-300 hover:bg-blue-50 text-blue-600"
                >
                  <FileText className="h-4 w-4" /> Deployment Certificates
                </Button>
                <Button
                  onClick={() => {
                    navigate(`/technical-projects/${id}/sites/${selectedSite.id}`);
                    setSelectedSite(null);
                  }}
                  className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Pencil className="h-4 w-4" /> Edit Site
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues Modal */}
      {issuesSiteId && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-white/20 bg-white/15 text-white hover:bg-white/15">
                      <AlertCircle className="h-3 w-3 mr-2" />
                      Issues Management
                    </Badge>
                    <Badge className="border border-white/20 bg-white/10 text-white hover:bg-white/10">
                      {sites.find((s) => s.id === issuesSiteId)?.millName || "Site"}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold md:text-3xl">
                      Site Issues & Tickets
                    </h2>
                    <p className="mt-1 text-sm text-blue-50">
                      Track, manage, and resolve all issues for this site.
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIssuesSiteId(null)}
                  className="h-10 w-10 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6 sm:py-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  onClick={() => setShowAddIssueDialog(true)}
                  className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add New Issue
                </Button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-500">Total Issues</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{issues.length}</p>
                  </CardContent>
                </Card>

                <Card className="border border-yellow-100 bg-gradient-to-br from-yellow-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-500">Open Issues</p>
                    <p className="mt-2 text-3xl font-bold text-yellow-700">
                      {issues.filter((i) => i.status === "Open").length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-orange-100 bg-gradient-to-br from-orange-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-500">In Progress</p>
                    <p className="mt-2 text-3xl font-bold text-orange-700">
                      {issues.filter((i) => i.status === "In Progress").length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-green-100 bg-gradient-to-br from-green-50 to-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-slate-500">Resolved</p>
                    <p className="mt-2 text-3xl font-bold text-green-700">
                      {issues.filter((i) => i.status === "Resolved").length}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Issues Table */}
              <IssuesTable
                issues={issues}
                isLoading={issuesLoading}
                onStatusUpdateClick={(issue) => {
                  setSelectedIssueForStatus(issue);
                  setShowStatusUpdateDialog(true);
                }}
                onEditClick={(issue) => {
                  setSelectedIssueForStatus(issue);
                  setShowStatusHistory(true);
                }}
              />

              {/* Status History Panel */}
              {showStatusHistory && selectedIssueForStatus && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Status Timeline</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowStatusHistory(false);
                        setSelectedIssueForStatus(null);
                      }}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <StatusHistoryPanel
                    statusHistory={selectedIssueForStatus.statusHistory}
                    currentStatus={selectedIssueForStatus.status}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6 sm:py-5">
              <Button
                variant="outline"
                onClick={() => {
                  setIssuesSiteId(null);
                  setShowStatusHistory(false);
                  setSelectedIssueForStatus(null);
                }}
                className="w-full border-slate-300 bg-white sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Issue Dialog */}
      <AddIssueDialog
        open={showAddIssueDialog}
        onOpenChange={setShowAddIssueDialog}
        siteId={issuesSiteId || ""}
        siteName={sites.find((s) => s.id === issuesSiteId)?.millName}
        onSuccess={() => {
          // Issues will be updated via realtime listener
        }}
      />

      {/* Status Update Dialog */}
      <StatusUpdateDialog
        open={showStatusUpdateDialog}
        onOpenChange={setShowStatusUpdateDialog}
        issue={selectedIssueForStatus}
        siteName={sites.find((site) => site.id === selectedIssueForStatus?.site_id)?.millName}
        onSuccess={() => {
          // Issues will be updated via realtime listener
          setSelectedIssueForStatus(null);
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
              <p className="text-sm font-semibold text-gray-600">Site: <span className="text-gray-900">{selectedSiteForCert?.millName}</span></p>
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
                setCertificateFormData(getDefaultCertFormData());
                setSelectedSiteForCert(null);
              }}
              className="border-gray-300 hover:bg-gray-50"
              disabled={isDownloadingCert || isSavingCert}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsSavingCert(true);
                if (selectedSiteForCert?.id) {
                  toast.success("Certificate form saved successfully");
                }
                setIsSavingCert(false);
              }}
              variant="outline"
              className="border-blue-300 hover:bg-blue-50 text-blue-600"
              disabled={isDownloadingCert || isSavingCert}
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
              onClick={async () => {
                if (!selectedCompanyProfile) {
                  toast.error("Please select a company profile");
                  return;
                }
                setIsDownloadingCert(true);
                try {
                  const selectedProfile = companyProfiles.find(p => p.id === selectedCompanyProfile);
                  if (!selectedProfile) {
                    toast.error("Company profile not found");
                    return;
                  }

                  await downloadDeploymentCertificatePDF(
                    selectedProfile?.company_name || "",
                    selectedSiteForCert?.millLocation || "",
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
                    selectedProfile?.id,
                    certificateFormData.certificate_type
                  );
                  toast.success("Certificate PDF downloaded!");
                  setShowCertificateDialog(false);
                } catch (error: any) {
                  toast.error(error.message || "Failed to download certificate");
                } finally {
                  setIsDownloadingCert(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isDownloadingCert || isSavingCert || !selectedCompanyProfile}
            >
              {isDownloadingCert ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
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

      {/* Bulk Import Dialog */}
      <BulkImportSites
        open={showBulkImportDialog}
        onOpenChange={setShowBulkImportDialog}
        technicalProjectId={id}
      />
    </div>
  );
}
