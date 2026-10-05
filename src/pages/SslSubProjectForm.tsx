import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sslSubProjectsAPI,
  type SlaCameraInspection,
  type SlaChecklistRow,
  type SlaIssueRecord,
  type SlaRequirementRecord,
  type SlaSignoff,
  type SslMaintenanceVisitReport,
  type SslSubProject,
} from "@/integrations/firebase/sslSubProjectsAPI";
import { type SslProject } from "@/integrations/firebase/sslProjectsAPI";
import { realtimeSslSubProjectsAPI, realtimeSslProjectsAPI } from "@/integrations/firebase/sslRealtimeAPI";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Plus, Printer, Trash2, Upload } from "lucide-react";
import { z } from "zod";
import { downloadSlaVisitPDF } from "@/lib/slaVisitPDF";

const SITE_PRODUCTION_POINTS = [
  "Sugar mill operational",
  "Production season active",
  "Production/turnkey unchanged",
  "New production line installed",
  "Existing conveyor modified/relocated",
  "New conveyor installed",
  "New shoot/chute installed",
  "Any packing/dispatch area modification",
  "Any other production changes",
];

const CHECKLIST_GROUPS = [
  {
    key: "networkingCabling",
    title: "NETWORKING & CABLING",
    points: [
      "Camera network connectivity",
      "Production cable condition",
      "RJ45 connectors condition",
      "Fiber connectivity if applicable",
      "Junction boxes condition",
      "Cables properly secured",
      "PoE connectivity stable",
      "No intermittent connection",
    ],
  },
  {
    key: "nvrHddPoe",
    title: "NVR / HDD / PoE SWITCH",
    points: [
      "NVR operational",
      "All cameras recording",
      "Recording continuity verified",
      "HDD health normal",
      "Storage sufficient",
      "PoE switch operational",
      "All ports working",
      "Proper configuration",
    ],
  },
  {
    key: "computeGpu",
    title: "COMPUTE / GPU SYSTEM",
    points: [
      "System powered ON",
      "OS functioning",
      "VAS application running",
      "GPU utilization normal",
      "GPU temperature normal",
      "Storage health normal",
      "System logs checked",
      "System update status verified",
    ],
  },
  {
    key: "powerUpsElectrical",
    title: "POWER / UPS / ELECTRICAL",
    points: [
      "Power supply stable",
      "UPS operational",
      "UPS battery condition",
      "NVR on backup power",
      "Compute on backup power",
      "PoE switch on backup power",
      "Proper earthing",
      "No loose connections",
    ],
  },
] as const;

const OVERALL_STATUSES = [
  "Fully Operational",
  "Operational with Minor Issues",
  "Operational – Corrective Action Required",
  "Additional Work / Expansion Required",
  "Major Issue – Further Action Required",
];

const CAMERA_COUNT_FIELDS = [
  ["totalInstalled", "Total Cameras Installed"],
  ["online", "Online"],
  ["imageOk", "Image OK"],
  ["recordingOk", "Recording OK"],
  ["issuesFound", "Issues Found"],
  ["correctiveActionsCompleted", "Corrective Actions Completed"],
] as const;

const PRODUCTION_CHANGES = [
  ["newConveyorInstalled", "New Conveyor Installed?"],
  ["newShootChuteInstalled", "New Shoot/Chute Installed?"],
  ["existingConveyorModified", "Existing Conveyor Modified?"],
  ["newProductionPoint", "New Production Point?"],
  ["additionalCameraRequired", "Additional Camera Required?"],
] as const;

const PHOTO_LABELS = ["Overall Site View"];

const createChecklistRows = (points: readonly string[]): SlaChecklistRow[] =>
  points.map((point) => ({ point, result: "", remarks: "" }));

const createSignoff = (): SlaSignoff => ({ name: "", signature: "", date: "" });
const createCameraInspection = (): SlaCameraInspection => ({ cameraId: "", location: "", online: false, imageOk: false, recordingOk: false, physicalCondition: "", remarks: "" });
const createIssueRecord = (): SlaIssueRecord => ({ issue: "", category: "", priority: "", actionTaken: "", status: "", remarks: "" });

const trimTrailingEmptyRows = <T,>(rows: T[], isEmpty: (row: T) => boolean) => {
  let lastFilledIndex = -1;
  rows.forEach((row, index) => {
    if (!isEmpty(row)) lastFilledIndex = index;
  });
  return rows.slice(0, Math.max(1, lastFilledIndex + 1));
};

