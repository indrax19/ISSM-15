import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Download, Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { invoiceAPI, Invoice, InvoiceWorkflowStatus } from "@/integrations/firebase/invoiceAPI";
import { parentProjectsAPI, ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { downloadInvoicePDF, generateInvoicePDF } from "@/utils/invoicePDF";
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
const invoiceStatuses = ["Draft", "Send", "Pending", "Approved", "Reject", "Expired", "Cancelled"] as const;
const statusStyles: Record<InvoiceWorkflowStatus, string> = {
  Draft: "bg-gray-100 hover:bg-gray-200",
  Send: "bg-blue-50 hover:bg-blue-100",
  Pending: "bg-amber-50 hover:bg-amber-100",
  Approved: "bg-green-50 hover:bg-green-100",
  Reject: "bg-red-50 hover:bg-red-100",
  Expired: "bg-orange-50 hover:bg-orange-100",
  Cancelled: "bg-gray-100 text-gray-500 hover:bg-gray-200",
};
const invoiceStatus = (invoice: Invoice): InvoiceWorkflowStatus => {
  if (invoice.invoiceWorkflowStatus && invoiceStatuses.includes(invoice.invoiceWorkflowStatus as InvoiceWorkflowStatus)) return invoice.invoiceWorkflowStatus as InvoiceWorkflowStatus;
  if (invoice.invoiceStatus === "paid" || invoice.invoiceStatus === "completed") return "Approved";
  if (invoice.invoiceStatus === "cancelled") return "Cancelled";
  return "Draft";
};
const lineAmount = (invoice: Invoice) => invoice.equipment.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
const lineTax = (invoice: Invoice) => invoice.equipment.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxPercent || 0) / 100, 0);
const totalAmount = (invoice: Invoice) => lineAmount(invoice) + lineTax(invoice);
const formatPKR = (amount: number) => amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";

