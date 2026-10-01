import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { SlaChecklistRow, SslSubProject } from "@/integrations/firebase/sslSubProjectsAPI";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";

const cameraCountFields = [
  ["totalInstalled", "Total Cameras Installed"],
  ["online", "Online"],
  ["imageOk", "Image OK"],
  ["recordingOk", "Recording OK"],
  ["issuesFound", "Issues Found"],
  ["correctiveActionsCompleted", "Corrective Actions Completed"],
] as const;

const checklistGroups = [
  {
    title: "NETWORKING & CABLING",
    key: "networkingCabling",
    points: ["Camera network connectivity", "Production cable condition", "RJ45 connectors condition", "Fiber connectivity if applicable", "Junction boxes condition", "Cables properly secured", "PoE connectivity stable", "No intermittent connection"],
  },
  {
    title: "NVR / HDD / PoE SWITCH",
    key: "nvrHddPoe",
    points: ["NVR operational", "All cameras recording", "Recording continuity verified", "HDD health normal", "Storage sufficient", "PoE switch operational", "All ports working", "Proper configuration"],
  },
  {
    title: "COMPUTE / GPU SYSTEM",
    key: "computeGpu",
    points: ["System powered ON", "OS functioning", "VAS application running", "GPU utilization normal", "GPU temperature normal", "Storage health normal", "System logs checked", "System update status verified"],
  },
  {
    title: "POWER / UPS / ELECTRICAL",
    key: "powerUpsElectrical",
    points: ["Power supply stable", "UPS operational", "UPS battery condition", "NVR on backup power", "Compute on backup power", "PoE switch on backup power", "Proper earthing", "No loose connections"],
  },
];

const valueOrDash = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "—" : String(value);
const formatDate = (value: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "MMM d, yyyy");
};

const loadPhoto = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.type !== "image/png" && blob.type !== "image/jpeg") return null;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data, format: blob.type === "image/png" ? "PNG" as const : "JPEG" as const };
  } catch {
    return null;
  }
};