const createBlankReport = (projectName = ""): SslMaintenanceVisitReport => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return {
    formNumber: "",
    documentDate: date,
    slaYear: String(now.getFullYear()),
    projectName,
    fbrSiteId: "",
    visitDate: "",
    visitType: "",
    otherVisitType: "",
    visitNumber: "",
    previousVisitDate: "",
    customerPocName: "",
    customerDesignation: "",
    customerContact: "",
    customerEmail: "",
    engineerNames: ["", ""],
    engineerDesignations: ["", ""],
    cameraCounts: Object.fromEntries(CAMERA_COUNT_FIELDS.map(([key]) => [key, ""])),
    additionalRequirements: [],
    overallStatus: "",
    siteProductionRows: createChecklistRows(SITE_PRODUCTION_POINTS),
    cameraInspections: [createCameraInspection()],
    checklistRows: Object.fromEntries(CHECKLIST_GROUPS.map((group) => [group.key, createChecklistRows(group.points)])),
    productionChanges: Object.fromEntries(PRODUCTION_CHANGES.map(([key]) => [key, null])),
    productionObservations: "",
    issues: [createIssueRecord()],
    changeRequests: Array.from({ length: 8 }, (): SlaRequirementRecord => ({
      requirement: "",
      reason: "",
      hardwareRequired: "",
      priority: "",
    })),
    photoUrls: Array.from({ length: PHOTO_LABELS.length }, () => null),
    engineerRemarks: "",
    customerSignoff: createSignoff(),
    engineerSignoffs: [createSignoff()],
    fbrSubmission: { ...createSignoff(), fbrSiteId: "", designation: "" },
  };
};

const inputClass = "sla-input h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700";
const compactInputClass = "sla-input h-6 w-full rounded border border-slate-300 bg-white px-1 text-[10px] text-slate-900 outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700";
const textAreaClass = "sla-input min-h-16 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700";

