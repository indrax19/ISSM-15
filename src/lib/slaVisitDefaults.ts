import {
  type SlaCameraInspection,
  type SlaChecklistRow,
  type SlaIssueRecord,
  type SslMaintenanceVisitReport,
  type SlaRequirementRecord,
  type SlaSignoff,
} from "@/integrations/firebase/sslSubProjectsAPI";

export const SITE_PRODUCTION_POINTS = [
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

export const CHECKLIST_GROUPS = [
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

export const OVERALL_STATUSES = [
  "Fully Operational",
  "Operational with Minor Issues",
  "Operational – Corrective Action Required",
  "Additional Work / Expansion Required",
  "Major Issue – Further Action Required",
];

export const CAMERA_COUNT_FIELDS = [
  ["totalInstalled", "Total Cameras Installed"],
  ["online", "Online"],
  ["imageOk", "Image OK"],
  ["recordingOk", "Recording OK"],
  ["issuesFound", "Issues Found"],
  ["correctiveActionsCompleted", "Corrective Actions Completed"],
] as const;

export const PRODUCTION_CHANGES = [
  ["newConveyorInstalled", "New Conveyor Installed?"],
  ["newShootChuteInstalled", "New Shoot/Chute Installed?"],
  ["existingConveyorModified", "Existing Conveyor Modified?"],
  ["newProductionPoint", "New Production Point?"],
  ["additionalCameraRequired", "Additional Camera Required?"],
] as const;

export const PHOTO_LABELS = ["Overall Site View"];

export const createChecklistRows = (points: readonly string[]): SlaChecklistRow[] =>
  points.map((point) => ({ point, result: "", remarks: "" }));

export const createSignoff = (): SlaSignoff => ({ name: "", signature: "", date: "" });
export const createCameraInspection = (): SlaCameraInspection => ({ cameraId: "", location: "", online: false, imageOk: false, recordingOk: false, physicalCondition: "", remarks: "" });
export const createIssueRecord = (): SlaIssueRecord => ({ issue: "", category: "", priority: "", actionTaken: "", status: "", remarks: "" });

export const trimTrailingEmptyRows = <T,>(rows: T[], isEmpty: (row: T) => boolean) => {
  let lastFilledIndex = -1;
  rows.forEach((row, index) => {
    if (!isEmpty(row)) lastFilledIndex = index;
  });
  return rows.slice(0, Math.max(1, lastFilledIndex + 1));
};

export const createBlankSlaReport = (projectName = ""): SslMaintenanceVisitReport => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const signoff = createSignoff();
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
    customerSignoff: signoff,
    engineerSignoffs: [createSignoff()],
    fbrSubmission: { ...createSignoff(), fbrSiteId: "", designation: "" },
  };
};
