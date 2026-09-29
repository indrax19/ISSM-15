import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectTrackingAPI, type ProjectRemark, type ProjectTracking } from "@/integrations/firebase/projectTrackingAPI";
import { parentProjectsAPI, type ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { realtimeProjectTrackingAPI, realtimeParentProjectsAPI } from "@/integrations/firebase/realtimeAPI";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, Eye, FileIcon, X } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { z } from "zod";

const PROJECT_MILESTONE_ITEMS = [
  { key: "preRepositoryCompleted", label: "Pre Repository", chartLabel: "Pre Repo", weight: 10 },
  { key: "cablingCompleted", label: "Cabling", chartLabel: "Cabling", weight: 20 },
  { key: "camerasInstalled", label: "Camera Install", chartLabel: "Camera", weight: 15 },
  { key: "nvrInstalled", label: "NVR & LED Installed", chartLabel: "NVR & LED", weight: 15 },
  { key: "osInstalled", label: "OS Installed", chartLabel: "OS", weight: 20 },
  { key: "softwareInstalled", label: "Software Installed", chartLabel: "Software", weight: 15 },
  { key: "systemLive", label: "System Live", chartLabel: "Live", weight: 5 },
] as const;

const PROJECT_STATUS_ITEMS = [
  { key: "projectNotStarted", label: "Not Yet Started" },
  ...PROJECT_MILESTONE_ITEMS,
  { key: "projectCompleted", label: "Completed" },
] as const;

type ProjectStatusKey = (typeof PROJECT_STATUS_ITEMS)[number]["key"];
type ProjectStatusValues = Record<ProjectStatusKey | "projectCompleted", boolean>;

const EMPTY_PROJECT_STATUSES: ProjectStatusValues = {
  projectNotStarted: true,
  preRepositoryCompleted: false,
  cablingCompleted: false,
  camerasInstalled: false,
  nvrInstalled: false,
  osInstalled: false,
  softwareInstalled: false,
  systemLive: false,
  projectCompleted: false,
};