function SlaField({
  label,
  value,
  onChange,
  type = "text",
  min,
  placeholder,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <label className={`flex min-w-0 flex-col font-semibold text-slate-700 ${compact ? "gap-0.5 text-[9px]" : "gap-1 text-[10px]"}`}>
      <span>{label}</span>
      <input
        className={compact ? compactInputClass : inputClass}
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SlaTextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold text-slate-700">
      <span>{label}</span>
      <textarea className={textAreaClass} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SlaSection({ title, children, className = "", compact = false }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={`sla-section min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white ${className}`}>
      <h2 className={`sla-section-title flex items-center gap-2 border-l-4 border-red-600 bg-[#124c78] font-bold tracking-wide text-white ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"}`}>
        {title}
      </h2>
      <div className={compact ? "p-1" : "p-2"}>{children}</div>
    </section>
  );
}

function SlaChecklistTable({ rows, onChange, showRemarks = true, compact = false }: {
  rows: SlaChecklistRow[];
  onChange: (index: number, patch: Partial<SlaChecklistRow>) => void;
  showRemarks?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`sla-table w-full border-collapse ${compact ? "sla-table-compact min-w-[360px] text-[9px]" : "min-w-[540px] text-[10px]"}`}>
        <thead>
          <tr>
            <th className="w-7">#</th>
            <th className="text-left">Inspection Point</th>
            <th className="w-10">OK</th>
            <th className="w-12">Not OK</th>
            <th className="w-10">N/A</th>
            {showRemarks && <th className="w-[22%] text-left">Remarks</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.point}-${index}`}>
              <td className="text-center">{index + 1}</td>
              <td>{row.point}</td>
              {["OK", "Not OK", "N/A"].map((result) => (
                <td key={result} className="text-center">
                  <input
                    type="checkbox"
                    aria-label={`${row.point}: ${result}`}
                    checked={row.result === result}
                    onChange={(event) => onChange(index, { result: event.target.checked ? result as SlaChecklistRow["result"] : "" })}
                  />
                </td>
              ))}
              {showRemarks && <td><input aria-label={`${row.point} remarks`} className={inputClass} value={row.remarks} onChange={(event) => onChange(index, { remarks: event.target.value })} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlaCameraTable({ rows, onChange, onRemove }: {
  rows: SlaCameraInspection[];
  onChange: (index: number, patch: Partial<SlaCameraInspection>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="sla-table w-full min-w-[700px] border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="w-7">#</th>
            <th className="text-left">Camera ID / Name</th>
            <th className="text-left">Location / Production Point</th>
            <th>Online</th>
            <th>Image OK</th>
            <th>Recording OK</th>
            <th className="text-left">Remarks</th>
            <th className="sla-no-print w-12">Remove</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((camera, index) => (
            <tr key={`camera-${index}`}>
              <td className="text-center">{index + 1}</td>
              <td><input aria-label={`Camera ${index + 1} ID or name`} className={inputClass} value={camera.cameraId} onChange={(event) => onChange(index, { cameraId: event.target.value })} /></td>
              <td><input aria-label={`Camera ${index + 1} location`} className={inputClass} value={camera.location} onChange={(event) => onChange(index, { location: event.target.value })} /></td>
              {(["online", "imageOk", "recordingOk"] as const).map((key) => (
                <td key={key} className="text-center"><input type="checkbox" aria-label={`Camera ${index + 1} ${key}`} checked={camera[key]} onChange={(event) => onChange(index, { [key]: event.target.checked })} /></td>
              ))}
              <td><input aria-label={`Camera ${index + 1} remarks`} className={inputClass} value={camera.remarks} onChange={(event) => onChange(index, { remarks: event.target.value })} /></td>
              <td className="sla-no-print text-center"><button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Delete camera row ${index + 1}`} onClick={() => onRemove(index)}><Trash2 className="h-3.5 w-3.5" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const baseSchema = z.object({
  millName: z.string().trim().min(1, "Mill name is required"),
  city: z.string().trim().min(1, "City is required"),
});

export default function SslSubProjectForm({
  siteIdOverride,
  projectIdOverride,
  previewOnly = false,
  downloadOnLoad = false,
  onClosePreview,
  onPrintPreview,
  onDownloadComplete,
}: {
  siteIdOverride?: string;
  projectIdOverride?: string;
  previewOnly?: boolean;
  downloadOnLoad?: boolean;
  onClosePreview?: () => void;
  onPrintPreview?: () => void;
  onDownloadComplete?: () => void;
} = {}) {
  const routeParams = useParams<{ siteId?: string; projectId?: string }>();
  const siteId = siteIdOverride || routeParams.siteId;
  const projectId = projectIdOverride || routeParams.projectId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReadOnlyPreview = previewOnly || searchParams.has("view") || searchParams.has("print");
  const shouldPrint = searchParams.has("print");
  const previewRootRef = useRef<HTMLDivElement>(null);
  const downloadStartedRef = useRef(false);
  const onDownloadCompleteRef = useRef(onDownloadComplete);
  onDownloadCompleteRef.current = onDownloadComplete;
  const queryClient = useQueryClient();
  const isEditing = !!siteId;
  const { appUser } = useAuth();
  const [millName, setMillName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [report, setReport] = useState<SslMaintenanceVisitReport>(() => createBlankReport());
  const [photoFiles, setPhotoFiles] = useState<Array<File | null>>(() => Array.from({ length: PHOTO_LABELS.length }, () => null));
  const [photoPreviews, setPhotoPreviews] = useState<Array<string | null>>(() => Array.from({ length: PHOTO_LABELS.length }, () => null));
  const [site, setSite] = useState<SslSubProject | null>(null);
  const [project, setProject] = useState<SslProject | null>(null);
  const [saveError, setSaveError] = useState("");
  const siteUnsubRef = useRef<(() => void) | null>(null);
  const projectUnsubRef = useRef<(() => void) | null>(null);
  const initializedSiteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setSite(null);
      initializedSiteIdRef.current = null;
      return;
    }

    initializedSiteIdRef.current = null;
    setSite(null);
    siteUnsubRef.current = realtimeSslSubProjectsAPI.subscribeById(siteId, setSite);
    return () => siteUnsubRef.current?.();
  }, [siteId]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }

    projectUnsubRef.current = realtimeSslProjectsAPI.subscribeById(projectId, setProject);
    return () => projectUnsubRef.current?.();
  }, [projectId]);

  useEffect(() => {
    if (!site || site.id !== siteId || !siteId || initializedSiteIdRef.current === siteId) return;
    initializedSiteIdRef.current = siteId;
    const emptyReport = createBlankReport(project?.name || "");
    const savedReport = site.maintenanceReport;
    const reportData: SslMaintenanceVisitReport = {
      ...emptyReport,
      ...savedReport,
      projectName: savedReport?.projectName || project?.name || "",
      customerPocName: savedReport?.customerPocName || site.pocName || "",
      customerContact: savedReport?.customerContact || site.pocPhone || "",
      engineerNames: savedReport?.engineerNames?.length ? savedReport.engineerNames : [site.supervisorName || "", site.technicianNames?.[0] || ""],
      engineerRemarks: savedReport?.engineerRemarks || site.remarks || "",
      cameraCounts: { ...emptyReport.cameraCounts, ...savedReport?.cameraCounts },
      additionalRequirements: savedReport?.additionalRequirements || [],
      siteProductionRows: emptyReport.siteProductionRows.map((row, index) => ({ ...row, ...savedReport?.siteProductionRows?.[index] })),
      cameraInspections: trimTrailingEmptyRows(
        Array.from({ length: Math.max(1, savedReport?.cameraInspections?.length || 0) }, (_, index) => ({
          ...createCameraInspection(),
          ...savedReport?.cameraInspections?.[index],
        })),
        (camera) => !camera.cameraId.trim() && !camera.location.trim() && !camera.online && !camera.imageOk && !camera.recordingOk && !camera.physicalCondition.trim() && !camera.remarks.trim()
      ),
      checklistRows: Object.fromEntries(CHECKLIST_GROUPS.map((group) => [
        group.key,
        group.points.map((point, index) => ({
          point,
          result: "" as SlaChecklistRow["result"],
          remarks: "",
          ...savedReport?.checklistRows?.[group.key]?.[index],
        })),
      ])),
      productionChanges: { ...emptyReport.productionChanges, ...savedReport?.productionChanges },
      issues: trimTrailingEmptyRows(
        Array.from({ length: Math.max(1, savedReport?.issues?.length || 0) }, (_, index) => ({
          ...createIssueRecord(),
          ...savedReport?.issues?.[index],
        })),
        (issue) => !issue.issue.trim() && !issue.category.trim() && !issue.priority.trim() && !issue.actionTaken.trim() && !issue.status.trim() && !issue.remarks.trim()
      ),
      changeRequests: Array.from({ length: Math.max(8, savedReport?.changeRequests?.length || 0) }, (_, index) => ({
        requirement: "", reason: "", hardwareRequired: "", priority: "",
        ...savedReport?.changeRequests?.[index],
      })),
      photoUrls: Array.from({ length: PHOTO_LABELS.length }, (_, index) => savedReport?.photoUrls?.[index] || null),
      customerSignoff: { ...createSignoff(), ...savedReport?.customerSignoff },
      engineerSignoffs: Array.from({ length: 2 }, (_, index) => ({ ...createSignoff(), ...savedReport?.engineerSignoffs?.[index] })),
      fbrSubmission: { ...emptyReport.fbrSubmission, ...savedReport?.fbrSubmission },
    };
    setMillName(site.millName || "");
    setCity(site.city || "");
    setDistrict(site.district || "");
    setAddress(site.address || "");
    setUnitNo(site.unitNo || "");
    setReport(reportData);
    setPhotoPreviews(reportData.photoUrls);
  }, [site, siteId, projectId, project?.name]);

  useEffect(() => {
    if (!shouldPrint || !site?.maintenanceReport || initializedSiteIdRef.current !== siteId) return;
    const previousTitle = document.title;
    document.title = `${report.formNumber || "SLA"} - ${millName || "Maintenance Visit"}`;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => {
      window.clearTimeout(timer);
      document.title = previousTitle;
    };
  }, [shouldPrint, site, siteId, report.formNumber, millName]);

  useEffect(() => {
    if (!downloadOnLoad || !site?.maintenanceReport || initializedSiteIdRef.current !== siteId || !previewRootRef.current || downloadStartedRef.current) return;
    const timer = window.setTimeout(async () => {
      if (downloadStartedRef.current || !previewRootRef.current) return;
      downloadStartedRef.current = true;
      const filenamePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
      const filename = `${filenamePart(report.formNumber || "SLA_Visit")}_${filenamePart(millName || "Site")}.pdf`;

      try {
        await downloadSlaVisitPDF(previewRootRef.current, filename);
        toast.success("SLA visit PDF downloaded.");
        onDownloadCompleteRef.current?.();
      } catch (error) {
        downloadStartedRef.current = false;
        console.error("Failed to download SLA visit PDF:", error);
        toast.error("Failed to download SLA visit PDF.");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [downloadOnLoad, site, siteId, report.formNumber, millName]);

  useEffect(() => {
    if (project?.name) {
      setReport((current) => current.projectName ? current : { ...current, projectName: project.name });
    }
  }, [project?.name]);

  const updateReport = <K extends keyof SslMaintenanceVisitReport>(key: K, value: SslMaintenanceVisitReport[K]) => {
    setReport((current) => ({ ...current, [key]: value }));
  };

  const updateChecklist = (section: string, index: number, patch: Partial<SlaChecklistRow>) => {
    setReport((current) => {
      if (section === "siteProductionRows") {
        return { ...current, siteProductionRows: current.siteProductionRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) };
      }
      const rows = current.checklistRows[section] || [];
      return { ...current, checklistRows: { ...current.checklistRows, [section]: rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) } };
    });
  };

  const updatePhoto = (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the site photograph.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Each photograph must be smaller than 10MB.");
      return;
    }
    const preview = URL.createObjectURL(file);
    setPhotoFiles((current) => current.map((existing, photoIndex) => photoIndex === index ? file : existing));
    setPhotoPreviews((current) => current.map((existing, photoIndex) => photoIndex === index ? preview : existing));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const base = baseSchema.parse({ millName, city });
      const photoUrls = await Promise.all(PHOTO_LABELS.map(async (_, index) => {
        const file = photoFiles[index];
        if (!file) return report.photoUrls[index] || null;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `sla_maintenance_visits/${projectId || site?.project_id || "general"}/${Date.now()}_${index}_${safeName}`;
        const { error } = await supabase.storage.from("company-logos").upload(path, file);
        if (error) throw new Error(error.message || "Failed to upload site photograph");
        return supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
      }));
      let savedMaintenanceReport = { ...report, photoUrls };
      const commonData = {
        ...base,
        project_id: projectId || site?.project_id || "",
        district: district.trim(),
        address: address.trim(),
        unitNo: unitNo.trim(),
        pocName: report.customerPocName,
        pocPhone: report.customerContact,
        maintenanceReport: savedMaintenanceReport,
        remarks: report.engineerRemarks,
        updated_by: appUser?.id,
      };
      if (isEditing && siteId) {
        await sslSubProjectsAPI.update(siteId, commonData as Partial<SslSubProject>);
      } else {
        const createdSite = await sslSubProjectsAPI.createMaintenanceVisit({
          ...commonData,
          projectStatus: "Not Yet Started",
          supplierName: "",
          logisticsStatus: "Pending Dispatch",
          poStatus: "Pending",
          poDate: "",
          startDate: "",
          endDate: "",
          supervisorName: report.engineerNames[0] || "",
          technicianNames: report.engineerNames.filter(Boolean),
          teamStatus: "Scheduled",
          hardwareDeliveryStatus: "Pending Dispatch",
          created_by: appUser?.id,
        } as SslSubProject & { maintenanceReport: SslMaintenanceVisitReport });
        savedMaintenanceReport = createdSite.maintenanceReport;
      }
      return savedMaintenanceReport;
    },
    onSuccess: (maintenanceReport) => {
      if (projectId) queryClient.invalidateQueries({ queryKey: ["ssl-sub-projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ssl_sub_projects"] });
      toast.success(isEditing ? "SLA visit form updated" : `SLA visit form created: ${maintenanceReport.formNumber}`);
      navigate(`/sla/${projectId || site?.project_id}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Unknown error";
      setSaveError(message || "Unable to save the SLA visit form.");
      toast.error(`Failed to save form: ${message || "Unknown error"}`);
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError("");
    saveMutation.mutate();
  };

  const updateCamera = (index: number, patch: Partial<SlaCameraInspection>) => {
    setReport((current) => ({ ...current, cameraInspections: current.cameraInspections.map((camera, cameraIndex) => cameraIndex === index ? { ...camera, ...patch } : camera) }));
  };

  const addCamera = () => {
    setReport((current) => ({ ...current, cameraInspections: [...current.cameraInspections, createCameraInspection()] }));
  };

  const removeCamera = (index: number) => {
    setReport((current) => ({ ...current, cameraInspections: current.cameraInspections.filter((_, cameraIndex) => cameraIndex !== index) }));
  };

  const updateSignoff = (group: "customerSignoff" | "fbrSubmission", key: keyof SlaSignoff | "fbrSiteId" | "designation", value: string) => {
    setReport((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  const updateEngineerSignoff = (index: number, key: keyof SlaSignoff, value: string) => {
    setReport((current) => ({ ...current, engineerSignoffs: current.engineerSignoffs.map((signoff, signoffIndex) => signoffIndex === index ? { ...signoff, [key]: value } : signoff) }));
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((current) => current.map((file, photoIndex) => photoIndex === index ? null : file));
    setPhotoPreviews((current) => current.map((url, photoIndex) => photoIndex === index ? null : url));
    updateReport("photoUrls", report.photoUrls.map((url, photoIndex) => photoIndex === index ? null : url));
  };

  return (
    <div ref={previewRootRef} className="sla-page-shell sla-export-root mx-auto max-w-[1600px] space-y-4 p-2 sm:p-4 lg:p-6">
      <style>{`
        .sla-table th,.sla-table td{border:1px solid #cbd5e1;padding:3px 4px;vertical-align:middle}
        .sla-table th{background:#e8eef5;color:#18344d;font-weight:700}
        .sla-table-compact th,.sla-table-compact td{padding:2px 3px}
        .sla-table-compact input[type=checkbox]{width:10px;height:10px}
        @page{size:A4 landscape;margin:7mm}
        @media print{
          body *{visibility:hidden!important}
          .sla-print-root,.sla-print-root *{visibility:visible!important}
          .sla-print-root{position:absolute!important;left:0!important;top:0!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;color:#111827!important;font-family:Arial,sans-serif!important}
          .sla-no-print{display:none!important}
          .sla-section{break-inside:avoid;box-shadow:none!important;border-color:#94a3b8!important}
          .sla-section-title{background:#124c78!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .sla-table{min-width:0!important;font-size:6.5pt!important}
          .sla-table th,.sla-table td{padding:2px 3px!important}
          .sla-input{min-height:15px!important;height:auto!important;border:0!important;border-bottom:1px solid #94a3b8!important;border-radius:0!important;padding:1px 2px!important;font-size:7pt!important;box-shadow:none!important;background:transparent!important;color:#111827!important}
          .sla-print-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .sla-print-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))!important}
          input[type=checkbox]{width:10px!important;height:10px!important;accent-color:#124c78!important}
          .sla-photo-box{min-height:30mm!important}
          .sla-writing-lines{min-height:25mm!important}
          .sla-footer{border-top:2px solid #124c78!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        }
      `}</style>

      <form id="sla-maintenance-form" onSubmit={onSubmit} className="sla-print-root space-y-2 bg-white text-slate-900">
        <header className="overflow-hidden rounded-lg border border-slate-200 border-t-4 border-t-[#124c78] bg-gradient-to-r from-slate-50 via-white to-blue-50/70">
          <div className="flex w-full flex-col items-center gap-2 px-4 py-4 text-center sm:px-6 sm:py-5">
            <div className="sla-no-print flex w-full items-center gap-2 text-left">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-slate-600 hover:bg-blue-50 hover:text-[#124c78]" onClick={() => onClosePreview ? onClosePreview() : navigate(`/sla/${projectId || site?.project_id}`)} aria-label={onClosePreview ? "Close visit preview" : "Back to SLA project"}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {project && <p className="min-w-0 truncate text-xs font-medium text-slate-600">Project: <span className="font-semibold text-slate-800">{project.name}</span></p>}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 sm:text-xs">Video Analytics System (VAS)</p>
            <h1 className="text-xl font-extrabold leading-tight tracking-tight text-[#124c78] sm:text-2xl">SLA Maintenance Visit Completion Form</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 sm:text-xs">FBR Track &amp; Trace <span className="mx-1 text-red-500">/</span> Maintenance Visit Record</p>
          </div>
        </header>
        {saveError && <div role="alert" className="sla-no-print rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
        <fieldset disabled={isReadOnlyPreview} className="contents">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 sla-print-grid-2">
          <SlaSection title="SITE & VISIT INFORMATION" compact>
            <div className="grid grid-cols-1 gap-x-2 gap-y-1 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-0.5 text-[9px] font-semibold text-slate-700">
                <span>ID</span>
                <span className={`${compactInputClass} flex items-center bg-slate-50 font-bold`}>{report.formNumber || "Assigned after save"}</span>
              </label>
              <SlaField label="Date" type="date" value={report.documentDate} onChange={(value) => updateReport("documentDate", value)} compact />
              <SlaField label="Mill Name" value={millName} onChange={setMillName} compact />
              <SlaField label="Unit" value={unitNo} onChange={setUnitNo} compact />
              <SlaField label="Location" value={city} onChange={setCity} compact />
              <SlaField label="District" value={district} onChange={setDistrict} compact />
              <div className="grid grid-cols-1 gap-1 sm:col-span-2 sm:grid-cols-3">
                <label className="flex min-w-0 flex-col gap-0.5 text-[9px] font-semibold text-slate-700">
                  <span>Visit Type</span>
                  <select className={compactInputClass} value={report.visitType} onChange={(event) => updateReport("visitType", event.target.value)}>
                    <option value="" />
                    {["Preventive", "Corrective", "Follow-up", "Pre-Season", "Other"].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <SlaField label="SLA Visit No." value={report.visitNumber} onChange={(value) => updateReport("visitNumber", value)} compact />
                <SlaField label="SLA Year" type="number" min="2000" value={report.slaYear} onChange={(value) => updateReport("slaYear", value)} compact />
                {report.visitType === "Other" && <SlaField label="Other Visit Type" value={report.otherVisitType} onChange={(value) => updateReport("otherVisitType", value)} compact />}
              </div>
            </div>
          </SlaSection>

          <SlaSection title="STAKEHOLDERS">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SlaField label="Customer POC Name" value={report.customerPocName} onChange={(value) => updateReport("customerPocName", value)} />
              <SlaField label="Customer Designation" value={report.customerDesignation} onChange={(value) => updateReport("customerDesignation", value)} />
              <SlaField label="Customer Contact No." value={report.customerContact} onChange={(value) => updateReport("customerContact", value)} />
              <SlaField label="Customer Email" type="email" value={report.customerEmail} onChange={(value) => updateReport("customerEmail", value)} />
              {[0, 1].map((index) => (
                <div key={index} className="grid grid-cols-2 gap-2">
                  <SlaField label={`Deployment Engineer ${index + 1}`} value={report.engineerNames[index] || ""} onChange={(value) => updateReport("engineerNames", report.engineerNames.map((name, rowIndex) => rowIndex === index ? value : name))} />
                  <SlaField label="Designation" value={report.engineerDesignations[index] || ""} onChange={(value) => updateReport("engineerDesignations", report.engineerDesignations.map((designation, rowIndex) => rowIndex === index ? value : designation))} />
                </div>
              ))}
            </div>
          </SlaSection>
        </div>

        <SlaSection title="EXECUTIVE SUMMARY">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sla-print-grid-3">
            {CAMERA_COUNT_FIELDS.map(([key, label]) => (
              <label key={key} className="flex min-w-0 flex-col gap-1 rounded border border-slate-200 bg-slate-50 p-2 text-[9px] font-semibold text-slate-700">
                <span>{label}</span>
                <input className={`${inputClass} h-8 text-center text-sm font-bold`} type="text" value={report.cameraCounts[key]} onChange={(event) => updateReport("cameraCounts", { ...report.cameraCounts, [key]: event.target.value })} />
              </label>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
            <div className="rounded border border-slate-200 p-2">
              <p className="mb-1 text-[10px] font-bold text-slate-800">Overall System Status</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {OVERALL_STATUSES.map((status) => (
                  <label key={status} className="flex items-start gap-1.5 text-[10px] leading-tight text-slate-700">
                    <input type="checkbox" checked={report.overallStatus === status} onChange={(event) => updateReport("overallStatus", event.target.checked ? status : "")} />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-800">Additional Requirements</p>
                <Button type="button" size="sm" variant="outline" className="sla-no-print h-7 gap-1 px-2 text-[10px]" onClick={() => updateReport("additionalRequirements", [...report.additionalRequirements, ""])}><Plus className="h-3 w-3" />Add Remark</Button>
              </div>
              <div className="space-y-1">
                {report.additionalRequirements.length === 0 && <div className="min-h-8 rounded border border-dashed border-slate-300" />}
                {report.additionalRequirements.map((remark, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <input className={`${inputClass} h-8`} aria-label={`Additional requirement ${index + 1}`} value={remark} onChange={(event) => updateReport("additionalRequirements", report.additionalRequirements.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                    <Button type="button" variant="ghost" size="icon" className="sla-no-print h-7 w-7 shrink-0" aria-label="Remove requirement" onClick={() => updateReport("additionalRequirements", report.additionalRequirements.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SlaSection>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 sla-print-grid-2">
          <SlaSection title="SITE & PRODUCTION STATUS">
            <SlaChecklistTable rows={report.siteProductionRows} onChange={(index, patch) => updateChecklist("siteProductionRows", index, patch)} />
          </SlaSection>

          <SlaSection title="CAMERA INSPECTION">
            <SlaCameraTable rows={report.cameraInspections} onChange={updateCamera} onRemove={removeCamera} />
            <Button type="button" variant="outline" size="sm" className="sla-no-print mt-2 h-7 gap-1 text-[10px]" onClick={addCamera}><Plus className="h-3 w-3" />Add Camera Row</Button>
          </SlaSection>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 sla-print-grid-3">
          {CHECKLIST_GROUPS.slice(0, 3).map((group) => (
            <SlaSection key={group.key} title={group.title} compact>
              <SlaChecklistTable rows={report.checklistRows[group.key] || []} onChange={(index, patch) => updateChecklist(group.key, index, patch)} showRemarks={false} compact />
            </SlaSection>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 sla-print-grid-3">
          {CHECKLIST_GROUPS.slice(3).map((group) => (
            <SlaSection key={group.key} title={group.title} compact>
              <SlaChecklistTable rows={report.checklistRows[group.key] || []} onChange={(index, patch) => updateChecklist(group.key, index, patch)} showRemarks={false} compact />
            </SlaSection>
          ))}

          <SlaSection title="PRODUCTION CHANGES / ADDITIONAL REQUIREMENTS" compact>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 sla-print-grid-3">
              {PRODUCTION_CHANGES.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[9px]">
                  <span className="font-medium">{label}</span>
                  <div className="flex gap-2">
                    {[true, false].map((answer) => (
                      <label key={String(answer)} className="flex items-center gap-1"><input type="checkbox" checked={report.productionChanges[key] === answer} onChange={(event) => setReport((current) => ({ ...current, productionChanges: { ...current.productionChanges, [key]: event.target.checked ? answer : null } }))} />{answer ? "Yes" : "No"}</label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1"><SlaTextArea label="Details / Observations" value={report.productionObservations} onChange={(value) => updateReport("productionObservations", value)} rows={2} /></div>
          </SlaSection>

          <SlaSection title="SITE PHOTOGRAPHS" compact>
            <div className="grid grid-cols-1 gap-2">
              {PHOTO_LABELS.map((label, index) => (
                <div key={label} className="sla-photo-box relative flex min-h-24 flex-col overflow-hidden rounded border border-slate-300 bg-slate-50">
                  <div className="flex items-center justify-between border-b bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-700"><span>{index + 1}. {label}</span><button type="button" className="sla-no-print text-slate-500 hover:text-red-600" aria-label={`Remove ${label}`} onClick={() => removePhoto(index)}><Trash2 className="h-3 w-3" /></button></div>
                  {photoPreviews[index] ? <img src={photoPreviews[index] || ""} alt={label} className="h-20 w-full object-contain" /> : <div className="flex flex-1 items-center justify-center text-slate-300"><Upload className="h-7 w-7" /></div>}
                  <label className="sla-no-print cursor-pointer border-t bg-white px-2 py-1 text-center text-[9px] font-semibold text-blue-800 hover:bg-blue-50">Choose photo<input type="file" accept="image/*" className="sr-only" onChange={(event) => updatePhoto(index, event.target.files?.[0])} /></label>
                </div>
              ))}
            </div>
          </SlaSection>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 sla-print-grid-2">
          <SlaSection title="CUSTOMER ACKNOWLEDGEMENT & SIGN-OFF">
            <p className="mb-2 text-[9px] leading-4 text-slate-700">“We confirm that the above SLA maintenance visit was carried out at our site. The findings, corrective actions and additional requirements (if any) have been discussed with us. We acknowledge the system status as recorded in this form.”</p>
            <div className="grid gap-2">
              <SlaField label="Customer Representative Name" value={report.customerSignoff.name} onChange={(value) => updateSignoff("customerSignoff", "name", value)} />
              <SlaField label="Signature" value={report.customerSignoff.signature} onChange={(value) => updateSignoff("customerSignoff", "signature", value)} />
              <SlaField label="Date" type="date" value={report.customerSignoff.date} onChange={(value) => updateSignoff("customerSignoff", "date", value)} />
            </div>
          </SlaSection>

          <SlaSection title="AVIRA TECHNOLOGIES ENGINEER SIGN-OFF">
            {report.engineerSignoffs.slice(0, 1).map((signoff, index) => (
              <div key={index} className={index ? "mt-2 border-t border-slate-200 pt-2" : ""}>
                <p className="mb-1 text-[9px] font-bold text-slate-700">Engineer {index + 1}</p>
                <div className="grid gap-1.5">
                  <SlaField label="Engineer Name" value={signoff.name} onChange={(value) => updateEngineerSignoff(index, "name", value)} />
                  <SlaField label="Signature" value={signoff.signature} onChange={(value) => updateEngineerSignoff(index, "signature", value)} />
                  <SlaField label="Date" type="date" value={signoff.date} onChange={(value) => updateEngineerSignoff(index, "date", value)} />
                </div>
              </div>
            ))}
          </SlaSection>

        </div>

        </fieldset>

        <footer className="sla-footer grid grid-cols-1 gap-2 border-t-2 border-[#124c78] py-2 text-center text-[9px] font-semibold text-[#124c78] sm:grid-cols-3">
          <p>Video Analytics Solutions</p>
          <p>Compliance with FBR Track &amp; Trace Requirements</p>
          <p>Reliable Operations for a Transparent Sugar Industry</p>
        </footer>

        {isReadOnlyPreview ? (
          <div className="sla-no-print flex flex-col justify-end gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onClosePreview ? onClosePreview() : navigate(`/sla/${projectId || site?.project_id}`)} className="gap-2">{onClosePreview ? "Close Preview" : "Back to visits"}</Button>
            <Button type="button" onClick={() => onPrintPreview ? onPrintPreview() : window.print()} className="gap-2 bg-[#124c78] hover:bg-[#0d3d62]"><Printer className="h-4 w-4" />Print / Save PDF</Button>
          </div>
        ) : (
          <div className="sla-no-print flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-sm font-bold text-slate-900">Ready to finalize this visit?</p>
              <p className="mt-1 text-xs text-slate-600">Print a copy or save your completed maintenance visit form.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={() => navigate(`/sla/${projectId || site?.project_id}`)} className="w-full gap-2 sm:w-auto">Cancel</Button>
              <Button type="button" variant="outline" onClick={() => window.print()} className="w-full gap-2 sm:w-auto"><Printer className="h-4 w-4" />Print / Save PDF</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="w-full gap-2 bg-[#124c78] hover:bg-[#0d3d62] sm:w-auto"><FileDown className="h-4 w-4" />{saveMutation.isPending ? "Saving..." : isEditing ? "Save Form" : "Create Form"}</Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
