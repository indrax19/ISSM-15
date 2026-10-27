import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { companyProfileAPI, CompanyProfile } from "@/integrations/firebase/firestore";
import { addLogoToPDF } from "./pdfLogoHelper";

const NAVY = [31, 54, 96] as [number, number, number];
const INK = [25, 35, 52] as [number, number, number];
const MUTED = [82, 96, 117] as [number, number, number];
const LIGHT = [245, 247, 250] as [number, number, number];

export async function generateSurveyReportPDF(report: {
  reportNumber?: string;
  clientFacility: string;
  focalPerson: string;
  contactNumber: string;
  projectScope: string;
  surveyType: string;
  reportDate: string | Date;
  preparedBy: string;
  facilityOverview?: string;
  gateWiseSummary?: Array<{ gateName: string; function: string; cameraRequired: string; notes: string }>;
  networkCablingRequirements?: Array<{ item: string; quantity: string; purpose: string }>;
}) {
  const pdf = new jsPDF("p", "mm", "a4");
  const margin = 14;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = 18;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("SITE SURVEY REPORT", pdf.internal.pageSize.getWidth() / 2, y, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Report No: ${value(report.reportNumber)}`, pdf.internal.pageSize.getWidth() - margin, y, { align: "right" });
  y += 12;
  const addTable = (title: string, head: string[], body: string[][]) => {
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [[title, ...head]],
      body,
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 10 },
      bodyStyles: { fontSize: 10, cellPadding: 3, textColor: INK, lineColor: [170, 180, 194], lineWidth: 0.25 },
      alternateRowStyles: { fillColor: LIGHT },
    });
    y = (pdf as any).lastAutoTable.finalY + 8;
  };
  addTable("SITE INFORMATION", ["Value"], [
  ["Client / Facility", value(report.clientFacility)], ["Focal Person", value(report.focalPerson)], ["Contact Number", value(report.contactNumber)],
    ["Project Scope", value(report.projectScope)], ["Survey Type", value(report.surveyType)], ["Report Date", format(new Date(report.reportDate), "dd MMM yyyy")], ["Prepared By", value(report.preparedBy)],
  ]);
  if (report.facilityOverview) addTable("FACILITY OVERVIEW", ["Details"], [["Overview", value(report.facilityOverview)]]);
  if (report.gateWiseSummary?.length) addTable("GATE-WISE SURVEY SUMMARY", ["Function", "Camera Required", "Notes"], report.gateWiseSummary.map((item) => [value(item.gateName), value(item.function), value(item.cameraRequired), value(item.notes)]));
  if (report.networkCablingRequirements?.length) addTable("NETWORK & CABLING REQUIREMENTS", ["Quantity", "Purpose"], report.networkCablingRequirements.map((item) => [value(item.item), value(item.quantity), value(item.purpose)]));
  pdf.save(`Survey_Report_${report.clientFacility.replace(/\\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}

type TextileReport = {
  id?: string;
  reportNumber?: string;
  millName: string;
  unitName: string;
  fullAddress: string;
  totalUnits: string;
  surveyDate: string;
  surveyedByName: string;
  surveyedByDesignation: string;
  millContactPerson: string;
  millContactNumber: string;
  blowRooms: Array<{ blowRoomNo: string; entryPoints: string; cameraLocation: string; lightingCondition: string }>;
  totalBlowRooms: string;
  totalEntryPoints: string;
  wasteFlowOption: string;
  wasteFlowRemarks: string;
  internetAvailable: boolean;
  connectionTypes: string[];
  connectionTypesOther: string;
  uplinkAvailable: boolean;
  bandwidthOption: string;
  internetQuality: string;
  ispProviderName: string;
  uplinkAtCamera: string;
  distanceToNearestPoint: string;
  upsAvailable: boolean;
  cameraSocket: boolean;
  converterSocket: boolean;
  switchSocket: boolean;
  upsCapacity: string;
  upsBackupTime: string;
  gpuCompute: string;
  generalRemarks: string;
  surveyorSignature: string;
  surveyorSignatureDate: string;
  customerRepresentativeSignature: string;
  customerRepresentativeSignatureDate: string;
  companyProfileId?: string;
};

const value = (input: unknown) => {
  if (typeof input === "boolean") return input ? "Yes" : "No";
  if (Array.isArray(input)) return input.length ? input.join(", ") : "—";
  return String(input ?? "").trim() || "—";
};

export async function generateTextileSurveyPDF(report: TextileReport) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;
  let companyProfile: CompanyProfile | null = null;

  if (report.companyProfileId) {
    companyProfile = await companyProfileAPI.getById(report.companyProfileId);
  }

  const drawHeader = async () => {
    pdf.setDrawColor(210, 216, 226);
    pdf.line(margin, 35, pageWidth - margin, 35);
    if (companyProfile?.logo_url) {
      await addLogoToPDF(pdf, companyProfile.logo_url, margin, 7, { maxWidth: 30, maxHeight: 21 });
    }
    const infoX = pageWidth - margin;
    pdf.setTextColor(...INK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(companyProfile?.company_name || "ISSM", infoX, 11, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    let infoY = 16;
    for (const line of [companyProfile?.phone && `Phone: ${companyProfile.phone}`, companyProfile?.email && `Email: ${companyProfile.email}`, companyProfile?.website && `Web: ${companyProfile.website}`].filter(Boolean) as string[]) {
      pdf.text(line, infoX, infoY, { align: "right" });
      infoY += 4;
    }
  };

  await drawHeader();
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(`Report No: ${value(report.reportNumber)}`, pageWidth - margin, 40, { align: "right" });
  y = 48;

  const newPage = () => {
    pdf.addPage();
    y = 18;
  };
  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 20) newPage();
  };
  const section = (title: string) => {
    ensureSpace(15);
    pdf.setFillColor(...NAVY);
    pdf.rect(margin, y, contentWidth, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(title, margin + 4, y + 5.3);
    y += 8;
  };
  const rows = (items: Array<[string, unknown]>) => {
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      body: items.map(([label, item]) => [label, value(item)]),
      columnStyles: { 0: { cellWidth: 58, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 58 } },
      bodyStyles: { font: "helvetica", fontSize: 10, textColor: INK, cellPadding: 3.2, lineColor: [170, 180, 194], lineWidth: 0.25 },
      alternateRowStyles: { fillColor: LIGHT },
    });
    y = (pdf as any).lastAutoTable.finalY + 7;
  };
  const table = (head: string[], body: string[][], widths?: number[]) => {
    ensureSpace(25);
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [head],
      body,
      columnStyles: widths?.reduce((acc, width, index) => ({ ...acc, [index]: { cellWidth: width } }), {} as Record<number, { cellWidth: number }>),
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9.5, cellPadding: 3.2, lineColor: [130, 145, 166], lineWidth: 0.3 },
      bodyStyles: { fontSize: 9.5, textColor: INK, cellPadding: 3.2, lineColor: [170, 180, 194], lineWidth: 0.25 },
      alternateRowStyles: { fillColor: LIGHT },
    });
    y = (pdf as any).lastAutoTable.finalY + 7;
  };

  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("PRE-INSTALLATION / PRE-DEPLOYMENT SURVEY FORM", pageWidth / 2, y, { align: "center" });
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.text("Video Analytics System — Spinning Unit / Blow Room Deployment (Pakistan)", pageWidth / 2, y, { align: "center" });
  y += 10;

  section("1. MILL / FACILITY IDENTIFICATION");
  rows([
    ["Mill Name", report.millName], ["Unit Name / Unit No.", report.unitName], ["Full Address / City", report.fullAddress],
    ["Total No. of Units", report.totalUnits], ["Survey Date", report.surveyDate ? format(new Date(report.surveyDate), "dd MMM yyyy") : "—"],
    ["Surveyed By (Name)", report.surveyedByName], ["Designation", report.surveyedByDesignation], ["Mill Contact Person", report.millContactPerson], ["Contact No. / Email", report.millContactNumber],
  ]);

  section("2. BLOW ROOM INVENTORY & CAMERA COVERAGE");
  table(["Sr. #", "Blow Room No.", "Entry Points", "Camera Location(s)", "Lighting Condition"], report.blowRooms.map((room, index) => [String(index + 1), value(room.blowRoomNo), value(room.entryPoints), value(room.cameraLocation), value(room.lightingCondition)]), [14, 32, 28, 53, 55] as number[]);
  rows([["Total No. of Blow Rooms", report.totalBlowRooms], ["Total Entry Points", report.totalEntryPoints]]);

  section("3. WASTE FLOW & ENTRY-POINT CROSS-CONTAMINATION CHECK");
  rows([["Waste Flow Option", report.wasteFlowOption], ["Remarks", report.wasteFlowRemarks]]);

  section("4. NETWORK & INTERNET CONNECTIVITY");
  rows([
    ["Internet Available", report.internetAvailable], ["Connection Types", report.connectionTypes], ["Other Connection Type", report.connectionTypesOther],
    ["Uplink Available", report.uplinkAvailable], ["Bandwidth Option", report.bandwidthOption], ["Internet Quality", report.internetQuality],
    ["ISP / Provider", report.ispProviderName], ["Uplink at Camera", report.uplinkAtCamera], ["Distance to Nearest Point", report.distanceToNearestPoint],
  ]);

  section("5. POWER INFRASTRUCTURE");
  rows([
    ["UPS Backup Available", report.upsAvailable], ["Dedicated Camera Socket", report.cameraSocket], ["Converter Socket", report.converterSocket],
    ["Switch Socket", report.switchSocket], ["UPS Capacity", report.upsCapacity], ["UPS Backup Time", report.upsBackupTime],
  ]);

  if (report.gpuCompute?.trim()) {
    section("6. GPU / COMPUTE & EQUIPMENT SIZING");
    rows([["GPU / Compute Requirements", report.gpuCompute]]);
  }
  if (report.generalRemarks?.trim()) {
    section("7. GENERAL SITE REMARKS / ADDITIONAL OBSERVATIONS");
    rows([["Remarks", report.generalRemarks]]);
  }

  ensureSpace(35);
  section("SIGN-OFF");
  table(["Surveyor Signature", "Date", "Customer Representative Signature", "Date"], [[value(report.surveyorSignature), value(report.surveyorSignatureDate), value(report.customerRepresentativeSignature), value(report.customerRepresentativeSignatureDate)]], [48, 28, 76, 28]);

  const pageCount = (pdf as any).internal.pages.length - 1;
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(210, 216, 226);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    pdf.setTextColor(...MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text(companyProfile?.company_name || "ISSM", margin, pageHeight - 8);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  const fileName = `Textile_Survey_${report.millName?.replace(/\s+/g, "_") || "Report"}_${format(new Date(), "yyyyMMdd")}.pdf`;
  pdf.save(fileName);
}
