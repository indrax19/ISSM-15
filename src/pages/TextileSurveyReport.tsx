import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  textileSurveyReportAPI,
  TextileSurveyReport,
} from "@/integrations/firebase/siteSurveyReportAPI";
import {
  TextileSurveyData,
  defaultTextileData,
} from "@/components/SurveyTemplates/SurveyTemplateBase";
import TextileSurveyForm from "@/components/SurveyTemplates/TextileSurveyForm";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { generateTextileSurveyPDF } from "@/lib/surveyPDFGenerator";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function TextileSurveyReportPage() {
  const { id, category } = useParams<{ id?: string; category?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [existingReport, setExistingReport] = useState<TextileSurveyReport | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load existing report if editing
  useEffect(() => {
    if (!id || category) {
      setExistingReport(null);
      return;
    }

    unsubscribeRef.current = textileSurveyReportAPI.subscribeById(id, (report) => {
      if (isMountedRef.current && report) {
        setExistingReport(report);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [id, category]);

  const saveMutation = useMutation({
    mutationFn: async (data: TextileSurveyData) => {
      if (!data.millName.trim()) {
        toast.error("Mill Name is required");
        throw new Error("Mill Name required");
      }
      if (!data.unitName.trim()) {
        toast.error("Unit Name is required");
        throw new Error("Unit Name required");
      }

      const reportData: TextileSurveyReport = {
        ...data,
      };

      if (existingReport?.id) {
        await textileSurveyReportAPI.update(existingReport.id, reportData);
        await queryClient.invalidateQueries({ queryKey: ["survey-reports"] });
        toast.success("Report updated successfully");
        navigate("/survey-reports");
      } else {
        try {
          const result = await textileSurveyReportAPI.create(reportData);
          if (!result?.id) {
            throw new Error("Failed to create report - no ID returned");
          }
          await queryClient.invalidateQueries({ queryKey: ["survey-reports"] });
          toast.success("Report created successfully");
          navigate("/survey-reports");
        } catch (error: any) {
          toast.error(error.message || "Failed to create report");
          throw error;
        }
      }
    },
  });

  const generatePDF = async () => {
    if (!existingReport) {
      toast.error("Please save the report first before exporting PDF");
      return;
    }

    setGeneratingPDF(true);
    try {
      const profiles = await companyProfileAPI.getAll();
      const issmProfile = profiles.find((profile) =>
        profile.company_name.toLowerCase().includes("issm")
      ) || profiles[0];

      await generateTextileSurveyPDF({
        ...existingReport,
        companyProfileId: issmProfile?.id,
      });
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const legacyGeneratePDF = async () => {
    if (!existingReport) {
      toast.error("Please save the report first before exporting PDF");
      return;
    }

    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let yPosition = margin;

      const navy = [39, 60, 112] as [number, number, number];

      // Header
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 35, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("PRE-INSTALLATION / PRE-DEPLOYMENT SURVEY FORM", pageWidth / 2, 12, {
        align: "center",
      });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Video Analytics System — Spinning Unit / Blow Room Deployment (Pakistan)", pageWidth / 2, 22, {
        align: "center",
      });
      yPosition = 45;

      const addSectionHeader = (title: string) => {
        pdf.setFillColor(...navy);
        pdf.rect(margin, yPosition, contentWidth, 7, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(title, margin + 5, yPosition + 4.5);
        pdf.setTextColor(0, 0, 0);
        yPosition += 10;
      };

      const checkPage = () => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Section 1: Mill/Facility Identification
      addSectionHeader("1. MILL / FACILITY IDENTIFICATION");
      checkPage();

      const section1Data = [
        ["Mill Name", existingReport.millName],
        ["Unit Name / Unit No.", existingReport.unitName],
        ["Full Address / City", existingReport.fullAddress],
        ["Total No. of Units", existingReport.totalUnits],
        ["Survey Date", format(new Date(existingReport.surveyDate), "dd MMM yyyy")],
        ["Surveyed By (Name)", existingReport.surveyedByName],
        ["Designation", existingReport.surveyedByDesignation],
        ["Mill Contact Person", existingReport.millContactPerson],
        ["Contact No. / Email", existingReport.millContactNumber],
      ];

      section1Data.forEach(([label, value], index) => {
        if (yPosition > pageHeight - 15) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(label, margin + 5, yPosition);
        pdf.setFont("helvetica", "normal");
        const wrappedValue = pdf.splitTextToSize(value || "—", contentWidth - 65);
        pdf.text(wrappedValue, margin + 70, yPosition);
        yPosition += wrappedValue.length > 1 ? wrappedValue.length * 4 + 2 : 6;
      });
      yPosition += 5;

      // Section 2: Blow Room Inventory
      checkPage();
      addSectionHeader("2. BLOW ROOM INVENTORY & CAMERA COVERAGE");

      const blowRoomData = existingReport.blowRooms.map((room, idx) => [
        String(idx + 1),
        room.blowRoomNo,
        room.entryPoints,
        room.cameraLocation,
        room.lightingCondition,
      ]);

      autoTable(pdf, {
        startY: yPosition,
        head: [["Sr. #", "Blow Room No.", "Entry Points", "Camera Location", "Lighting"]],
        body: blowRoomData,
        margin: { left: margin, right: margin },
        theme: "grid",
        headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 28 },
          2: { cellWidth: 28 },
          3: { cellWidth: 36 },
          4: { cellWidth: 43 },
        },
      });
      yPosition = (pdf as any).lastAutoTable.finalY + 8;

      checkPage();
      const totalsData = [
        ["Total No. of Blow Rooms", existingReport.totalBlowRooms],
        ["Total Entry Points", existingReport.totalEntryPoints],
      ];
      totalsData.forEach(([label, value]) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(label, margin + 5, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.text(value || "—", margin + 70, yPosition);
        yPosition += 6;
      });
      yPosition += 5;

      // Section 3: Waste Flow
      checkPage();
      addSectionHeader("3. WASTE FLOW & ENTRY-POINT CROSS-CONTAMINATION CHECK");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const wasteFlowText = pdf.splitTextToSize(
        existingReport.wasteFlowOption ? `Selected: ${existingReport.wasteFlowOption.toUpperCase()}` : "Not selected",
        contentWidth - 10
      );
      pdf.text(wasteFlowText, margin + 5, yPosition);
      yPosition += wasteFlowText.length * 4 + 2;

      if (existingReport.wasteFlowRemarks) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Remarks:", margin + 5, yPosition);
        yPosition += 4;
        pdf.setFont("helvetica", "normal");
        const remarksText = pdf.splitTextToSize(existingReport.wasteFlowRemarks, contentWidth - 10);
        pdf.text(remarksText, margin + 5, yPosition);
        yPosition += remarksText.length * 3 + 3;
      }
      yPosition += 3;

      // Section 4: Network & Internet
      checkPage();
      addSectionHeader("4. NETWORK & INTERNET CONNECTIVITY");

      const networkData = [
        ["Internet Available", existingReport.internetAvailable ? "Yes" : "No"],
        ["Connection Types", existingReport.connectionTypes.join(", ") || "—"],
        ["Uplink Available", existingReport.uplinkAvailable ? "Yes" : "No"],
        ["Bandwidth Option", existingReport.bandwidthOption || "—"],
        ["Internet Quality", existingReport.internetQuality || "—"],
        ["ISP / Provider", existingReport.ispProviderName || "—"],
        ["Uplink at Camera", existingReport.uplinkAtCamera || "—"],
        ["Distance to Nearest Point", existingReport.distanceToNearestPoint || "—"],
      ];

      networkData.forEach(([label, value]) => {
        checkPage();
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.text(label, margin + 5, yPosition);
        pdf.setFont("helvetica", "normal");
        const wrappedValue = pdf.splitTextToSize(value, contentWidth - 65);
        pdf.text(wrappedValue, margin + 70, yPosition);
        yPosition += wrappedValue.length > 1 ? wrappedValue.length * 3 + 2 : 5;
      });
      yPosition += 3;

      // Section 5: Power Infrastructure
      checkPage();
      addSectionHeader("5. POWER INFRASTRUCTURE");

      const powerData = [
        ["UPS Backup Available", existingReport.upsAvailable ? "Yes" : "No"],
        ["Dedicated Camera Socket", existingReport.cameraSocket ? "Yes" : "No"],
        ["Converter Socket", existingReport.converterSocket ? "Yes" : "No"],
        ["Switch Socket", existingReport.switchSocket ? "Yes" : "No"],
        ["UPS Capacity", existingReport.upsCapacity || "—"],
        ["UPS Backup Time", existingReport.upsBackupTime || "—"],
      ];

      powerData.forEach(([label, value]) => {
        checkPage();
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.text(label, margin + 5, yPosition);
        pdf.setFont("helvetica", "normal");
        pdf.text(value, margin + 70, yPosition);
        yPosition += 5;
      });
      yPosition += 3;

      // Section 6: GPU/Compute
      if (existingReport.gpuCompute) {
        checkPage();
        addSectionHeader("6. GPU / COMPUTE & EQUIPMENT SIZING");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        const gpuText = pdf.splitTextToSize(existingReport.gpuCompute, contentWidth - 10);
        pdf.text(gpuText, margin + 5, yPosition);
        yPosition += gpuText.length * 3 + 3;
      }

      // Section 7: General Remarks
      if (existingReport.generalRemarks) {
        checkPage();
        addSectionHeader("7. GENERAL SITE REMARKS / ADDITIONAL OBSERVATIONS");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        const remarksText = pdf.splitTextToSize(existingReport.generalRemarks, contentWidth - 10);
        pdf.text(remarksText, margin + 5, yPosition);
        yPosition += remarksText.length * 3 + 5;
      }

      // Signatures
      checkPage();
      yPosition += 5;
      pdf.setDrawColor(0, 0, 0);
      pdf.line(margin, yPosition, margin + 35, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("Surveyor Signature", margin, yPosition + 4);

      pdf.line(margin + 55, yPosition, margin + 90, yPosition);
      pdf.text("Date", margin + 55, yPosition + 4);

      yPosition += 15;
      pdf.line(margin, yPosition, margin + 35, yPosition);
      pdf.text("Customer Rep. Signature", margin, yPosition + 4);

      pdf.line(margin + 55, yPosition, margin + 90, yPosition);
      pdf.text("Date", margin + 55, yPosition + 4);

      // Footer
      const pageCount = (pdf as any).internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      const fileName = `Textile_Survey_${existingReport.millName.replace(/\s+/g, "_")}_${format(
        new Date(),
        "yyyyMMdd"
      )}.pdf`;
      pdf.save(fileName);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-4 sm:p-6 text-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/survey-reports")}
            className="hover:bg-white/20 h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {existingReport ? "Edit Textile Survey" : "Create Textile Survey"}
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">
              {existingReport ? "Update textile mill survey details" : "Create new textile mill survey report"}
            </p>
            {existingReport?.reportNumber && (
              <p className="text-white font-semibold text-sm mt-2">Report No: {existingReport.reportNumber}</p>
            )}
          </div>
        </div>
        {existingReport && (
          <Button
            onClick={generatePDF}
            disabled={generatingPDF}
            className="bg-white text-blue-600 hover:bg-blue-50 h-9 sm:h-10 text-sm sm:text-base"
          >
            {generatingPDF ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto w-full">
        <TextileSurveyForm
          initialData={existingReport || defaultTextileData}
          onSubmit={(data) => saveMutation.mutate(data)}
          isLoading={saveMutation.isPending}
        />
      </div>
    </div>
  );
}
