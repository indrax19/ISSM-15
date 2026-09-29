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
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SiteData {
  millName?: string;
  millLocation?: string;
  pocName?: string;
  pocContact?: string;
  gpuPassword?: string;
  anydeskId?: string;
  anydeskPassword?: string;
  anydeskId2?: string;
  anydeskPassword2?: string;
  supervisorName?: string;
  technicianName?: string;
  errors?: string[];
}

const downloadSampleTemplate = () => {
  const workbook = XLSX.utils.book_new();

  const headers = [
    'Mill Name',
    'Mill Location',
    'POC Name',
    'POC Contact',
    'GPU Password',
    'AnyDesk ID 1',
    'AnyDesk Password 1',
    'AnyDesk ID 2',
    'AnyDesk Password 2',
    'Supervisor Name',
    'Technician Name',
  ];

  const sampleData = [
    headers,
    ['ABC Textile Mill', 'Mumbai, Maharashtra', 'Rajesh Kumar', '9876543210', 'Sonicgpu786', 'AD123456', 'Sonicgpu786', 'AD789012', 'Sonicgpu786', 'Mr. Singh', 'Amit Kumar'],
    ['XYZ Cotton Mill', 'Ahmedabad, Gujarat', 'Priya Sharma', '9123456789', 'Sonicgpu786', 'AD345678', 'Sonicgpu786', '', '', 'Ms. Patel', 'Raj Singh'],
    ['DEF Spinning Unit', 'Coimbatore, Tamil Nadu', 'Arun Singh', '9234567890', 'Sonicgpu786', 'AD901234', 'Sonicgpu786', '', '', 'Mr. Murugan', 'Ravi Kumar'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sampleData);

  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sites');

  const filename = `Sample_Sites_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);

  toast.success('Sample template downloaded successfully!');
};

interface BulkImportSitesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicalProjectId?: string;
}

export function BulkImportSites({ open, onOpenChange, technicalProjectId }: BulkImportSitesProps) {
  const queryClient = useQueryClient();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<SiteData[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "complete">("upload");
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);

  const createBulkMutation = useMutation({
    mutationFn: async (data: SiteData[]) => {
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
          const siteData: SiteDetails = {
            millName: row.millName || "",
            millLocation: row.millLocation || undefined,
            pocName: row.pocName || undefined,
            pocContact: row.pocContact || undefined,
            anydeskId: row.anydeskId || undefined,
            anydeskPassword: row.anydeskPassword || "Sonicgpu786",
            anydeskId2: row.anydeskId2 || undefined,
            anydeskPassword2: row.anydeskPassword2 || "Sonicgpu786",
            supervisorName: row.supervisorName || undefined,
            technicianName: row.technicianName || undefined,
            date: new Date().toISOString().split("T")[0],
            gpuUserName: undefined,
            gpuPassword: row.gpuPassword || "Sonicgpu786",
            tailscaleIp: undefined,
            remoteanydeskPassword: "Sonicgpu786",
            remoteanydeskAccountName: undefined,
            rustdeskId: undefined,
            rustdeskPassword: "Sonicgpu786",
            rustdeskId2: undefined,
            rustdeskPassword2: "Sonicgpu786",
            pcNic: undefined,
            subnet: undefined,
            defaultGateway: undefined,
            dns: undefined,
            liveIp: undefined,
            nvrIp: undefined,
            nvrIp2: undefined,
            nvrUsername: "admin",
            nvrPassword: "Sonicnvr786",
            cameraUsername: "admin",
            cameraPassword: "Sonicnvr786",
            cameras: [],
            additionalDetails: undefined,
            hardwareCompleted: false,
            dataCopy: false,
            completionCertificate: false,
            roiCreated: false,
            technical_project_id: technicalProjectId || undefined,
          };

          console.log(`Importing row ${i + 2}: ${row.millName}`, siteData);
          await siteDetailsAPI.create(siteData);
          results.success++;
        } catch (error: any) {
          results.failed++;
          console.error(`Failed to import row ${i + 2}:`, error);
          errors.push(`Row ${i + 2} (${row.millName}): ${error.message || error}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["sites"] });
      if (technicalProjectId) {
        queryClient.invalidateQueries({ queryKey: ["site-details"] });
      }

      return { results, errors };
    },
    onSuccess: (data) => {
      setSuccessCount(data.results.success);
      setFailureCount(data.results.failed);

      if (data.results.success > 0) {
        toast.success(`${data.results.success} site(s) imported successfully`);
      }

      if (data.errors.length > 0) {
        data.errors.forEach((error) => {
          toast.error(error);
        });
      }

      setStep("complete");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to import sites");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];

        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        const findKey = (keys: string[]) => {
          return (row: any) => {
            const found = Object.keys(row).find((key) =>
              keys.some((k) => k.toLowerCase() === key.toLowerCase())
            );
            return found ? row[found] : undefined;
          };
        };

        const toString = (value: any) => {
          if (value === null || value === undefined || value === "") return undefined;
          return String(value).trim();
        };

        const mappedData: SiteData[] = jsonData.map((row) => {
          const getKey = findKey([""]);
          return {
            millName: toString(findKey(["millName", "mill name", "mill"])(row)),
            millLocation: toString(findKey(["millLocation", "mill location", "location"])(row)),
            pocName: toString(findKey(["pocName", "poc name", "poc"])(row)),
            pocContact: toString(findKey(["pocContact", "poc contact", "contact", "phone"])(row)),
            gpuPassword: toString(findKey(["gpuPassword", "gpu password"])(row)),
            anydeskId: toString(findKey(["anydeskId", "anydesk id 1", "anydesk id", "anydesk 1"])(row)),
            anydeskPassword: toString(findKey(["anydeskPassword", "anydesk password 1", "anydesk password"])(row)),
            anydeskId2: toString(findKey(["anydeskId2", "anydesk id 2", "anydesk 2"])(row)),
            anydeskPassword2: toString(findKey(["anydeskPassword2", "anydesk password 2"])(row)),
            supervisorName: toString(findKey(["supervisorName", "supervisor name", "supervisor"])(row)),
            technicianName: toString(findKey(["technicianName", "technician name", "technician"])(row)),
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
          <DialogTitle>Bulk Import Sites</DialogTitle>
          <DialogDescription>
            Import multiple sites from an Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === "upload" && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Mill Name</strong> is required. Other columns (Mill Location, POC Name, POC Contact, GPU Password, AnyDesk IDs, AnyDesk Passwords, Supervisor Name, Technician Name) are optional.
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
                onClick={() => document.getElementById("excel-upload-sites")?.click()}
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
                id="excel-upload-sites"
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
                  Review the data before importing. Rows with missing Mill Name will be skipped.
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
                        <th className="px-4 py-2 text-left font-medium">Location</th>
                        <th className="px-4 py-2 text-left font-medium">POC Name</th>
                        <th className="px-4 py-2 text-left font-medium">POC Contact</th>
                        <th className="px-4 py-2 text-left font-medium">GPU Password</th>
                        <th className="px-4 py-2 text-left font-medium">AnyDesk ID 1</th>
                        <th className="px-4 py-2 text-left font-medium">Supervisor</th>
                        <th className="px-4 py-2 text-left font-medium">Technician</th>
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
                            <td className="px-4 py-2">{row.millLocation || "—"}</td>
                            <td className="px-4 py-2">{row.pocName || "—"}</td>
                            <td className="px-4 py-2">{row.pocContact || "—"}</td>
                            <td className="px-4 py-2">{row.gpuPassword || "—"}</td>
                            <td className="px-4 py-2">{row.anydeskId || "—"}</td>
                            <td className="px-4 py-2">{row.supervisorName || "—"}</td>
                            <td className="px-4 py-2">{row.technicianName || "—"}</td>
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
                    document.getElementById("excel-upload-sites")?.click();
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
                {createBulkMutation.isPending ? "Importing..." : `Import ${validRows.length} Sites`}
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
