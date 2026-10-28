import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Download, Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { invoiceAPI, INVOICE_STATUSES, Invoice, InvoiceStatus } from "@/integrations/firebase/invoiceAPI";
import { parentProjectsAPI, ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { downloadInvoicePDF, generateInvoicePDF } from "@/lib/invoicePdfGenerator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ChallanPagination from "@/components/ChallanPagination";
import ChallanTableSkeleton from "@/components/ChallanTableSkeleton";
import ErrorAlert from "@/components/ErrorAlert";
import EmptyState from "@/components/EmptyState";

const ITEMS_PER_PAGE = 10;
const invoiceStatusStyles: Record<InvoiceStatus, string> = {
  Draft: "bg-gray-100 hover:bg-gray-200",
  Send: "bg-blue-50 hover:bg-blue-100",
  Pending: "bg-amber-50 hover:bg-amber-100",
  Approved: "bg-green-50 hover:bg-green-100",
  Reject: "bg-red-50 hover:bg-red-100",
  Expired: "bg-orange-50 hover:bg-orange-100",
  Cancelled: "bg-gray-100 text-gray-500 hover:bg-gray-200",
};
const amount = (invoice: Invoice) => invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";

export default function Invoices() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [duplicateInvoice, setDuplicateInvoice] = useState<Invoice | null>(null);
  const [duplicateSectorProjectId, setDuplicateSectorProjectId] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nextSequence, setNextSequence] = useState("");
  const [sequenceLoading, setSequenceLoading] = useState(true);
  const [sequenceSaving, setSequenceSaving] = useState(false);

  useEffect(() => {
    parentProjectsAPI.getAllWithCounts().then(setProjects);
  }, []);

  useEffect(() => {
    invoiceAPI.getNextSequence()
      .then((sequence) => setNextSequence(String(sequence)))
      .catch((error: any) => toast.error(error?.message || "Could not load invoice sequence"))
      .finally(() => setSequenceLoading(false));
  }, []);

  useEffect(() => {
    setFetchError(null);
    const unsubscribe = invoiceAPI.subscribeAll((data) => {
      setInvoices(data);
      setLoading(false);
    }, (error) => {
      setFetchError(error.message || "Failed to load invoices");
      setLoading(false);
    });
    return unsubscribe;
  }, [retry]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesSearch = !term || [invoice.invoiceNo, invoice.invoiceReference, invoice.customerName, invoice.fbrReference]
        .some((value) => value?.toLowerCase().includes(term));
      const matchesDate = !filterDate || invoice.issueDate?.startsWith(filterDate);
      const matchesSector = !filterSector || invoice.sectorProjectId === filterSector;
      return matchesSearch && matchesDate && matchesSector;
    });
  }, [invoices, searchTerm, filterDate, filterSector]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [searchTerm, filterDate, filterSector]);

  const handleSequenceUpdate = async () => {
    const sequence = Number(nextSequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      toast.error("Enter a positive whole number for the next invoice sequence");
      return;
    }
    setSequenceSaving(true);
    try {
      await invoiceAPI.setNextSequence(sequence);
      setNextSequence(String(sequence));
      toast.success("Next invoice sequence updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update invoice sequence");
    } finally {
      setSequenceSaving(false);
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id || null);
    try {
      await downloadInvoicePDF(invoice);
      toast.success("Invoice PDF downloaded");
    } catch (error: any) {
      toast.error(error?.message || "Failed to download invoice PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (invoice: Invoice) => {
    try {
      const blob = await generateInvoicePDF(invoice);
      const nextUrl = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(nextUrl);
    } catch (error: any) {
      toast.error(error?.message || "Failed to preview invoice PDF");
    }
  };

  const handleStatusChange = async (invoice: Invoice, invoiceStatus: InvoiceStatus) => {
    const previousStatus = invoice.invoiceStatus || "Draft";
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, invoiceStatus } : item));
    try {
      await invoiceAPI.update(invoice.id!, { invoiceStatus });
      toast.success(`Status updated to ${invoiceStatus}`);
    } catch (error: any) {
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, invoiceStatus: previousStatus } : item));
      toast.error(error?.message || "Failed to update status");
    }
  };

  const handleDuplicate = (invoice: Invoice) => {
    setDuplicateInvoice(invoice);
    setDuplicateSectorProjectId("");
  };

  const confirmDuplicate = async () => {
    if (!duplicateInvoice || !duplicateSectorProjectId) {
      toast.error("Select a sector for the cloned invoice");
      return;
    }
    const selectedProject = projects.find((project) => project.id === duplicateSectorProjectId);
    if (!selectedProject) return;
    const duplicate = {
      ...duplicateInvoice,
      invoiceNo: "",
      invoiceStatus: "Draft" as InvoiceStatus,
      sectorProjectId: duplicateSectorProjectId,
      sectorProjectName: selectedProject.name,
      items: duplicateInvoice.items.map((item) => ({ ...item })),
    };
    delete duplicate.id;
    delete duplicate.created_at;
    delete duplicate.updated_at;
    setDuplicating(true);
    try {
      await invoiceAPI.create(duplicate);
      setDuplicateInvoice(null);
      toast.success("Invoice cloned");
    } catch (error: any) {
      toast.error(error?.message || "Failed to clone invoice");
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete invoices");
      return;
    }
    if (!window.confirm(`Delete invoice ${invoice.invoiceNo}?`)) return;
    try {
      await invoiceAPI.delete(invoice.id!);
      toast.success("Invoice deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete invoice");
    }
  };

  return (
    <>
    <Dialog open={Boolean(duplicateInvoice)} onOpenChange={(open) => !open && setDuplicateInvoice(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Clone invoice</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <label htmlFor="duplicate-invoice-sector" className="text-sm font-medium">Select sector</label>
          <select id="duplicate-invoice-sector" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={duplicateSectorProjectId} onChange={(event) => setDuplicateSectorProjectId(event.target.value)}>
            <option value="">Choose a sector</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDuplicateInvoice(null)} disabled={duplicating}>Cancel</Button>
          <Button onClick={confirmDuplicate} disabled={duplicating || !duplicateSectorProjectId}>{duplicating ? "Cloning..." : "Clone invoice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => {
      if (!open && previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Invoice PDF Preview</DialogTitle></DialogHeader>
        {previewUrl && <iframe title="Invoice PDF preview" src={previewUrl} className="h-[75vh] w-full rounded border" />}
      </DialogContent>
    </Dialog>
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl">Invoices</h1><p className="mt-1 text-sm text-muted-foreground">Create, review, and download customer invoices</p></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label htmlFor="invoice-next-sequence" className="whitespace-nowrap text-sm font-semibold">Next Invoice Sequence</label>
          <Input
            id="invoice-next-sequence"
            aria-label="Next invoice sequence"
            className="w-20"
            type="number"
            min="1"
            step="1"
            value={nextSequence}
            onChange={(event) => setNextSequence(event.target.value)}
            disabled={sequenceLoading || sequenceSaving || !isAdmin}
          />
          {isAdmin && <Button type="button" onClick={handleSequenceUpdate} disabled={sequenceLoading || sequenceSaving}>{sequenceSaving ? "Saving..." : "Update sequence"}</Button>}
          <Button onClick={() => navigate("/invoices/new")} className="gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><Plus className="h-4 w-4" /><span>New Invoice</span></Button>
        </div>
      </div>

      <Card><CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3">
        <div className="space-y-2"><label htmlFor="invoice-search" className="text-sm font-medium">Search</label><Input id="invoice-search" placeholder="Search invoice number, customer, or reference..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="invoice-date" className="text-sm font-medium">Filter by Issue Date</label><Input id="invoice-date" type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="invoice-sector" className="text-sm font-medium">Filter by Sector</label><select id="invoice-sector" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filterSector} onChange={(event) => setFilterSector(event.target.value)}><option value="">All sectors</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
      </CardContent></Card>

      {fetchError && <ErrorAlert title="Error Loading Invoices" message={fetchError} onRetry={() => { setLoading(invoices.length === 0); setRetry((value) => value + 1); }} variant="destructive" />}

      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        {loading ? <ChallanTableSkeleton /> : filtered.length ? <>
          <div className="space-y-3 px-4 pt-4 md:hidden">
            {paginated.map((invoice) => <div key={invoice.id} className={`space-y-3 rounded-lg border p-4 transition-colors ${invoiceStatusStyles[invoice.invoiceStatus || "Draft"]}`}>
              <div className="flex items-start justify-between gap-2"><div><div className="font-mono font-semibold">{invoice.invoiceNo}</div><div className="text-sm text-muted-foreground">{invoice.customerName}</div></div><div className="text-right text-sm font-semibold">PKR {amount(invoice).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</div></div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Issue: {dateLabel(invoice.issueDate)}</span><span>Valid: {dateLabel(invoice.validTill)}</span><span>Sector: {invoice.sectorProjectName || "—"}</span></div>
              <div className="space-y-2 border-t pt-2">
                <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Status</span><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={invoice.invoiceStatus || "Draft"} onChange={(event) => handleStatusChange(invoice, event.target.value as InvoiceStatus)} aria-label={`Status for ${invoice.invoiceNo}`}>{INVOICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                <div className="grid w-fit grid-cols-3 gap-1">
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-100 hover:text-sky-700 hover:shadow-sm" onClick={() => handlePreview(invoice)} title="View invoice PDF"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-100 hover:text-indigo-700 hover:shadow-sm" onClick={() => navigate(`/invoices/${invoice.id}`)} title="Edit invoice"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-100 hover:text-emerald-700 hover:shadow-sm" disabled={downloadingId === invoice.id} onClick={() => handleDownload(invoice)} title="Download PDF"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-100 hover:text-violet-700 hover:shadow-sm" onClick={() => handleDuplicate(invoice)} title="Clone invoice"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 hover:text-red-700 hover:shadow-sm" onClick={() => handleDelete(invoice)} title="Delete invoice"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>)}
          </div>
          <div className="hidden overflow-x-auto md:block"><Table className="min-w-[1100px]">
            <TableHeader><TableRow><TableHead>Invoice No</TableHead><TableHead>Issue Date</TableHead><TableHead>Valid Till</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total (PKR)</TableHead><TableHead>Sector</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{paginated.map((invoice) => <TableRow key={invoice.id} className={invoiceStatusStyles[invoice.invoiceStatus || "Draft"]}>
              <TableCell className="font-mono font-semibold">{invoice.invoiceNo}</TableCell><TableCell>{dateLabel(invoice.issueDate)}</TableCell><TableCell>{dateLabel(invoice.validTill)}</TableCell><TableCell>{invoice.customerName}</TableCell><TableCell className="text-right">{amount(invoice).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</TableCell><TableCell>{invoice.sectorProjectName || "—"}</TableCell>
              <TableCell><select className="h-9 min-w-28 rounded-md border border-input bg-background px-2 text-sm" value={invoice.invoiceStatus || "Draft"} onChange={(event) => handleStatusChange(invoice, event.target.value as InvoiceStatus)} aria-label={`Status for ${invoice.invoiceNo}`}>{INVOICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></TableCell>
              <TableCell><div className="grid w-fit grid-cols-3 gap-1">
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-100 hover:text-sky-700 hover:shadow-sm" onClick={() => handlePreview(invoice)} title="View invoice PDF"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-100 hover:text-indigo-700 hover:shadow-sm" onClick={() => navigate(`/invoices/${invoice.id}`)} title="Edit invoice"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-100 hover:text-emerald-700 hover:shadow-sm" disabled={downloadingId === invoice.id} onClick={() => handleDownload(invoice)} title="Download PDF"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-100 hover:text-violet-700 hover:shadow-sm" onClick={() => handleDuplicate(invoice)} title="Clone invoice"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 hover:text-red-700 hover:shadow-sm" onClick={() => handleDelete(invoice)} title="Delete invoice"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <ChallanPagination currentPage={currentPage} totalPages={totalPages} filteredCount={filtered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
        </> : <EmptyState icon={FileText} title={searchTerm || filterDate ? "No Results" : "No Invoices Yet"} description={searchTerm || filterDate ? "No invoices match your filters" : "Create your first invoice to get started."} action={{ label: "New Invoice", onClick: () => navigate("/invoices/new") }} />}
      </CardContent></Card>
    </div>
    </>
  );
}