const siteSchema = z.object({
  millName: z.string().trim().min(1, "Mill name is required"),
  city: z.string().trim().min(1, "City is required"),
  district: z.string().trim().optional(),
  address: z.string().trim().optional(),
  state: z.string().trim().optional(),
  unitNo: z.string().trim().optional(),
  pocProjectName: z.string().trim().optional(),
  pocProjectPhone: z.string().trim().optional(),
  pocProjectEmail: z.string().trim().optional(),
  pocSiteName: z.string().trim().optional(),
  pocSitePhone: z.string().trim().optional(),
  pocSiteEmail: z.string().trim().optional(),
  pocTechnicalName: z.string().trim().optional(),
  pocTechnicalPhone: z.string().trim().optional(),
  pocTechnicalEmail: z.string().trim().optional(),
  projectStatus: z.enum(["Not Yet Started", "In Progress", "Partially Completed", "Complete", "No PO Yet"]).optional(),
  projectNotStarted: z.boolean().optional(),
  preRepositoryCompleted: z.boolean().optional(),
  cablingCompleted: z.boolean().optional(),
  camerasInstalled: z.boolean().optional(),
  nvrInstalled: z.boolean().optional(),
  osInstalled: z.boolean().optional(),
  softwareInstalled: z.boolean().optional(),
  systemLive: z.boolean().optional(),
  projectCompleted: z.boolean().optional(),
  logisticsStatus: z.string().trim().optional(),
  poNumber: z.string().trim().optional(),
  poStatus: z.string().trim().optional(),
  poDate: z.string().optional(),
  aviraPoStatus: z.string().trim().optional(),
  aviraPoDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timelineStatus: z.string().trim().optional(),
  supervisorName: z.string().trim().optional(),
  technicianNames: z.array(z.string().trim()),
  teamStatus: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

const LOGISTICS_STATUS_OPTIONS = ["Pending Dispatch", "Dispatched", "In Transit", "Arrived at Destination", "Delayed – Logistics"];
const PO_STATUS_OPTIONS = ["Issue", "Pending", "On Hold", "Pause", "Awaiting conformation", "Cancelled"];
const TIMELINE_STATUS_OPTIONS = ["Pause", "Hold by Team", "Hold by Mill", "Awaiting Confirmation"];
const TEAM_STATUS_OPTIONS = [
  "Scheduled",
  "Mobilized",
  "Travelling",
  "Onsite – Work In Progress",
  "Completed",
  "Returned to Base",
  "Standby / Idle",
];

export default function ProjectSiteForm() {
  const { siteId, projectId } = useParams<{ siteId?: string; projectId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!siteId;
  const { appUser } = useAuth();

  // Form state
  const [millName, setMillName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [pocProjectName, setPocProjectName] = useState("");
  const [pocProjectPhone, setPocProjectPhone] = useState("");
  const [pocProjectEmail, setPocProjectEmail] = useState("");
  const [pocSiteName, setPocSiteName] = useState("");
  const [pocSitePhone, setPocSitePhone] = useState("");
  const [pocSiteEmail, setPocSiteEmail] = useState("");
  const [pocTechnicalName, setPocTechnicalName] = useState("");
  const [pocTechnicalPhone, setPocTechnicalPhone] = useState("");
  const [pocTechnicalEmail, setPocTechnicalEmail] = useState("");
  const [projectStatus, setProjectStatus] = useState<string>("Not Yet Started");
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusValues>(EMPTY_PROJECT_STATUSES);
  const [logisticsStatus, setLogisticsStatus] = useState<string>("Pending Dispatch");
  const [poNumber, setPoNumber] = useState("");
  const [poStatus, setPoStatus] = useState("Pending");
  const [isManualPoStatus, setIsManualPoStatus] = useState(false);
  const [poDate, setPoDate] = useState("");
  const [aviraPoStatus, setAviraPoStatus] = useState("Pending");
  const [isManualAviraPoStatus, setIsManualAviraPoStatus] = useState(false);
  const [aviraPoDate, setAviraPoDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timelineStatus, setTimelineStatus] = useState("");
  const [isManualTimelineStatus, setIsManualTimelineStatus] = useState(false);
  const [projectDurationDays, setProjectDurationDays] = useState(0);
  const [supervisorName, setSupervisorName] = useState("");
  const [technicianInput, setTechnicianInput] = useState("");
  const [technicianNames, setTechnicianNames] = useState<string[]>([]);
  const [teamStatus, setTeamStatus] = useState<string>("Scheduled");
  const [remarks, setRemarks] = useState("");
  const [remarksHistory, setRemarksHistory] = useState<ProjectRemark[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [siteDocumentUrl, setSiteDocumentUrl] = useState("");
  const [siteDocumentName, setSiteDocumentName] = useState("");
  const [siteDocumentType, setSiteDocumentType] = useState("");
  const [documentPreview, setDocumentPreview] = useState("");
  const [selectedDispatchSlip, setSelectedDispatchSlip] = useState<File | null>(null);
  const [dispatchSlipUrl, setDispatchSlipUrl] = useState("");
  const [dispatchSlipName, setDispatchSlipName] = useState("");
  const [dispatchSlipType, setDispatchSlipType] = useState("");
  const [dispatchSlipPreview, setDispatchSlipPreview] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Real-time subscriptions
  const [site, setSite] = useState<ProjectTracking | null>(null);
  const [project, setProject] = useState<ParentProject | null>(null);

  const siteUnsubRef = useRef<(() => void) | null>(null);
  const projectUnsubRef = useRef<(() => void) | null>(null);
  const initializedSiteIdRef = useRef<string | null>(null);

  // Fetch existing site if editing with real-time updates
  useEffect(() => {
    if (!siteId) {
      setSite(null);
      initializedSiteIdRef.current = null;
      return;
    }

    initializedSiteIdRef.current = null;
    setSite(null);
    siteUnsubRef.current = realtimeProjectTrackingAPI.subscribeById(siteId, (s) => {
      setSite(s);
    });

    return () => {
      if (siteUnsubRef.current) siteUnsubRef.current();
    };
  }, [siteId]);

  // Fetch project info with real-time updates
  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }

    projectUnsubRef.current = realtimeParentProjectsAPI.subscribeById(projectId, (p) => {
      setProject(p);
    });

    return () => {
      if (projectUnsubRef.current) projectUnsubRef.current();
    };
  }, [projectId]);

  // Initialize form with site data
  useEffect(() => {
    if (site && site.id === siteId && initializedSiteIdRef.current !== siteId) {
      initializedSiteIdRef.current = siteId;
      setMillName(site.millName || "");
      setCity(site.city || "");
      setDistrict(site.district || "");
      setAddress(site.address || "");
      setState(site.state || "");
      setUnitNo(site.unitNo || "");
      setPocProjectName(site.pocProjectName || site.pocName || "");
      setPocProjectPhone(site.pocProjectPhone || site.pocPhone || "");
      setPocProjectEmail(site.pocProjectEmail || "");
      setPocSiteName(site.pocSiteName || "");
      setPocSitePhone(site.pocSitePhone || "");
      setPocSiteEmail(site.pocSiteEmail || "");
      setPocTechnicalName(site.pocTechnicalName || "");
      setPocTechnicalPhone(site.pocTechnicalPhone || "");
      setPocTechnicalEmail(site.pocTechnicalEmail || "");
      setProjectStatus(site.projectStatus || "Not Yet Started");
      const isLegacyComplete = site.projectStatus === "Complete";
      setProjectStatuses({
        projectNotStarted: site.projectNotStarted ?? (!site.projectStatus || site.projectStatus === "Not Yet Started"),
        preRepositoryCompleted: site.preRepositoryCompleted ?? isLegacyComplete,
        cablingCompleted: site.cablingCompleted ?? isLegacyComplete,
        camerasInstalled: site.camerasInstalled ?? isLegacyComplete,
        nvrInstalled: site.nvrInstalled ?? isLegacyComplete,
        osInstalled: site.osInstalled ?? isLegacyComplete,
        softwareInstalled: site.softwareInstalled ?? isLegacyComplete,
        systemLive: site.systemLive ?? isLegacyComplete,
        projectCompleted: site.projectCompleted ?? isLegacyComplete,
      });
      setLogisticsStatus(site.logisticsStatus || "Pending Dispatch");
      setPoNumber(site.poNumber || "");
      const savedPoStatus = site.poStatus || "";
      setPoStatus(savedPoStatus);
      setIsManualPoStatus(Boolean(savedPoStatus && !PO_STATUS_OPTIONS.includes(savedPoStatus)));
      setPoDate(site.poDate || "");
      const savedAviraPoStatus = site.aviraPoStatus || "";
      setAviraPoStatus(savedAviraPoStatus);
      setIsManualAviraPoStatus(Boolean(savedAviraPoStatus && !PO_STATUS_OPTIONS.includes(savedAviraPoStatus)));
      setAviraPoDate(site.aviraPoDate || "");
      setStartDate(site.startDate || "");
      setEndDate(site.endDate || "");
      const savedTimelineStatus = site.timelineStatus || "";
      setTimelineStatus(savedTimelineStatus);
      setIsManualTimelineStatus(Boolean(savedTimelineStatus && !TIMELINE_STATUS_OPTIONS.includes(savedTimelineStatus)));
      setProjectDurationDays(site.projectDurationDays || 0);
      setSupervisorName(site.supervisorName || "");
      setTechnicianNames(site.technicianNames || []);
      setTechnicianInput(site.technicianNames?.[0] || "");
      setTeamStatus(site.teamStatus || "Scheduled");
      setRemarks("");
      setRemarksHistory(site.remarksHistory || (site.remarks ? [{
        text: site.remarks,
        authorName: "Previous entry",
        createdAt: site.updated_at || "",
      }] : []));
      setSelectedDocument(null);
      setSiteDocumentUrl(site.siteDocumentUrl || "");
      setSiteDocumentName(site.siteDocumentName || "");
      setSiteDocumentType(site.siteDocumentType || "");
      setDocumentPreview(site.siteDocumentType?.startsWith("image/") ? site.siteDocumentUrl || "" : "");
      setSelectedDispatchSlip(null);
      setDispatchSlipUrl(site.dispatchSlipUrl || "");
      setDispatchSlipName(site.dispatchSlipName || "");
      setDispatchSlipType(site.dispatchSlipType || "");
      setDispatchSlipPreview(site.dispatchSlipType?.startsWith("image/") ? site.dispatchSlipUrl || "" : "");
    }
  }, [site, siteId]);

  // Auto-calculate project duration
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setProjectDurationDays(Math.max(0, days));
    }
  }, [startDate, endDate]);

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedDocument(file);
    setSiteDocumentUrl("");
    setSiteDocumentName(file.name);
    setSiteDocumentType(file.type);

    const reader = new FileReader();
    reader.onload = (event) => {
      setDocumentPreview((event.target?.result as string) || "");
    };
    reader.readAsDataURL(file);

    toast.success("Document selected. It will be uploaded when you save the site.");
  };

  const handleDispatchSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    setSelectedDispatchSlip(file);
    setDispatchSlipUrl("");
    setDispatchSlipName(file.name);
    setDispatchSlipType(file.type);
    const reader = new FileReader();
    reader.onload = (event) => setDispatchSlipPreview((event.target?.result as string) || "");
    reader.readAsDataURL(file);
    toast.success("Dispatch slip selected. It will be uploaded when you save the site.");
  };

  const handleDownloadDispatchSlip = async () => {
    const url = selectedDispatchSlip ? dispatchSlipPreview : dispatchSlipUrl;
    if (!url) return;
    const extension = dispatchSlipName.match(/\.[^.]+$/)?.[0] || "";
    const fileName = `${(millName.trim() || "Mill Name").replace(/[\\/:*?"<>|]+/g, "-")} - Dispatch Slip${extension}`;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleRemoveDocument = () => {
    setSelectedDocument(null);
    setSiteDocumentUrl("");
    setSiteDocumentName("");
    setSiteDocumentType("");
    setDocumentPreview("");
    toast.success("Document removed");
  };

  const handleDownloadDocument = async () => {
    const urlToDownload = selectedDocument ? documentPreview : siteDocumentUrl;
    if (!urlToDownload) {
      toast.error("No document to download");
      return;
    }

    const sourceName = selectedDocument?.name || siteDocumentName || "Purchase_Order";
    const extensionMatch = sourceName.match(/\.[^.]+$/);
    const extension = extensionMatch?.[0] || "";
    const safeMillName = (millName.trim() || "Mill Name").replace(/[\\/:*?"<>|]+/g, "-");
    const fileName = `${safeMillName} - Purchase Order${extension}`;

    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Document downloaded");
    } catch {
      window.open(urlToDownload, "_blank");
      toast.success("Document opened in new tab");
    }
  };

  const uploadSiteDocument = async () => {
    if (!selectedDocument) {
      return {
        url: siteDocumentUrl || null,
        name: siteDocumentName || null,
        type: siteDocumentType || null,
      };
    }

    const safeFileName = selectedDocument.name.replace(/\s+/g, "_");
    const filePath = `project_sites/${projectId || site?.project_id || "general"}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(filePath, selectedDocument);

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload document");
    }

    const { data: urlData } = supabase.storage
      .from("company-logos")
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      name: selectedDocument.name,
      type: selectedDocument.type || "application/octet-stream",
    };
  };

  const uploadDispatchSlip = async () => {
    if (!selectedDispatchSlip) return dispatchSlipUrl || null;

    const safeFileName = selectedDispatchSlip.name.replace(/\s+/g, "_");
    const filePath = `project_dispatch_slips/${projectId || site?.project_id || "general"}/${Date.now()}_${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from("company-logos").upload(filePath, selectedDispatchSlip);
    if (uploadError) throw new Error(uploadError.message || "Failed to upload dispatch slip");

    const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = siteSchema.parse({
        millName,
        city,
        district,
        address: address || undefined,
        state: state || undefined,
        unitNo: unitNo || undefined,
        pocProjectName,
        pocProjectPhone,
        pocProjectEmail,
        pocSiteName,
        pocSitePhone,
        pocSiteEmail,
        pocTechnicalName,
        pocTechnicalPhone,
        pocTechnicalEmail,
        projectStatus: projectStatus as any,
        ...projectStatuses,
        logisticsStatus: logisticsStatus as any,
        poNumber: poNumber || undefined,
        poStatus: poStatus as any,
        poDate,
        aviraPoStatus: aviraPoStatus as any,
        aviraPoDate,
        startDate,
        endDate,
        timelineStatus: timelineStatus as any,
        supervisorName,
        technicianNames,
        teamStatus: teamStatus as any,
      });

      const newRemark = remarks.trim()
        ? [{
            text: remarks.trim(),
            authorName: appUser?.fullName || appUser?.email || "Unknown user",
            createdAt: new Date().toISOString(),
          }]
        : [];
      const updatedRemarksHistory = [...remarksHistory, ...newRemark];

      const uploadedDocument = await uploadSiteDocument();
      const uploadedDispatchSlipUrl = await uploadDispatchSlip();
      const documentFields = uploadedDocument.url
        ? {
            siteDocumentUrl: uploadedDocument.url,
            siteDocumentName: uploadedDocument.name,
            siteDocumentType: uploadedDocument.type,
          }
        : isEditing
          ? {
              siteDocumentUrl: null,
              siteDocumentName: null,
              siteDocumentType: null,
            }
          : {};
      const dispatchSlipFields = uploadedDispatchSlipUrl
        ? { dispatchSlipUrl: uploadedDispatchSlipUrl, dispatchSlipName, dispatchSlipType }
        : isEditing
          ? { dispatchSlipUrl: null, dispatchSlipName: null, dispatchSlipType: null }
          : {};

      if (isEditing && siteId) {
        await projectTrackingAPI.update(siteId, {
          ...parsed,
          ...documentFields,
          ...dispatchSlipFields,
          poNumber,
          remarks: remarks.trim() || undefined,
          remarksHistory: updatedRemarksHistory,
          updated_by: appUser?.id,
        } as any);
      } else {
        await projectTrackingAPI.create({
          project_id: projectId || "",
          ...parsed,
          ...documentFields,
          ...dispatchSlipFields,
          poNumber,
          remarks: remarks.trim() || undefined,
          remarksHistory: updatedRemarksHistory,
          created_by: appUser?.id,
          updated_by: appUser?.id,
        } as any);
      }
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["all-sites"] });
      toast.success(isEditing ? "Site updated" : "Site created");
      navigate(`/projects/${projectId || site?.project_id}`);
    },
    onError: (err: unknown) => {
      const message = err instanceof z.ZodError
        ? err.issues.map((issue) => {
            const field = issue.path.join(".").replace(/([A-Z])/g, " $1");
            const label = field ? field.charAt(0).toUpperCase() + field.slice(1) : "Form";
            return `${label}: ${issue.message}`;
          }).join("; ")
        : err instanceof Error ? err.message : "Unknown error";
      const errorMessage = `Failed to ${isEditing ? "update" : "create"} site: ${message}`;
      setSaveError(errorMessage);
      toast.error(errorMessage);
    },
  });

  const projectCompletionPercent = projectStatuses.projectNotStarted
    ? 0
    : PROJECT_MILESTONE_ITEMS.reduce(
        (completion, { key, weight }) => completion + (projectStatuses[key] ? weight : 0),
        0
      );
  const projectProgressData = [
    { status: "Start", completion: 0 },
    ...PROJECT_MILESTONE_ITEMS.map((item, index) => ({
      status: item.chartLabel,
      completion: projectStatuses.projectNotStarted
        ? 0
        : PROJECT_MILESTONE_ITEMS.slice(0, index + 1).reduce(
            (completion, milestone) => completion + (projectStatuses[milestone.key] ? milestone.weight : 0),
            0
          ),
    })),
  ];

  const handleProjectStatusChange = (key: ProjectStatusKey, checked: boolean) => {
    let updatedStatuses: ProjectStatusValues = { ...projectStatuses };

    if (key === "projectCompleted") {
      updatedStatuses = checked
        ? {
            projectNotStarted: false,
            preRepositoryCompleted: true,
            cablingCompleted: true,
            camerasInstalled: true,
            nvrInstalled: true,
            osInstalled: true,
            softwareInstalled: true,
            systemLive: true,
            projectCompleted: true,
          }
        : { ...projectStatuses, systemLive: false, projectCompleted: false, projectNotStarted: false };
      setProjectStatus(checked ? "Complete" : "In Progress");
      setProjectStatuses(updatedStatuses);
      return;
    }

    if (key === "projectNotStarted") {
      const completedCount = PROJECT_MILESTONE_ITEMS.filter(({ key: milestoneKey }) => projectStatuses[milestoneKey]).length;
      if (checked || completedCount === 0) {
        updatedStatuses = { ...EMPTY_PROJECT_STATUSES };
        setProjectStatus("Not Yet Started");
      } else {
        updatedStatuses.projectNotStarted = false;
        updatedStatuses.projectCompleted = PROJECT_MILESTONE_ITEMS.every(({ key: milestoneKey }) => updatedStatuses[milestoneKey]);
        setProjectStatus(updatedStatuses.projectCompleted ? "Complete" : "In Progress");
      }
    } else {
      updatedStatuses[key] = checked;
      const completedCount = PROJECT_MILESTONE_ITEMS.filter(({ key: milestoneKey }) => updatedStatuses[milestoneKey]).length;
      updatedStatuses.projectNotStarted = completedCount === 0;
      updatedStatuses.projectCompleted = completedCount === PROJECT_MILESTONE_ITEMS.length;
      setProjectStatus(
        updatedStatuses.projectCompleted ? "Complete" : completedCount === 0 ? "Not Yet Started" : "In Progress"
      );
    }

    setProjectStatuses(updatedStatuses);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/projects/${projectId || site?.project_id}`)}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{isEditing ? "Edit Site" : "Add New Site"}</h1>
          {project && <p className="text-muted-foreground text-xs sm:text-sm truncate">Project: {project.name}</p>}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setSaveError(null); saveMutation.mutate(); }} className="flex flex-col space-y-4 sm:space-y-6">
        {saveError && (
          <div role="alert" className="order-0 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {saveError}
          </div>
        )}
        {/* Site Information Section */}
        <Card className="order-1">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Site Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="millName">Mill Name *</Label>
                <Input
                  id="millName"
                  value={millName}
                  onChange={(e) => setMillName(e.target.value)}
                  placeholder="e.g. Textile Mill A"
                  required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Faisalabad"
                  required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Faisalabad"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State (optional)</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Punjab"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitNo">Unit No (optional)</Label>
                <Input
                  id="unitNo"
                  value={unitNo}
                  onChange={(e) => setUnitNo(e.target.value)}
                  placeholder="e.g. Unit A, Unit 1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Industrial Area, Main Road"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Point of Contact Section */}
        <Card className="order-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Point of Contact Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left text-sm font-semibold">POC</th>
                    <th className="p-3 text-left text-sm font-semibold">Name</th>
                    <th className="p-3 text-left text-sm font-semibold">Phone</th>
                    <th className="p-3 text-left text-sm font-semibold">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "POC Project",
                      fields: [
                        ["pocProjectName", pocProjectName, setPocProjectName, "Enter name"],
                        ["pocProjectPhone", pocProjectPhone, setPocProjectPhone, "Enter phone"],
                        ["pocProjectEmail", pocProjectEmail, setPocProjectEmail, "Enter email"],
                      ],
                    },
                    {
                      label: "POC Site",
                      fields: [
                        ["pocSiteName", pocSiteName, setPocSiteName, "Enter name"],
                        ["pocSitePhone", pocSitePhone, setPocSitePhone, "Enter phone"],
                        ["pocSiteEmail", pocSiteEmail, setPocSiteEmail, "Enter email"],
                      ],
                    },
                    {
                      label: "POC Technical",
                      fields: [
                        ["pocTechnicalName", pocTechnicalName, setPocTechnicalName, "Enter name"],
                        ["pocTechnicalPhone", pocTechnicalPhone, setPocTechnicalPhone, "Enter phone"],
                        ["pocTechnicalEmail", pocTechnicalEmail, setPocTechnicalEmail, "Enter email"],
                      ],
                    },
                  ].map((row) => (
                    <tr key={row.label} className="border-b last:border-b-0">
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">{row.label}</th>
                      {row.fields.map(([id, value, setValue, placeholder]) => (
                        <td key={id} className="p-2">
                          <Input
                            id={id}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Order Section */}
        <Card className="order-3">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Purchase Order (PO)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold text-foreground">ISSM</h3>
                <div className="space-y-2">
                  <Label htmlFor="poNumber">PO Number</Label>
                  <Input
                    id="poNumber"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-2024-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poStatus">PO Status</Label>
                  <Select
                    value={isManualPoStatus ? "__manual__" : poStatus || undefined}
                    onValueChange={(value) => {
                      if (value === "__manual__") {
                        setIsManualPoStatus(true);
                        setPoStatus("");
                      } else {
                        setIsManualPoStatus(false);
                        setPoStatus(value);
                      }
                    }}
                  >
                    <SelectTrigger id="poStatus">
                      <SelectValue placeholder="Select PO status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PO_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="__manual__">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                  {isManualPoStatus && (
                    <Input
                      value={poStatus}
                      onChange={(e) => setPoStatus(e.target.value)}
                      placeholder="Enter PO status"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poDate">PO Date</Label>
                  <Input
                    id="poDate"
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-document-upload">Upload Purchase Order</Label>
                  {(selectedDocument || siteDocumentUrl) ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={selectedDocument ? documentPreview : siteDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View purchase order"
                          title="View purchase order"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={handleDownloadDocument}
                          aria-label="Download purchase order"
                          title="Download purchase order"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 text-green-600 hover:bg-green-50"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                      {(selectedDocument?.type || siteDocumentType).startsWith("image/") ? (
                        <a href={selectedDocument ? documentPreview : siteDocumentUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={selectedDocument ? documentPreview : siteDocumentUrl}
                            alt="Purchase order preview"
                            className="max-h-28 w-full cursor-pointer rounded border object-contain hover:opacity-90"
                          />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 rounded border bg-muted/40 p-3 text-xs text-muted-foreground">
                          <FileIcon className="h-5 w-5" />
                          <span className="truncate">{siteDocumentName || "Uploaded purchase order"}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1" onClick={() => document.getElementById("site-document-upload")?.click()}>
                          Change PO
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleRemoveDocument}>
                          <X className="mr-2 h-4 w-4 shrink-0" />
                          Remove PO
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => document.getElementById("site-document-upload")?.click()}
                      className="flex h-20 w-full items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 px-3 text-center text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      Click to upload purchase order
                    </button>
                  )}
                  <input
                    id="site-document-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleDocumentUpload}
                    className="hidden"
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold text-foreground">Avira Technologies</h3>
                <div className="space-y-2">
                  <Label htmlFor="aviraPoStatus">PO Status</Label>
                  <Select
                    value={isManualAviraPoStatus ? "__manual__" : aviraPoStatus || undefined}
                    onValueChange={(value) => {
                      if (value === "__manual__") {
                        setIsManualAviraPoStatus(true);
                        setAviraPoStatus("");
                      } else {
                        setIsManualAviraPoStatus(false);
                        setAviraPoStatus(value);
                      }
                    }}
                  >
                    <SelectTrigger id="aviraPoStatus">
                      <SelectValue placeholder="Select PO status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PO_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="__manual__">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                  {isManualAviraPoStatus && (
                    <Input
                      value={aviraPoStatus}
                      onChange={(e) => setAviraPoStatus(e.target.value)}
                      placeholder="Enter PO status"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aviraPoDate">PO Date</Label>
                  <Input
                    id="aviraPoDate"
                    type="date"
                    value={aviraPoDate}
                    onChange={(e) => setAviraPoDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logisticsStatus">Logistics Status</Label>
                  <Select value={logisticsStatus} onValueChange={setLogisticsStatus}>
                    <SelectTrigger id="logisticsStatus">
                      <SelectValue placeholder="Select logistics status" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOGISTICS_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dispatch-slip-upload">Upload Dispatch Slip</Label>
                  {(selectedDispatchSlip || dispatchSlipUrl) ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={dispatchSlipPreview || dispatchSlipUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View dispatch slip"
                          title="View dispatch slip"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={handleDownloadDispatchSlip}
                          aria-label="Download dispatch slip"
                          title="Download dispatch slip"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 text-green-600 hover:bg-green-50"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                      {dispatchSlipType.startsWith("image/") && (dispatchSlipPreview || dispatchSlipUrl) ? (
                        <a href={dispatchSlipPreview || dispatchSlipUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={dispatchSlipPreview || dispatchSlipUrl}
                            alt="Dispatch slip preview"
                            className="max-h-28 w-full cursor-pointer rounded border object-contain hover:opacity-90"
                          />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 rounded border bg-muted/40 p-3 text-xs text-muted-foreground">
                          <FileIcon className="h-5 w-5" />
                          <span className="truncate">{dispatchSlipName || "Uploaded dispatch slip"}</span>
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => document.getElementById("dispatch-slip-upload")?.click()}>
                        Change Dispatch Slip
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => document.getElementById("dispatch-slip-upload")?.click()}
                      className="flex h-20 w-full items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 px-3 text-center text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      Click to upload slip
                    </button>
                  )}
                  <input
                    id="dispatch-slip-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleDispatchSlipUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Status Section */}
        <Card className="order-4">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Project Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="overflow-x-auto rounded-md border p-2">
              <div className="grid min-w-[800px] grid-cols-5 gap-2">
                {PROJECT_STATUS_ITEMS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex min-h-12 items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
                  >
                    <Label htmlFor={`project-status-${key}`} className="cursor-pointer text-xs font-medium leading-tight">
                      {label}
                    </Label>
                    <Checkbox
                      id={`project-status-${key}`}
                      aria-label={`${label} complete`}
                      checked={projectStatuses[key]}
                      onCheckedChange={(checked) => handleProjectStatusChange(key, checked === true)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Completion Progress</h3>
                  <p className="text-xs text-muted-foreground">Progress reflects the weighted completion of each milestone.</p>
                </div>
                <span className="text-2xl font-bold text-primary">{projectCompletionPercent}%</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectProgressData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value}%`, "Progress"]} />
                    <Line
                      type="monotone"
                      dataKey="completion"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Timeline Section */}
        <Card className="order-5">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Project Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Project Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={projectDurationDays}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Auto-calculated</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timelineStatus">Status</Label>
                <Select
                  value={isManualTimelineStatus ? "__manual__" : timelineStatus || undefined}
                  onValueChange={(value) => {
                    if (value === "__manual__") {
                      setIsManualTimelineStatus(true);
                      setTimelineStatus("");
                    } else {
                      setIsManualTimelineStatus(false);
                      setTimelineStatus(value);
                    }
                  }}
                >
                  <SelectTrigger id="timelineStatus">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                    <SelectItem value="__manual__">Manual Entry</SelectItem>
                  </SelectContent>
                </Select>
                {isManualTimelineStatus && (
                  <Input
                    value={timelineStatus}
                    onChange={(e) => setTimelineStatus(e.target.value)}
                    placeholder="Enter custom status"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supervisor & Team Section */}
        <Card className="order-5">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Supervisor & Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisorName">Supervisor Name</Label>
              <Input
                id="supervisorName"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="e.g. Mr. ABC"
                />
              </div>

              <div className="space-y-2">
                <Label>Technician Names</Label>
                <Input
                  value={technicianInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTechnicianInput(value);
                    setTechnicianNames(value.trim() ? [value.trim()] : []);
                  }}
                  placeholder="Enter technician name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamStatus">Team Status</Label>
              <Select value={teamStatus} onValueChange={setTeamStatus}>
                <SelectTrigger id="teamStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remarks Section */}
        <Card className="order-7">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Remarks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="remarks">New Remark</Label>
                <Button
                  type="button"
                  size="sm"
                  disabled={!remarks.trim()}
                  onClick={() => {
                    setRemarksHistory((history) => [
                      ...history,
                      {
                        text: remarks.trim(),
                        authorName: appUser?.fullName || appUser?.email || "Unknown user",
                        createdAt: new Date().toISOString(),
                      },
                    ]);
                    setRemarks("");
                  }}
                >
                  New
                </Button>
              </div>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter a new remark"
                className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {remarksHistory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Remarks History</h3>
                <div className="space-y-2">
                  {[...remarksHistory].reverse().map((remark, index) => (
                    <div key={`${remark.createdAt}-${index}`} className="rounded-md border bg-muted/30 p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{remark.text}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Added by {remark.authorName || "Unknown user"}
                        {remark.createdAt && ` • ${new Date(remark.createdAt).toLocaleString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="order-9 flex flex-col sm:flex-row gap-2 justify-start items-start sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/projects/${projectId || site?.project_id}`)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending} className="w-full sm:w-auto">
            {saveMutation.isPending ? "Saving..." : isEditing ? "Update Site" : "Create Site"}
          </Button>
        </div>
      </form>
    </div>
  );
}
