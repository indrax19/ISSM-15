import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Upload, CheckCircle, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { projectTrackingAPI, type ProjectTracking } from "@/integrations/firebase/projectTrackingAPI";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProjectData {
  millName?: string;
  city?: string;
  district?: string;
  state?: string;
  unitNo?: string;
  address?: string;
  pocName?: string;
  pocPhone?: string;
  errors?: string[];
}

// Function to download sample Excel template
const downloadSampleTemplate = () => {
  const workbook = XLSX.utils.book_new();

  // Create header row
  const headers = [
    'Mill Name',
    'City',
    'District',
    'State',
    'Unit No',
    'Address',
    'POC Name',
    'POC Phone',
  ];

  // Create sample data rows
  const sampleData = [
    headers,
    ['ABC Textile Mill', 'Mumbai', 'Mumbai', 'Maharashtra', 'Unit A', '123 Industrial Area, Mumbai', 'Rajesh Kumar', '9876543210'],
    ['XYZ Cotton Mill', 'Ahmedabad', 'Ahmedabad', 'Gujarat', 'Unit B', '456 Textile Park, Ahmedabad', 'Priya Sharma', '9123456789'],
    ['DEF Spinning Unit', 'Coimbatore', 'Coimbatore', 'Tamil Nadu', 'Unit 1', '789 Spinning Complex, Coimbatore', 'Arun Singh', '9234567890'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sampleData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Mill Name
    { wch: 15 }, // City
    { wch: 15 }, // District
    { wch: 15 }, // State
    { wch: 12 }, // Unit No
    { wch: 30 }, // Address
    { wch: 20 }, // POC Name
    { wch: 15 }, // POC Phone
  ];

  // Freeze header row
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

  const filename = `Sample_Projects_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);

  toast.success('Sample template downloaded successfully!');
};

interface BulkImportProjectsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

export function BulkImportProjects({ open, onOpenChange, projectId }: BulkImportProjectsProps) {
  const queryClient = useQueryClient();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ProjectData[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "complete">("upload");
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);

  const createBulkMutation = useMutation({
    mutationFn: async (data: ProjectData[]) => {
      const results = { success: 0, failed: 0 };
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        if (!row.millName?.trim()) {
          errors.push(`Row ${i + 2}: Mill Name is required`);
          results.failed++;
          continue;
        }

        try {
          // Combine city and district for cityDistrict field
          const cityDistrict = row.city && row.district
            ? `${row.city}, ${row.district}`
            : row.city || "";

          const projectData: ProjectTracking = {
            project_id: projectId || "", // Use provided projectId or empty string
            millName: row.millName || "",
            city: row.city || "",
            district: row.district || "",
            state: row.state || "",
            unitNo: row.unitNo || "",
            address: row.address || "",
            cityDistrict: cityDistrict, // Add for backward compatibility
            pocName: row.pocName || "",
            pocPhone: row.pocPhone || "",
            projectStatus: "Not Yet Started",
            supplierName: "",
            logisticsStatus: "Pending Dispatch",
            poStatus: "Pending",
            poDate: new Date().toISOString().split("T")[0],
            startDate: new Date().toISOString().split("T")[0],
            endDate: new Date().toISOString().split("T")[0],
            supervisorName: "",
            technicianNames: [],
            teamStatus: "Scheduled",
            hardwareStatus: "Pending Dispatch",
            hardwareDeliveryStatus: "Pending Dispatch",
          };

          console.log(`Importing row ${i + 2}: ${row.millName}`, projectData);
          await projectTrackingAPI.create(projectData);
          results.success++;
        } catch (error: any) {
          results.failed++;
          console.error(`Failed to import row ${i + 2}:`, error);
          errors.push(`Row ${i + 2} (${row.millName}): ${error.message || error}`);
        }
      }

      // Invalidate query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["project_tracking"] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project_sites", projectId] });
      }

      return { results, errors };
    },
    onSuccess: (data) => {
      setSuccessCount(data.results.success);
      setFailureCount(data.results.failed);

      if (data.results.success > 0) {
        toast.success(`${data.results.success} project(s) imported successfully`);
      }

      if (data.errors.length > 0) {
        data.errors.forEach((error) => {
          toast.error(error);
        });
      }

      setStep("complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to import projects");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setExcelFile(file);

    // Parse the file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];

        // Get the data as JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        // Map Excel columns (case-insensitive)
        const mappedData: ProjectData[] = jsonData.map((row) => {
          // Find keys case-insensitively
          const findKey = (keys: string[]) => {
            const found = Object.keys(row).find((key) =>
              keys.some((k) => k.toLowerCase() === key.toLowerCase())
            );
            return found ? row[found] : undefined;
          };

          // Helper to convert any value to string, handling numbers and other types
          const toString = (value: any) => {
            if (value === null || value === undefined || value === "") return undefined;
            return String(value).trim();
          };

          return {
            millName: toString(findKey(["millName", "mill name", "mill"])),
            city: toString(findKey(["city", "city name"])),
            district: toString(findKey(["district", "district name"])),
            state: toString(findKey(["state", "state name"])),
            unitNo: toString(findKey(["unitNo", "unit no", "unit"])),
            address: toString(findKey(["address", "site address", "location"])),
            pocName: toString(findKey(["pocName", "poc name", "poc", "point of contact"])),
            pocPhone: toString(findKey(["pocPhone", "poc phone", "phone", "contact"])),
          };
        });

        setParsedData(mappedData);
        setStep("preview");
      } catch (error: any) {
        toast.error("Failed to parse Excel file: " + error.message);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read file");
    };

    reader.readAsBinaryString(file);
  };

  const handleImport = () => {
    if (parsedData.length === 0) {
      toast.error("No data to import");
      return;
    }

    createBulkMutation.mutate(parsedData);
  };

  const handleClose = () => {
    setExcelFile(null);
    setParsedData([]);
    setStep("upload");
    setSuccessCount(0);
    setFailureCount(0);
    onOpenChange(false);
  };

  const validRows = parsedData.filter((row) => row.millName);
  const invalidRows = parsedData.length - validRows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Projects</DialogTitle>
          <DialogDescription>
            Import multiple projects from an Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === "upload" && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Mill Name</strong> is required. Other columns (City, District, State, Unit No, Address, POC Name, POC Phone) are optional.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Download className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700">Need help with the format?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadSampleTemplate}
                  className="text-blue-600 hover:text-blue-700 underline p-0 h-auto font-semibold"
                >
                  Download Sample Template
                </Button>
              </div>

              <div
                onClick={() => document.getElementById("excel-upload")?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50 transition"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Click to upload Excel file
                </p>
                <p className="text-xs text-muted-foreground">
                  .xlsx or .xls files only
                </p>
              </div>

              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              {excelFile && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">{excelFile.name}</span>
                </div>
              )}
            </>
          )}

          {step === "preview" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Preview Data ({validRows.length} valid rows)</h3>
                  {invalidRows > 0 && (
                    <Badge variant="destructive">{invalidRows} invalid</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Review the data before importing. Rows with missing Mill Name will be skipped. Other fields are optional.
                </p>
              </div>

              {invalidRows > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {invalidRows} row(s) are missing Mill Name and will be skipped
                  </AlertDescription>
                </Alert>
              )}

              <Card className="max-h-96 overflow-x-auto">
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Mill Name</th>
                        <th className="px-4 py-2 text-left font-medium">City</th>
                        <th className="px-4 py-2 text-left font-medium">District</th>
                        <th className="px-4 py-2 text-left font-medium">State</th>
                        <th className="px-4 py-2 text-left font-medium">Unit No</th>
                        <th className="px-4 py-2 text-left font-medium">Address</th>
                        <th className="px-4 py-2 text-left font-medium">POC Name</th>
                        <th className="px-4 py-2 text-left font-medium">POC Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, idx) => {
                        const isValid = row.millName;
                        return (
                          <tr
                            key={idx}
                            className={`border-b ${
                              !isValid ? "bg-red-50" : idx % 2 === 0 ? "bg-muted/30" : ""
                            }`}
                          >
                            <td className="px-4 py-2">{row.millName || "—"}</td>
                            <td className="px-4 py-2">{row.city || "—"}</td>
                            <td className="px-4 py-2">{row.district || "—"}</td>
                            <td className="px-4 py-2">{row.state || "—"}</td>
                            <td className="px-4 py-2">{row.unitNo || "—"}</td>
                            <td className="px-4 py-2">{row.address || "—"}</td>
                            <td className="px-4 py-2">{row.pocName || "—"}</td>
                            <td className="px-4 py-2">{row.pocPhone || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}

          {step === "complete" && (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Import completed
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-muted-foreground text-sm mb-2">Successfully Imported</p>
                      <p className="text-3xl font-bold text-green-600">{successCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-muted-foreground text-sm mb-2">Failed</p>
                      <p className={`text-3xl font-bold ${failureCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        {failureCount}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (excelFile) {
                    document.getElementById("excel-upload")?.click();
                  }
                }}
                disabled={!excelFile}
              >
                Choose Another File
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || createBulkMutation.isPending}
              >
                {createBulkMutation.isPending ? "Importing..." : `Import ${validRows.length} Projects`}
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
