import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  siteSurveyReportAPI,
  textileSurveyReportAPI,
} from "@/integrations/firebase/siteSurveyReportAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Eye, Edit, Download, Trash2, Copy, CalendarDays, Building2, ClipboardList, Network, Factory, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { companyProfileAPI } from "@/integrations/firebase/firestore";

const DetailField = ({ label, value }: { label: string; value: unknown }) => (
  <div className="rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-slate-900">{String(value || "—")}</p>
  </div>
);

const DetailSection = ({
  title,
  subtitle,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ElementType;
  className: string;
  children: ReactNode;
}) => (
  <section className={`overflow-hidden rounded-xl border shadow-sm ${className}`}>
    <div className="flex items-center gap-3 border-b border-black/5 bg-white/40 px-4 py-3">
      <div className="rounded-lg bg-white/80 p-2 shadow-sm"><Icon className="h-4 w-4" /></div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
      </div>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-2">{children}</div>
  </section>
);

export default function SiteSurveyReports() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [viewingReport, setViewingReport] = useState<any | null>(null);

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ["survey-reports"],
    queryFn: siteSurveyReportAPI.getAll,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "stale",
  });

  const filtered = useMemo(() => {
    if (!reports) return [];
    const needle = search.toLowerCase();
    return reports.filter((report) => report && [
      report.reportNumber,
      report.clientFacility,
      report.focalPerson,
      report.contactNumber,
    ].some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }, [reports, search]);

  const toggleReportSelection = (reportId: string, checked: boolean) => {
    setSelectedReportIds((current) => {
      const next = new Set(current);
      if (checked) next.add(reportId);
      else next.delete(reportId);
      return next;
    });
  };

  const toggleAllVisibleReports = (checked: boolean) => {
    setSelectedReportIds((current) => {
      const next = new Set(current);
      filtered.forEach((report) => {
        if (!report.id) return;
        if (checked) next.add(report.id);
        else next.delete(report.id);
      });
      return next;
    });
  };

  const downloadPDF = async (reportId: string) => {
    try {
      const { generateSurveyReportPDF, generateTextileSurveyPDF } = await import("@/lib/surveyPDFGenerator");
      const report = reports?.find((item) => item.id === reportId);
      if (!report) return;

      if (report.category === "textile") {
        const profiles = await companyProfileAPI.getAll();
        const issmProfile = profiles.find((profile) =>
          profile.company_name.toLowerCase().includes("issm")
        ) || profiles[0];

        await generateTextileSurveyPDF({
          ...report,
          companyProfileId: issmProfile?.id,
        });
        toast.success("Textile survey PDF downloaded");
      } else {
        await generateSurveyReportPDF(report);
        toast.success("Professional PDF downloaded successfully");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    }
  };

  const downloadSelectedPDFs = async () => {
    const selectedReports = filtered.filter((report) => report.id && selectedReportIds.has(report.id));
    if (!selectedReports.length) return;

    try {
      const { generateSurveyReportPDF, generateTextileSurveyPDF } = await import("@/lib/surveyPDFGenerator");
      const profiles = selectedReports.some((report) => report.category === "textile")
        ? await companyProfileAPI.getAll()
        : [];
      const issmProfile = profiles.find((profile) =>
        profile.company_name.toLowerCase().includes("issm")
      ) || profiles[0];

      for (const report of selectedReports) {
        if (report.category === "textile") {
          await generateTextileSurveyPDF({ ...report, companyProfileId: issmProfile?.id });
        } else {
          await generateSurveyReportPDF(report);
        }
      }
      toast.success(`${selectedReports.length} separate PDF${selectedReports.length === 1 ? "" : "s"} downloaded`);
      setSelectedReportIds(new Set());
    } catch (error) {
      console.error("Error downloading selected PDFs:", error);
      toast.error("Failed to download selected PDFs");
    }
  };

  const deleteReport = async (report: any) => {
    if (!report.id || !window.confirm("Delete this survey report?")) return;

    try {
      if (report.category === "textile") {
        await textileSurveyReportAPI.delete(report.id);
      } else {
        await siteSurveyReportAPI.delete(report.id);
      }
      await refetch();
      toast.success("Survey report deleted");
    } catch (error) {
      console.error("Error deleting survey report:", error);
      toast.error("Failed to delete survey report");
    }
  };

  const duplicateReportMutation = useMutation({
    mutationFn: async (report: any) => {
      const newReportData = { ...report };
      delete newReportData.id;
      delete newReportData.created_at;
      delete newReportData.updated_at;

      if (report.category === "textile") {
        return textileSurveyReportAPI.create(newReportData);
      } else {
        return siteSurveyReportAPI.create(newReportData);
      }
    },
    onSuccess: async () => {
      await refetch();
      toast.success("Survey report duplicated successfully");
    },
    onError: (error: any) => {
      console.error("Duplicate error:", error);
      toast.error(error?.message || "Failed to duplicate report");
    },
  });

  const handleDuplicateReport = (report: any) => {
    duplicateReportMutation.mutate(report);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Site Survey Reports</h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage and view all site survey reports
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/survey-reports/category")}
          className="bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search by report number, facility, focal person, or contact number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="focus-visible:ring-2 focus-visible:ring-brand-primary"
          />
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>All Reports</CardTitle>
          <Button
            onClick={downloadSelectedPDFs}
            disabled={selectedReportIds.size === 0}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Selected ({selectedReportIds.size})
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-600">Loading reports...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              {reports && reports.length === 0
                ? "No reports created yet"
                : "No reports match your search"}
            </div>
          ) : (
            <div className="w-full overflow-x-auto -mx-6 px-6">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((report) => report.id && selectedReportIds.has(report.id))}
                        onCheckedChange={(checked) => toggleAllVisibleReports(checked === true)}
                        aria-label="Select all visible reports"
                      />
                    </TableHead>
                    <TableHead className="w-12">Sr.</TableHead>
                    <TableHead>Report No.</TableHead>
                    <TableHead>Client / Facility</TableHead>
                    <TableHead>Unit Name / No.</TableHead>
                    <TableHead>Full Address / City</TableHead>
                    <TableHead>Focal Person</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Survey Type</TableHead>
                    <TableHead>Report Date</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((report: any, index: number) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Checkbox
                          checked={Boolean(report.id && selectedReportIds.has(report.id))}
                          onCheckedChange={(checked) => report.id && toggleReportSelection(report.id, checked === true)}
                          aria-label={`Select ${report.clientFacility || report.millName || "report"}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-center text-slate-600">{filtered.length - index}</TableCell>
                      <TableCell className="font-medium text-blue-700">{report.reportNumber || "—"}</TableCell>
                      <TableCell className="font-medium">{report.clientFacility || report.millName}</TableCell>
                      <TableCell className="text-sm text-slate-600">{report.unitName || report.unitNo || "—"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{report.fullAddress || report.address || "—"}</TableCell>
                      <TableCell>{report.focalPerson || report.surveyedByName || "—"}</TableCell>
                      <TableCell>{report.contactNumber || report.millContactNumber || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {report.category === "textile" ? "Textile" : (report.surveyType || "General")}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(() => {
                          const date = report.reportDate || report.surveyDate;
                          return date && !Number.isNaN(new Date(date).getTime()) ? format(new Date(date), "dd MMM yyyy") : "—";
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingReport(report)}
                            title="View report details"
                            aria-label={`View ${report.reportNumber || "survey report"}`}
                            className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (report.category === "textile") {
                                navigate(`/survey-reports/edit/textile/${report.id}`);
                              } else {
                                navigate(`/survey-reports/${report.id}`);
                              }
                            }}
                            title="Edit"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadPDF(report.id!)}
                            title="Download PDF"
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicateReport(report)}
                            title="Duplicate"
                            disabled={duplicateReportMutation.isPending}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteReport(report)}
                            title="Delete report"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewingReport)} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-0 bg-slate-50 p-0">
          {viewingReport && (
            <>
              <DialogHeader className="bg-gradient-to-r from-indigo-700 via-blue-700 to-cyan-600 px-6 py-6 text-white sm:px-8">
                <div className="flex flex-wrap items-start justify-between gap-4 pr-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                      <ClipboardList className="h-4 w-4" /> Survey Report Details
                    </div>
                    <DialogTitle className="text-2xl font-bold text-white sm:text-3xl">
                      {viewingReport.reportNumber || "Survey Report"}
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-blue-100">
                      {viewingReport.category === "textile" ? "Textile / Mill Survey" : viewingReport.surveyType || "General Site Survey"}
                    </DialogDescription>
                  </div>
                  <Badge className="border-white/30 bg-white/15 text-white hover:bg-white/20">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    {viewingReport.reportDate || viewingReport.surveyDate || "Date not provided"}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 p-4 sm:p-8">
                {viewingReport.category === "textile" ? (
                  <>
                    <DetailSection title="Facility Identification" subtitle="Mill and survey contact information" icon={Factory} className="border-blue-200 bg-blue-50">
                      <DetailField label="Mill / Facility Name" value={viewingReport.millName || viewingReport.clientFacility} />
                      <DetailField label="Unit Name / Number" value={viewingReport.unitName} />
                      <DetailField label="Full Address" value={viewingReport.fullAddress} />
                      <DetailField label="Total Units" value={viewingReport.totalUnits} />
                      <DetailField label="Surveyed By" value={viewingReport.surveyedByName} />
                      <DetailField label="Designation" value={viewingReport.surveyedByDesignation} />
                      <DetailField label="Mill Contact Person" value={viewingReport.millContactPerson || viewingReport.focalPerson} />
                      <DetailField label="Contact Number" value={viewingReport.millContactNumber || viewingReport.contactNumber} />
                    </DetailSection>

                    <DetailSection title="Blow Room & Camera Coverage" subtitle="Inventory and entry-point details" icon={Building2} className="border-violet-200 bg-violet-50">
                      <DetailField label="Total Blow Rooms" value={viewingReport.totalBlowRooms} />
                      <DetailField label="Total Entry Points" value={viewingReport.totalEntryPoints} />
                      <div className="sm:col-span-2">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Blow Room Entries</p>
                        <div className="space-y-2">
                          {(viewingReport.blowRooms || []).length ? viewingReport.blowRooms.map((room: any, index: number) => (
                            <div key={room.id || index} className="grid gap-2 rounded-lg border border-violet-100 bg-white p-3 text-sm sm:grid-cols-4">
                              <DetailField label="Room" value={room.blowRoomNo} />
                              <DetailField label="Entry Points" value={room.entryPoints} />
                              <DetailField label="Camera Location" value={room.cameraLocation} />
                              <DetailField label="Lighting" value={room.lightingCondition} />
                            </div>
                          )) : <p className="text-sm text-slate-500">No blow room entries recorded.</p>}
                        </div>
                      </div>
                    </DetailSection>

                    <DetailSection title="Connectivity & Infrastructure" subtitle="Network, power, and equipment readiness" icon={Network} className="border-emerald-200 bg-emerald-50">
                      <DetailField label="Internet Available" value={viewingReport.internetAvailable ? "Yes" : "No"} />
                      <DetailField label="Connection Types" value={viewingReport.connectionTypes?.join(", ") || viewingReport.connectionTypesOther} />
                      <DetailField label="Bandwidth" value={viewingReport.bandwidthOption} />
                      <DetailField label="Internet Quality" value={viewingReport.internetQuality} />
                      <DetailField label="ISP Provider" value={viewingReport.ispProviderName} />
                      <DetailField label="UPS Available" value={viewingReport.upsAvailable ? "Yes" : "No"} />
                      <DetailField label="UPS Capacity / Backup" value={[viewingReport.upsCapacity, viewingReport.upsBackupTime].filter(Boolean).join(" / ")} />
                      <DetailField label="GPU / Compute" value={viewingReport.gpuCompute} />
                      <DetailField label="Camera Socket" value={viewingReport.cameraSocket ? "Available" : "Not available"} />
                      <DetailField label="Converter Socket" value={viewingReport.converterSocket ? "Available" : "Not available"} />
                      <DetailField label="Switch Socket" value={viewingReport.switchSocket ? "Available" : "Not available"} />
                      <DetailField label="Nearest Point Distance" value={viewingReport.distanceToNearestPoint} />
                    </DetailSection>

                    <DetailSection title="Observations & Sign-off" subtitle="Additional remarks and approvals" icon={CheckCircle2} className="border-amber-200 bg-amber-50">
                      <DetailField label="Waste Flow" value={viewingReport.wasteFlowOption} />
                      <DetailField label="Waste Flow Remarks" value={viewingReport.wasteFlowRemarks} />
                      <DetailField label="General Remarks" value={viewingReport.generalRemarks} />
                      <DetailField label="Surveyor Signature Date" value={viewingReport.surveyorSignatureDate} />
                      <DetailField label="Customer Representative" value={viewingReport.customerRepresentativeSignature} />
                      <DetailField label="Customer Signature Date" value={viewingReport.customerRepresentativeSignatureDate} />
                    </DetailSection>
                  </>
                ) : (
                  <>
                    <DetailSection title="Survey Information" subtitle="Client, facility, and report metadata" icon={Building2} className="border-blue-200 bg-blue-50">
                      <DetailField label="Client / Facility" value={viewingReport.clientFacility} />
                      <DetailField label="Focal Person" value={viewingReport.focalPerson} />
                      <DetailField label="Contact Number" value={viewingReport.contactNumber} />
                      <DetailField label="Project Scope" value={viewingReport.projectScope} />
                      <DetailField label="Survey Type" value={viewingReport.surveyType} />
                      <DetailField label="Report Date" value={viewingReport.reportDate} />
                      <DetailField label="Prepared By" value={viewingReport.preparedBy} />
                      <div className="sm:col-span-2"><DetailField label="Facility Overview" value={viewingReport.facilityOverview} /></div>
                    </DetailSection>

                    <DetailSection title="Gate-wise Survey Summary" subtitle="Camera requirements and gate observations" icon={ClipboardList} className="border-violet-200 bg-violet-50">
                      <div className="sm:col-span-2 space-y-2">
                        {(viewingReport.gateWiseSummary || []).length ? viewingReport.gateWiseSummary.map((item: any, index: number) => (
                          <div key={item.id || index} className="grid gap-2 rounded-lg border border-violet-100 bg-white p-3 sm:grid-cols-4">
                            <DetailField label="Gate" value={item.gateName} />
                            <DetailField label="Function" value={item.function} />
                            <DetailField label="Camera Required" value={item.cameraRequired} />
                            <DetailField label="Notes" value={item.notes} />
                          </div>
                        )) : <p className="text-sm text-slate-500">No gate-wise details recorded.</p>}
                      </div>
                    </DetailSection>

                    <DetailSection title="Network Cabling Requirements" subtitle="Required items and installation purpose" icon={Network} className="border-emerald-200 bg-emerald-50">
                      <div className="sm:col-span-2 space-y-2">
                        {(viewingReport.networkCablingRequirements || []).length ? viewingReport.networkCablingRequirements.map((item: any, index: number) => (
                          <div key={item.id || index} className="grid gap-2 rounded-lg border border-emerald-100 bg-white p-3 sm:grid-cols-3">
                            <DetailField label="Item" value={item.item} />
                            <DetailField label="Quantity" value={item.quantity} />
                            <DetailField label="Purpose" value={item.purpose} />
                          </div>
                        )) : <p className="text-sm text-slate-500">No network cabling requirements recorded.</p>}
                      </div>
                    </DetailSection>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
