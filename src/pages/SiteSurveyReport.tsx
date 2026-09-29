import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  siteSurveyReportAPI,
  SiteSurveyReport,
  GateWiseSurveyItem,
  NetworkCablingItem,
} from "@/integrations/firebase/siteSurveyReportAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Download, Printer, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import { generateSurveyReportPDF } from "@/lib/surveyPDFGenerator";

export default function SiteSurveyReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form states
  const [clientFacility, setClientFacility] = useState("");
  const [focalPerson, setFocalPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [projectScope, setProjectScope] = useState("");
  const [surveyType, setSurveyType] = useState("Initial");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [preparedBy, setPreparedBy] = useState("");
  const [facilityOverview, setFacilityOverview] = useState("");
  const [gateWiseSummary, setGateWiseSummary] = useState<GateWiseSurveyItem[]>([
    { id: "1", gateName: "", function: "", cameraRequired: "", notes: "" },
  ]);
  const [networkCablingRequirements, setNetworkCablingRequirements] = useState<NetworkCablingItem[]>([
    { id: "1", item: "", quantity: "", purpose: "" },
  ]);

  const [existingReport, setExistingReport] = useState<SiteSurveyReport | null>(null);
  const [showPreview, setShowPreview] = useState(false);
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
    if (!id) {
      setExistingReport(null);
      return;
    }

    unsubscribeRef.current = siteSurveyReportAPI.subscribeById(id, (report) => {
      if (isMountedRef.current) {
        setExistingReport(report);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [id]);

  // Populate form with existing data
  useEffect(() => {
    if (existingReport) {
      setClientFacility(existingReport.clientFacility || "");
      setFocalPerson(existingReport.focalPerson || "");
      setContactNumber(existingReport.contactNumber || "");
      setProjectScope(existingReport.projectScope || "");
      setSurveyType(existingReport.surveyType || "Initial");
      setReportDate(existingReport.reportDate || new Date().toISOString().split("T")[0]);
      setPreparedBy(existingReport.preparedBy || "");
      setFacilityOverview(existingReport.facilityOverview || "");
      setGateWiseSummary(existingReport.gateWiseSummary || [{ id: "1", gateName: "", function: "", cameraRequired: "", notes: "" }]);
      setNetworkCablingRequirements(existingReport.networkCablingRequirements || [{ id: "1", item: "", quantity: "", purpose: "" }]);
    }
  }, [existingReport]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clientFacility.trim()) {
        toast.error("Client/Facility is required");
        throw new Error("Client/Facility required");
      }

      const reportData: SiteSurveyReport = {
        clientFacility,
        focalPerson,
        contactNumber,
        projectScope,
        surveyType,
        reportDate,
        preparedBy,
        facilityOverview,
        gateWiseSummary: gateWiseSummary.filter(item => item.gateName.trim()),
        networkCablingRequirements: networkCablingRequirements.filter(item => item.item.trim()),
      };

      if (existingReport?.id) {
        await siteSurveyReportAPI.update(existingReport.id, reportData);
        await queryClient.invalidateQueries({ queryKey: ["survey-reports"] });
        toast.success("Report updated successfully");
      } else {
        try {
          const result = await siteSurveyReportAPI.create(reportData);
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingReport?.id) throw new Error("No report to delete");
      await siteSurveyReportAPI.delete(existingReport.id);
      queryClient.invalidateQueries({ queryKey: ["survey-reports"] });
      navigate("/survey-reports");
      toast.success("Report deleted successfully");
    },
  });

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateSurveyReportPDF({
        id: id || "",
        clientFacility,
        focalPerson,
        contactNumber,
        projectScope,
        surveyType,
        reportDate,
        preparedBy,
        facilityOverview,
        gateWiseSummary: gateWiseSummary.map(item => ({
          gateName: item.gateName,
          function: item.function,
          cameraRequired: item.cameraRequired,
          notes: item.notes,
        })),
        networkCablingRequirements: networkCablingRequirements.map(item => ({
          item: item.item,
          quantity: item.quantity,
          purpose: item.purpose,
        })),
      });
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const addGateWiseSurveyRow = () => {
    const newId = String(Math.max(...gateWiseSummary.map(item => parseInt(item.id || "0") || 0)) + 1);
    setGateWiseSummary([...gateWiseSummary, { id: newId, gateName: "", function: "", cameraRequired: "", notes: "" }]);
  };

  const removeGateWiseSurveyRow = (id: string) => {
    setGateWiseSummary(gateWiseSummary.filter(item => item.id !== id));
  };

  const updateGateWiseSurveyRow = (id: string, field: keyof GateWiseSurveyItem, value: string) => {
    setGateWiseSummary(
      gateWiseSummary.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addNetworkCablingRow = () => {
    const newId = String(Math.max(...networkCablingRequirements.map(item => parseInt(item.id || "0") || 0)) + 1);
    setNetworkCablingRequirements([...networkCablingRequirements, { id: newId, item: "", quantity: "", purpose: "" }]);
  };

  const removeNetworkCablingRow = (id: string) => {
    setNetworkCablingRequirements(networkCablingRequirements.filter(item => item.id !== id));
  };

  const updateNetworkCablingRow = (id: string, field: keyof NetworkCablingItem, value: string) => {
    setNetworkCablingRequirements(
      networkCablingRequirements.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/survey-reports")}
              className="hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {existingReport ? "Edit Survey Report" : "Create Survey Report"}
              </h1>
              <p className="text-blue-100 mt-2 text-sm">
                {existingReport ? "Update and manage site survey details" : "Create a comprehensive site survey report"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {existingReport && (
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                disabled={saveMutation.isPending}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid gap-6">
        {/* Form Fields Card */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="text-xl text-blue-900">Survey Information</CardTitle>
            <p className="text-xs text-blue-600 mt-1">Enter basic survey and facility details</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientFacility">Client / Facility *</Label>
                <Input
                  id="clientFacility"
                  value={clientFacility}
                  onChange={(e) => setClientFacility(e.target.value)}
                  placeholder="Enter client or facility name"
                  className="focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="focalPerson">Focal Person</Label>
                <Input
                  id="focalPerson"
                  value={focalPerson}
                  onChange={(e) => setFocalPerson(e.target.value)}
                  placeholder="Enter focal person name"
                  className="focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="Enter contact number"
                  className="focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportDate">Report Date</Label>
                <Input
                  id="reportDate"
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectScope">Project Scope</Label>
                <Input
                  id="projectScope"
                  value={projectScope}
                  onChange={(e) => setProjectScope(e.target.value)}
                  placeholder="Enter project scope"
                  className="focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="surveyType">Survey Type</Label>
                <Select value={surveyType} onValueChange={setSurveyType}>
                  <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-brand-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Initial">Initial</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="preparedBy">Prepared By</Label>
                <Input
                  id="preparedBy"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Enter name of preparer"
                  className="focus-visible:ring-2 focus-visible:ring-brand-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facility Overview */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
            <CardTitle className="text-xl text-amber-900">Facility Overview</CardTitle>
            <p className="text-xs text-amber-600 mt-1">Detailed description of facility layout and features</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="facilityOverview">Facility Details</Label>
              <Textarea
                id="facilityOverview"
                value={facilityOverview}
                onChange={(e) => setFacilityOverview(e.target.value)}
                placeholder="Enter detailed facility information..."
                className="min-h-32 focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gate-Wise Survey Summary */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl text-green-900">Gate-Wise Survey Summary</CardTitle>
              <p className="text-xs text-green-600 mt-1">Document security gates and camera requirements</p>
            </div>
            <Button
              size="sm"
              onClick={addGateWiseSurveyRow}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Gate
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gate Name</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Camera Required</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateWiseSummary.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          value={row.gateName}
                          onChange={(e) => updateGateWiseSurveyRow(row.id!, "gateName", e.target.value)}
                          placeholder="Gate name"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.function}
                          onChange={(e) => updateGateWiseSurveyRow(row.id!, "function", e.target.value)}
                          placeholder="Function"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.cameraRequired}
                          onChange={(e) => updateGateWiseSurveyRow(row.id!, "cameraRequired", e.target.value)}
                          placeholder="Yes/No/Number"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.notes}
                          onChange={(e) => updateGateWiseSurveyRow(row.id!, "notes", e.target.value)}
                          placeholder="Notes"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeGateWiseSurveyRow(row.id!)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Network & Cabling Requirements */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl text-purple-900">Network & Cabling Requirements</CardTitle>
              <p className="text-xs text-purple-600 mt-1">List infrastructure and network components needed</p>
            </div>
            <Button
              size="sm"
              onClick={addNetworkCablingRow}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="w-10">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {networkCablingRequirements.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          value={row.item}
                          onChange={(e) => updateNetworkCablingRow(row.id!, "item", e.target.value)}
                          placeholder="Item name"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.quantity}
                          onChange={(e) => updateNetworkCablingRow(row.id!, "quantity", e.target.value)}
                          placeholder="Quantity"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.purpose}
                          onChange={(e) => updateNetworkCablingRow(row.id!, "purpose", e.target.value)}
                          placeholder="Purpose"
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeNetworkCablingRow(row.id!)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6 flex flex-wrap gap-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Report"
              )}
            </Button>

            <Button
              onClick={generatePDF}
              disabled={generatingPDF || saveMutation.isPending}
              variant="outline"
            >
              {generatingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </>
              )}
            </Button>

            {existingReport && (
              <Button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this report?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending || saveMutation.isPending}
                variant="destructive"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Report"
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
