import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sslSubProjectsAPI, type SslMaintenanceVisitReport, type SslSubProject } from "@/integrations/firebase/sslSubProjectsAPI";
import { createBlankSlaReport } from "@/lib/slaVisitDefaults";

type SlaImportRow = {
  millName: string;
  unit: string;
  location: string;
  district: string;
  visitType: string;
  otherVisitType: string;
  visitNumber: string;
  slaYear: string;
  customerPocName: string;
  customerDesignation: string;
  customerContact: string;
  rowNumber: number;
};

const columns = [
  ["Mill Name", "millName", "Mill"],
  ["Unit", "unit", "Unit No", "Unit Number"],
  ["Location", "location", "City"],
  ["District", "district"],
  ["Visit Type", "visitType"],
  ["SLA Visit No.", "visitNumber", "Visit No.", "Visit Number"],
  ["SLA Year", "slaYear", "Year"],
  ["Customer POC Name", "customerPocName", "POC Name"],
  ["Customer Designation", "customerDesignation", "Designation"],
  ["Customer Contact No.", "customerContact", "Customer Contact Number", "Contact No.", "Contact Number"],
] as const;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeVisitType = (value: string) => {
  const matchedType = ["Preventive", "Corrective", "Follow-up", "Pre-Season", "Other"].find((type) => normalize(type) === normalize(value));
  return matchedType || (value ? "Other" : "");
};

const parseRows = (sheet: XLSX.WorkSheet): SlaImportRow[] => {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map((row, index) => {
    const normalizedRow = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), String(value).trim()]));
    const value = (...headers: string[]) => headers.map((header) => normalizedRow[normalize(header)]).find((item) => item !== undefined) || "";
    const visitType = value("Visit Type");
    return {
      millName: value("Mill Name", "Mill"),
      unit: value("Unit", "Unit No", "Unit Number"),
      location: value("Location", "City"),
      district: value("District"),
      visitType: normalizeVisitType(visitType),
      otherVisitType: visitType && normalizeVisitType(visitType) === "Other" && normalize(visitType) !== "other" ? visitType : value("Other Visit Type"),
      visitNumber: value("SLA Visit No.", "Visit No.", "Visit Number"),
      slaYear: value("SLA Year", "Year"),
      customerPocName: value("Customer POC Name", "POC Name"),
      customerDesignation: value("Customer Designation", "Designation"),
      customerContact: value("Customer Contact No.", "Customer Contact Number", "Contact No.", "Contact Number"),
      rowNumber: index + 2,
    };
  }).filter((row) => Object.entries(row).some(([key, value]) => key !== "rowNumber" && value));
};

const downloadTemplate = () => {
  const sheet = XLSX.utils.aoa_to_sheet([[...columns.map(([title]) => title)]]);
  sheet["!cols"] = [24, 16, 20, 18, 18, 18, 14, 24, 24, 22].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "SLA Visits");
  XLSX.writeFile(workbook, "SLA_Multiple_Sites_Template.xlsx");
};

export function BulkImportSlaVisits({
  projectId,
  projectName,
  createdBy,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  createdBy?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SlaImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const validRows = rows.filter((row) => row.millName && row.location);
  const invalidCount = rows.length - validRows.length;

  const reset = () => {
    setRows([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isImporting) return;
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Choose an Excel file (.xlsx or .xls).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) throw new Error("The Excel file does not contain a worksheet.");
        const parsedRows = parseRows(firstSheet);
        if (!parsedRows.length) throw new Error("No site rows were found in the first worksheet.");
        setRows(parsedRows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to read this Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importRows = async () => {
    if (!validRows.length) return;
    setIsImporting(true);
    const failedRows: SlaImportRow[] = [];
    let importedCount = 0;
    let firstError = "";

    for (const row of validRows) {
      const report: SslMaintenanceVisitReport = {
        ...createBlankSlaReport(projectName),
        slaYear: row.slaYear || String(new Date().getFullYear()),
        visitType: row.visitType,
        otherVisitType: row.otherVisitType,
        visitNumber: row.visitNumber,
        customerPocName: row.customerPocName,
        customerDesignation: row.customerDesignation,
        customerContact: row.customerContact,
      };
      const site: SslSubProject & { maintenanceReport: SslMaintenanceVisitReport } = {
        project_id: projectId,
        millName: row.millName,
        city: row.location,
        district: row.district,
        unitNo: row.unit,
        pocName: row.customerPocName,
        pocPhone: row.customerContact,
        projectStatus: "Not Yet Started",
        supplierName: "",
        logisticsStatus: "Pending Dispatch",
        poStatus: "Pending",
        poDate: "",
        startDate: "",
        endDate: "",
        supervisorName: "",
        technicianNames: [],
        teamStatus: "Scheduled",
        hardwareDeliveryStatus: "Pending Dispatch",
        created_by: createdBy,
        maintenanceReport: report,
      };

      try {
        await sslSubProjectsAPI.createMaintenanceVisit(site);
        importedCount += 1;
      } catch (error) {
        failedRows.push(row);
        if (!firstError) firstError = error instanceof Error ? error.message : "Import failed";
      }
    }

    const invalidRows = rows.filter((row) => !row.millName || !row.location);
    const remainingRows = [...invalidRows, ...failedRows];
    setRows(remainingRows);
    setIsImporting(false);

    if (importedCount && !remainingRows.length) {
      toast.success(`${importedCount} SLA visit${importedCount === 1 ? "" : "s"} imported.`);
      onOpenChange(false);
      reset();
      return;
    }
    if (importedCount) toast.success(`${importedCount} SLA visit${importedCount === 1 ? "" : "s"} imported.`);
    if (remainingRows.length) toast.error(`${remainingRows.length} row${remainingRows.length === 1 ? "" : "s"} need attention. ${firstError}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import multiple SLA visits</DialogTitle>
          <DialogDescription>Upload an Excel file with one site per row. Mill Name and Location are required for each visit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="gap-2" onClick={downloadTemplate} disabled={isImporting}>
              <Download className="h-4 w-4" />Download Excel template
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <Button type="button" variant="outline" className="gap-2" onClick={() => inputRef.current?.click()} disabled={isImporting}>
              <FileUp className="h-4 w-4" />Choose Excel file
            </Button>
          </div>
          <p className="text-xs text-slate-500">Columns: {columns.map(([title]) => title).join(" · ")}</p>
          {!!rows.length && <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              <span>{rows.length} rows found</span>
              <span className="font-medium text-emerald-700">{validRows.length} ready to import</span>
              {!!invalidCount && <span className="font-medium text-amber-700">{invalidCount} missing Mill Name or Location</span>}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Row</th><th className="p-2">Mill Name</th><th className="p-2">Unit</th><th className="p-2">Location</th><th className="p-2">Visit Type</th><th className="p-2">Visit No.</th><th className="p-2">Customer POC</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.rowNumber} className="border-t"><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.millName || "—"}</td><td className="p-2">{row.unit || "—"}</td><td className="p-2">{row.location || "—"}</td><td className="p-2">{row.visitType === "Other" ? row.otherVisitType || "Other" : row.visitType || "—"}</td><td className="p-2">{row.visitNumber || "—"}</td><td className="p-2">{row.customerPocName || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>Cancel</Button>
          <Button type="button" onClick={importRows} disabled={!validRows.length || isImporting} className="gap-2 bg-[#124c78] hover:bg-[#0d3d62]">
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isImporting ? "Importing..." : `Import ${validRows.length} visit${validRows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