export async function downloadSlaVisitPDF(site: SslSubProject, projectName?: string) {
  const report = site.maintenanceReport;
  if (!report) throw new Error("No SLA maintenance report is available for this visit");

  const cameraCounts = report.cameraCounts || {};
  const additionalRequirements = report.additionalRequirements || [];
  const siteProductionRows = report.siteProductionRows || [];
  const cameraInspections = report.cameraInspections || [];
  const checklistRows = report.checklistRows || {};
  const productionChangesData = report.productionChanges || {};
  const photoUrls = report.photoUrls || [];
  const customerSignoff = report.customerSignoff || { name: "", signature: "", date: "" };
  const engineerSignoffs = report.engineerSignoffs || [];
  const engineerNames = report.engineerNames || [];
  const engineerDesignations = report.engineerDesignations || [];

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 9;
  const contentWidth = pageWidth - margin * 2;
  let y = 9;

  pdf.setProperties({
    title: `${report.formNumber || "SLA Visit"} - ${site.millName}`,
    subject: "SLA Maintenance Visit Completion Form",
    author: "Avira Technologies",
  });

  pdf.setFillColor(18, 76, 120);
  pdf.rect(0, 0, pageWidth, 2, "F");
  pdf.setTextColor(196, 37, 47);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("VIDEO ANALYTICS SYSTEM (VAS)", pageWidth / 2, y + 2, { align: "center" });
  y += 8;
  pdf.setTextColor(18, 76, 120);
  pdf.setFontSize(16);
  pdf.text("SLA Maintenance Visit Completion Form", pageWidth / 2, y + 3, { align: "center" });
  y += 6;
  pdf.setTextColor(71, 85, 105);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("FBR Track & Trace  /  Maintenance Visit Record", pageWidth / 2, y + 2, { align: "center" });
  y += 7;
  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 4;

  const tableStyles = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, textColor: [30, 41, 59] as [number, number, number], lineColor: [203, 213, 225] as [number, number, number], lineWidth: 0.15, overflow: "linebreak" as const, valign: "middle" as const },
    headStyles: { fillColor: [232, 238, 245] as [number, number, number], textColor: [18, 52, 77] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: margin, right: margin, top: 9, bottom: 14 },
  };

  const addSection = (title: string) => {
    if (y > pageHeight - 25) {
      pdf.addPage();
      y = 10;
    }
    pdf.setFillColor(18, 76, 120);
    pdf.roundedRect(margin, y, contentWidth, 5, 1, 1, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(title, margin + 2, y + 3.5);
    y += 7;
  };

  const addTable = (head: string[], body: (string | number)[][], options: Record<string, unknown> = {}) => {
    autoTable(pdf, {
      ...tableStyles,
      startY: y,
      head: [head],
      body,
      ...options,
    } as Parameters<typeof autoTable>[1]);
    y = (pdf as any).lastAutoTable.finalY + 3;
  };

  const addKeyValueSection = (title: string, rows: [string, string, string, string][]) => {
    addSection(title);
    addTable(["DETAIL", "VALUE", "DETAIL", "VALUE"], rows, {
      columnStyles: { 0: { cellWidth: 39, fontStyle: "bold" }, 1: { cellWidth: 100 }, 2: { cellWidth: 39, fontStyle: "bold" }, 3: { cellWidth: "auto" } },
    });
  };

  const visitType = report.visitType === "Other" ? report.otherVisitType || "Other" : report.visitType;
  addKeyValueSection("SITE & VISIT INFORMATION", [
    ["Form ID", valueOrDash(report.formNumber), "Date", formatDate(report.documentDate)],
    ["Mill Name", valueOrDash(site.millName), "Unit", valueOrDash(site.unitNo)],
    ["Location", valueOrDash(site.city), "District", valueOrDash(site.district)],
    ["Visit Type", valueOrDash(visitType), "SLA Visit No.", valueOrDash(report.visitNumber)],
    ["SLA Year", valueOrDash(report.slaYear), "Project", valueOrDash(projectName || report.projectName)],
  ]);

  addKeyValueSection("STAKEHOLDERS", [
    ["Customer POC", valueOrDash(report.customerPocName), "Designation", valueOrDash(report.customerDesignation)],
    ["Contact No.", valueOrDash(report.customerContact), "Email", valueOrDash(report.customerEmail)],
    ["Deployment Engineer 1", valueOrDash(engineerNames[0]), "Designation", valueOrDash(engineerDesignations[0])],
    ["Deployment Engineer 2", valueOrDash(engineerNames[1]), "Designation", valueOrDash(engineerDesignations[1])],
  ]);

  addSection("EXECUTIVE SUMMARY");
  addTable(cameraCountFields.map(([, label]) => label), [cameraCountFields.map(([key]) => valueOrDash(cameraCounts[key]))]);
  addTable(["OVERALL SYSTEM STATUS", "ADDITIONAL REQUIREMENTS"], [[
    valueOrDash(report.overallStatus),
    additionalRequirements.filter(Boolean).join("; ") || "—",
  ]], { columnStyles: { 0: { cellWidth: 88 }, 1: { cellWidth: "auto" } } });

  addSection("SITE & PRODUCTION STATUS");
  addTable(["#", "INSPECTION POINT", "OK", "NOT OK", "N/A", "REMARKS"], siteProductionRows.map((row: SlaChecklistRow, index) => [
    index + 1,
    row.point,
    row.result === "OK" ? "X" : "",
    row.result === "Not OK" ? "X" : "",
    row.result === "N/A" ? "X" : "",
    valueOrDash(row.remarks),
  ]), { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 100 }, 2: { cellWidth: 13, halign: "center" }, 3: { cellWidth: 15, halign: "center" }, 4: { cellWidth: 13, halign: "center" }, 5: { cellWidth: "auto" } } });

  addSection("CAMERA INSPECTION");
  addTable(["#", "CAMERA ID / NAME", "LOCATION / PRODUCTION POINT", "ONLINE", "IMAGE OK", "RECORDING OK", "REMARKS"], cameraInspections.map((camera, index) => [
    index + 1,
    valueOrDash(camera.cameraId),
    valueOrDash(camera.location),
    camera.online ? "X" : "",
    camera.imageOk ? "X" : "",
    camera.recordingOk ? "X" : "",
    valueOrDash(camera.remarks),
  ]), { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 37 }, 2: { cellWidth: 57 }, 3: { cellWidth: 16, halign: "center" }, 4: { cellWidth: 16, halign: "center" }, 5: { cellWidth: 20, halign: "center" }, 6: { cellWidth: "auto" } } });

  for (const group of checklistGroups) {
    addSection(group.title);
    const rows = (checklistRows[group.key] || []).map((row, index) => [
      index + 1,
      row.point,
      row.result === "OK" ? "X" : "",
      row.result === "Not OK" ? "X" : "",
      row.result === "N/A" ? "X" : "",
    ]);
    addTable(["#", "INSPECTION POINT", "OK", "NOT OK", "N/A"], rows, { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 23, halign: "center" }, 4: { cellWidth: 20, halign: "center" } } });
  }

  addSection("PRODUCTION CHANGES / ADDITIONAL REQUIREMENTS");
  const productionChanges = [
    ["New Conveyor Installed?", "newConveyorInstalled"],
    ["New Shoot/Chute Installed?", "newShootChuteInstalled"],
    ["Existing Conveyor Modified?", "existingConveyorModified"],
    ["New Production Point?", "newProductionPoint"],
    ["Additional Camera Required?", "additionalCameraRequired"],
  ] as const;
  addTable(["CHANGE", "YES", "NO"], productionChanges.map(([label, key]) => [
    label,
    productionChangesData[key] === true ? "X" : "",
    productionChangesData[key] === false ? "X" : "",
  ]), { columnStyles: { 0: { cellWidth: 125 }, 1: { cellWidth: 25, halign: "center" }, 2: { cellWidth: 25, halign: "center" } } });
  addTable(["DETAILS / OBSERVATIONS"], [[valueOrDash(report.productionObservations)]]);

  const photo = photoUrls[0] ? await loadPhoto(photoUrls[0]!) : null;
  addSection("SITE PHOTOGRAPHS");
  if (photo) {
    if (y > pageHeight - 75) {
      pdf.addPage();
      y = 10;
    }
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(margin, y, 120, 58, 1, 1);
    pdf.addImage(photo.data, photo.format, margin + 2, y + 2, 116, 54, undefined, "MEDIUM");
    y += 62;
  } else {
    addTable(["OVERALL SITE VIEW"], [[photoUrls[0] ? "Photo could not be embedded in this PDF." : "No photo uploaded."]]);
  }

  addSection("CUSTOMER ACKNOWLEDGEMENT & SIGN-OFF");
  addTable(["CUSTOMER REPRESENTATIVE", "SIGNATURE", "DATE"], [[
    valueOrDash(customerSignoff.name),
    valueOrDash(customerSignoff.signature),
    formatDate(customerSignoff.date),
  ]]);

  addSection("AVIRA TECHNOLOGIES ENGINEER SIGN-OFF");
  addTable(["ENGINEER", "SIGNATURE", "DATE"], (engineerSignoffs.slice(0, 1).length ? engineerSignoffs.slice(0, 1) : [{ name: "", signature: "", date: "" }]).map((signoff) => [
    valueOrDash(signoff.name),
    valueOrDash(signoff.signature),
    formatDate(signoff.date),
  ]));

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(18, 76, 120);
    pdf.setLineWidth(0.4);
    pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text("Video Analytics Solutions  |  Compliance with FBR Track & Trace Requirements", margin, pageHeight - 5);
    pdf.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  const fileSlug = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `${fileSlug(report.formNumber || "SLA_Visit")}_${fileSlug(site.millName || "Site")}.pdf`;
  await downloadHighQualityPDF(pdf.output("blob"), filename);
}
