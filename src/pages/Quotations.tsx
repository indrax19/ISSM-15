import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Copy, Download, Eye, FileText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { quotationAPI, Quotation } from "@/integrations/firebase/quotationAPI";
import { downloadQuotationPDF, generateQuotationPDF } from "@/lib/quotationPdfGenerator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ChallanPagination from "@/components/ChallanPagination";
import ChallanTableSkeleton from "@/components/ChallanTableSkeleton";
import ErrorAlert from "@/components/ErrorAlert";
import EmptyState from "@/components/EmptyState";

const ITEMS_PER_PAGE = 10;
const amount = (quotation: Quotation) => quotation.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";

export default function Quotations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    const unsubscribe = quotationAPI.subscribeAll((data) => {
      setQuotations(data);
      setLoading(false);
    }, (error) => {
      setFetchError(error.message || "Failed to load quotations");
      setLoading(false);
    });
    return unsubscribe;
  }, [retry]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return quotations.filter((quotation) => {
      const matchesSearch = !term || [quotation.quotationNo, quotation.quoteReference, quotation.customerName, quotation.fbrReference]
        .some((value) => value?.toLowerCase().includes(term));
      return matchesSearch && (!filterDate || quotation.issueDate?.startsWith(filterDate));
    });
  }, [quotations, searchTerm, filterDate]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [searchTerm, filterDate]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRetry((value) => value + 1);
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
    toast.success("Quotations refreshed");
    setTimeout(() => setRefreshing(false), 500);
  }, [queryClient]);

  const handleDownload = async (quotation: Quotation) => {
    setDownloadingId(quotation.id || null);
    try {
      await downloadQuotationPDF(quotation);
      toast.success("Quotation PDF downloaded");
    } catch (error: any) {
      toast.error(error?.message || "Failed to download quotation PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (quotation: Quotation) => {
    try {
      const blob = await generateQuotationPDF(quotation);
      const nextUrl = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(nextUrl);
    } catch (error: any) {
      toast.error(error?.message || "Failed to preview quotation PDF");
    }
  };

  const handleDuplicate = async (quotation: Quotation) => {
    const duplicate = { ...quotation, quotationNo: "", items: quotation.items.map((item) => ({ ...item })) };
    delete duplicate.id;
    delete duplicate.created_at;
    delete duplicate.updated_at;
    try {
      await quotationAPI.create(duplicate);
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation duplicated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to duplicate quotation");
    }
  };

  const handleDelete = async (quotation: Quotation) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete quotations");
      return;
    }
    if (!window.confirm(`Delete quotation ${quotation.quotationNo}?`)) return;
    try {
      await quotationAPI.delete(quotation.id!);
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete quotation");
    }
  };

  return (
    <>
    <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => {
      if (!open && previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Quotation PDF Preview</DialogTitle></DialogHeader>
        {previewUrl && <iframe title="Quotation PDF preview" src={previewUrl} className="h-[75vh] w-full rounded border" />}
      </DialogContent>
    </Dialog>
    <div className="space-y-6 pb-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-bold sm:text-3xl">Quotations</h1><p className="mt-1 text-sm text-muted-foreground">Create, review, and download customer quotations</p></div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button onClick={handleRefresh} variant="outline" size="icon" disabled={refreshing} title="Refresh quotations"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button>
          <Button onClick={() => navigate("/quotations/new")} className="flex-1 gap-2 sm:flex-none"><Plus className="h-4 w-4" /><span>New Quotation</span></Button>
        </div>
      </div>

      <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
        <div className="space-y-2"><label htmlFor="quotation-search" className="text-sm font-medium">Search</label><Input id="quotation-search" placeholder="Search quote number, customer, or reference..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
        <div className="space-y-2"><label htmlFor="quotation-date" className="text-sm font-medium">Filter by Issue Date</label><Input id="quotation-date" type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></div>
      </CardContent></Card>

      {fetchError && <ErrorAlert title="Error Loading Quotations" message={fetchError} onRetry={() => setRetry((value) => value + 1)} variant="destructive" />}

      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        {loading ? <ChallanTableSkeleton /> : filtered.length ? <>
          <div className="space-y-3 px-4 pt-4 md:hidden">
            {paginated.map((quotation) => <div key={quotation.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-mono font-semibold">{quotation.quotationNo}</div><div className="text-sm text-muted-foreground">{quotation.customerName}</div></div><div className="text-right text-sm font-semibold">PKR {amount(quotation).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</div></div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Issue: {dateLabel(quotation.issueDate)}</span><span>Valid: {dateLabel(quotation.validTill)}</span></div>
              <div className="flex justify-end gap-1 border-t pt-2">
                <Button variant="ghost" size="icon" onClick={() => handlePreview(quotation)} title="View quotation PDF"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/quotations/${quotation.id}`)} title="Edit quotation"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" disabled={downloadingId === quotation.id} onClick={() => handleDownload(quotation)} title="Download PDF"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDuplicate(quotation)} title="Duplicate quotation"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(quotation)} title="Delete quotation"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>)}
          </div>
          <div className="hidden overflow-x-auto md:block"><Table className="min-w-[850px]">
            <TableHeader><TableRow><TableHead>Quote No</TableHead><TableHead>Issue Date</TableHead><TableHead>Valid Till</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total (PKR)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{paginated.map((quotation) => <TableRow key={quotation.id}>
              <TableCell className="font-mono font-semibold">{quotation.quotationNo}</TableCell><TableCell>{dateLabel(quotation.issueDate)}</TableCell><TableCell>{dateLabel(quotation.validTill)}</TableCell><TableCell>{quotation.customerName}</TableCell><TableCell className="text-right">{amount(quotation).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</TableCell>
              <TableCell><div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => handlePreview(quotation)} title="View quotation PDF"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/quotations/${quotation.id}`)} title="Edit quotation"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" disabled={downloadingId === quotation.id} onClick={() => handleDownload(quotation)} title="Download PDF"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDuplicate(quotation)} title="Duplicate quotation"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(quotation)} title="Delete quotation"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <ChallanPagination currentPage={currentPage} totalPages={totalPages} filteredCount={filtered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
        </> : <EmptyState icon={FileText} title={searchTerm || filterDate ? "No Results" : "No Quotations Yet"} description={searchTerm || filterDate ? "No quotations match your filters" : "Create your first quotation to get started."} action={{ label: "New Quotation", onClick: () => navigate("/quotations/new") }} />}
      </CardContent></Card>
    </div>
    </>
  );
}