export default function Invoices() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [duplicateInvoice, setDuplicateInvoice] = useState<Invoice | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    parentProjectsAPI.getAllWithCounts().then(setProjects).catch(() => toast.error("Could not load project tracking projects"));
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
      const customer = invoice.customerName || invoice.invoiceTo || invoice.millName || "";
      const matchesSearch = !term || [invoice.invoiceNo, invoice.quoteReference, invoice.poNumber, customer, invoice.fbrReference]
        .some((value) => value?.toLowerCase().includes(term));
      const matchesDate = !filterDate || invoice.date?.startsWith(filterDate);
      const matchesSector = !filterSector || invoice.sectorProjectId === filterSector;
      return matchesSearch && matchesDate && matchesSector;
    });
  }, [invoices, searchTerm, filterDate, filterSector]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  useEffect(() => setCurrentPage(1), [searchTerm, filterDate, filterSector]);

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id || null);
    try {
      await downloadInvoicePDF(invoice, invoice.companyProfileId);
      toast.success("Invoice PDF downloaded");
    } catch (error: any) {
      toast.error(error?.message || "Failed to download invoice PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (invoice: Invoice) => {
    try {
      const blob = await generateInvoicePDF(invoice, invoice.companyProfileId);
      const nextUrl = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(nextUrl);
    } catch (error: any) {
      toast.error(error?.message || "Failed to preview invoice PDF");
    }
  };

  const handleStatusChange = async (invoice: Invoice, nextStatus: InvoiceWorkflowStatus) => {
    const previousStatus = invoiceStatus(invoice);
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, invoiceWorkflowStatus: nextStatus } : item));
    try {
      await invoiceAPI.update(invoice.id!, { invoiceWorkflowStatus: nextStatus });
      toast.success(`Status updated to ${nextStatus}`);
    } catch (error: any) {
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, invoiceWorkflowStatus: previousStatus } : item));
      toast.error(error?.message || "Failed to update status");
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

  const confirmDuplicate = async () => {
    if (!duplicateInvoice) return;
    const duplicate: Invoice = {
      ...duplicateInvoice,
      id: undefined,
      invoiceNo: "",
      invoiceAmount: totalAmount(duplicateInvoice),
      balancePaid: 0,
      invoiceStatus: "draft",
      invoiceWorkflowStatus: "Draft",
      equipment: duplicateInvoice.equipment.map((item) => ({ ...item })),
    };
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

  return (
    <>
      <Dialog open={Boolean(duplicateInvoice)} onOpenChange={(open) => !open && setDuplicateInvoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Clone invoice</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A new invoice number will be generated for the cloned invoice.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateInvoice(null)} disabled={duplicating}>Cancel</Button>
            <Button onClick={confirmDuplicate} disabled={duplicating}>{duplicating ? "Cloning..." : "Clone invoice"}</Button>
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
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="text-2xl font-bold sm:text-3xl">Invoices</h1><p className="mt-1 text-sm text-muted-foreground">Create, review, and download customer invoices</p></div>
          {isAdmin && <Button onClick={() => navigate("/invoices/new")} className="w-full gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-auto"><Plus className="h-4 w-4" /><span>New Invoice</span></Button>}
        </div>

        <Card><CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-3">
          <div className="space-y-2"><label htmlFor="invoice-search" className="text-sm font-medium">Search</label><Input id="invoice-search" placeholder="Search invoice number, customer, or reference..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
          <div className="space-y-2"><label htmlFor="invoice-date" className="text-sm font-medium">Filter by Issue Date</label><Input id="invoice-date" type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></div>
          <div className="space-y-2"><label htmlFor="invoice-sector" className="text-sm font-medium">Filter by Sector</label><select id="invoice-sector" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filterSector} onChange={(event) => setFilterSector(event.target.value)}><option value="">All sectors</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
        </CardContent></Card>

        {fetchError && <ErrorAlert title="Error Loading Invoices" message={fetchError} onRetry={() => { setLoading(invoices.length === 0); setRetry((value) => value + 1); }} variant="destructive" />}

        <Card className="border-0 shadow-sm"><CardContent className="p-0">
          {loading ? <ChallanTableSkeleton /> : filtered.length ? <>
            <div className="space-y-3 px-4 pt-4 md:hidden">
              {paginated.map((invoice) => {
                const status = invoiceStatus(invoice);
                const customer = invoice.customerName || invoice.invoiceTo || invoice.millName || "—";
                return <div key={invoice.id} className={`space-y-3 rounded-lg border p-4 transition-colors ${statusStyles[status]}`}>
                  <div className="flex items-start justify-between gap-2"><div><div className="font-mono font-semibold">{invoice.invoiceNo}</div><div className="text-sm text-muted-foreground">{customer}</div></div><div className="text-right text-sm font-semibold">PKR {formatPKR(totalAmount(invoice))}</div></div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Issue: {dateLabel(invoice.date)}</span><span>Due: {dateLabel(invoice.validTill)}</span><span>Sector: {invoice.sectorProjectName || "—"}</span></div>
                  <div className="space-y-2 border-t pt-2"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Status</span><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => handleStatusChange(invoice, event.target.value as InvoiceWorkflowStatus)} aria-label={`Status for ${invoice.invoiceNo}`}>{invoiceStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div className="grid w-fit grid-cols-3 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handlePreview(invoice)} title="View invoice PDF"><Eye className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${invoice.id}`)} title="Edit invoice"><Pencil className="h-4 w-4" /></Button>}
                      <Button variant="ghost" size="icon" disabled={downloadingId === invoice.id} onClick={() => handleDownload(invoice)} title="Download invoice PDF"><Download className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDuplicateInvoice(invoice)} title="Clone invoice"><Copy className="h-4 w-4" /></Button>}
                      {isAdmin && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(invoice)} title="Delete invoice"><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
            <div className="hidden overflow-x-auto md:block"><Table className="min-w-[1050px]">
              <TableHeader><TableRow><TableHead>Invoice No</TableHead><TableHead>Issue Date</TableHead><TableHead>Due Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total (PKR)</TableHead><TableHead>Sector</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{paginated.map((invoice) => {
                const status = invoiceStatus(invoice);
                return <TableRow key={invoice.id} className={statusStyles[status]}>
                  <TableCell className="font-mono font-semibold">{invoice.invoiceNo}</TableCell><TableCell>{dateLabel(invoice.date)}</TableCell><TableCell>{dateLabel(invoice.validTill)}</TableCell><TableCell>{invoice.customerName || invoice.invoiceTo || invoice.millName}</TableCell><TableCell className="text-right">{formatPKR(totalAmount(invoice))}</TableCell><TableCell>{invoice.sectorProjectName || "—"}</TableCell>
                  <TableCell><select className="h-9 min-w-28 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(event) => handleStatusChange(invoice, event.target.value as InvoiceWorkflowStatus)} aria-label={`Status for ${invoice.invoiceNo}`}>{invoiceStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></TableCell>
                  <TableCell><div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handlePreview(invoice)} title="View invoice PDF"><Eye className="h-4 w-4" /></Button>
                    {isAdmin && <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${invoice.id}`)} title="Edit invoice"><Pencil className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" disabled={downloadingId === invoice.id} onClick={() => handleDownload(invoice)} title="Download invoice PDF"><Download className="h-4 w-4" /></Button>
                    {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDuplicateInvoice(invoice)} title="Clone invoice"><Copy className="h-4 w-4" /></Button>}
                    {isAdmin && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(invoice)} title="Delete invoice"><Trash2 className="h-4 w-4" /></Button>}
                  </div></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table></div>
            <ChallanPagination currentPage={currentPage} totalPages={totalPages} filteredCount={filtered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
          </> : <EmptyState icon={FileText} title={searchTerm || filterDate || filterSector ? "No Results" : "No Invoices Yet"} description={searchTerm || filterDate || filterSector ? "No invoices match your filters" : "Create your first invoice to get started."} action={isAdmin ? { label: "New Invoice", onClick: () => navigate("/invoices/new") } : undefined} />}
        </CardContent></Card>
      </div>
    </>
  );
}
