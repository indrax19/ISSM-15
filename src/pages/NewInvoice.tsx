import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invoiceAPI, Invoice, InvoiceEquipment, InvoiceWorkflowStatus } from "@/integrations/firebase/invoiceAPI";
import { CompanyProfile, companyProfileAPI } from "@/integrations/firebase/firestore";
import { parentProjectsAPI, ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { downloadInvoicePDF } from "@/utils/invoicePDF";

const today = () => new Date().toISOString().slice(0, 10);
const defaultValidTill = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};
const emptyItem = (): InvoiceEquipment => ({ name: "", details: "", quantity: 1, taxPercent: 0, unitPrice: 0 });
const formatPKR = (amount: number) => amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const itemAmount = (item: InvoiceEquipment) => Number.isFinite(item.quantity) ? item.quantity * item.unitPrice : 0;
const itemTax = (item: InvoiceEquipment) => Math.round((itemAmount(item) * (item.taxPercent || 0) / 100 + Number.EPSILON) * 100) / 100;
const itemTotal = (item: InvoiceEquipment) => itemAmount(item) + itemTax(item);

export default function NewInvoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [companyProfileId, setCompanyProfileId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceType, setInvoiceType] = useState<"sales" | "purchase">("sales");
  const [invoiceCategory, setInvoiceCategory] = useState<"Hardware" | "Software" | "Deployment">("Hardware");
  const [legacyStatus, setLegacyStatus] = useState<Invoice["invoiceStatus"]>("draft");
  const [workflowStatus, setWorkflowStatus] = useState<InvoiceWorkflowStatus>("Draft");
  const [sectorProjectId, setSectorProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [validTill, setValidTill] = useState(defaultValidTill());
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [fbrReference, setFbrReference] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poStatus, setPoStatus] = useState<"pending" | "completed" | "cancelled">("pending");
  const [balancePaid, setBalancePaid] = useState(0);
  const [items, setItems] = useState<InvoiceEquipment[]>([emptyItem()]);
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("");

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + itemAmount(item), 0), [items]);
  const taxTotal = useMemo(() => items.reduce((sum, item) => sum + itemTax(item), 0), [items]);
  const total = subtotal + taxTotal;
  const missingFields = [
    !date && "Issue Date",
    !validTill && "Valid Till",
    !customerName.trim() && "Customer",
    ...items.flatMap((item, index) => [
      !item.name.trim() && `Item ${index + 1} Description`,
      !Number.isFinite(item.quantity) && `Item ${index + 1} Quantity`,
      !Number.isFinite(item.unitPrice) && `Item ${index + 1} Unit Price`,
      !Number.isFinite(item.taxPercent ?? 0) && `Item ${index + 1} Tax`,
    ]),
  ].filter((field): field is string => Boolean(field));

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Only administrators can create or edit invoices");
      navigate("/invoices");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    parentProjectsAPI.getAllWithCounts().then(setProjects).catch(() => toast.error("Could not load project tracking projects"));
    companyProfileAPI.getAll().then((data) => {
      setProfiles(data || []);
      const preferred = data?.find((profile) => profile.company_name === "ISSM Labelling Solutions") || data?.[0];
      if (preferred?.id) setCompanyProfileId((current) => current || preferred.id!);
    }).catch(() => toast.error("Could not load company profiles"));
  }, []);

  useEffect(() => {
    if (!id) return;
    invoiceAPI.getById(id).then((invoice) => {
      if (!invoice) {
        toast.error("Invoice not found");
        navigate("/invoices");
        return;
      }
      setInvoiceNo(invoice.invoiceNo || "");
      setInvoiceType(invoice.invoiceType === "purchase" ? "purchase" : "sales");
      setInvoiceCategory(invoice.invoiceCategory || "Hardware");
      setLegacyStatus(invoice.invoiceStatus || "draft");
      setWorkflowStatus(invoice.invoiceWorkflowStatus || "Draft");
      setDate(invoice.date || today());
      setValidTill(invoice.validTill || defaultValidTill());
      setCustomerName(invoice.customerName || invoice.invoiceTo || invoice.millName || "");
      setCustomerAddress(invoice.customerAddress || invoice.location || "");
      setCustomerPhone(invoice.customerPhone || "");
      setQuoteReference(invoice.quoteReference || invoice.poNumber || "");
      setFbrReference(invoice.fbrReference || "");
      setPoNumber(invoice.poNumber || "");
      setPoStatus(invoice.poStatus || "pending");
      setBalancePaid(invoice.balancePaid || 0);
      setItems(invoice.equipment?.length ? invoice.equipment.map((item) => ({ ...item, taxPercent: item.taxPercent ?? 0 })) : [emptyItem()]);
      setNote(invoice.note || "");
      setTerms(invoice.terms || "");
      setCompanyProfileId(invoice.companyProfileId || "");
      setSectorProjectId(invoice.sectorProjectId || "");
    }).catch(() => toast.error("Failed to load invoice")).finally(() => setLoading(false));
  }, [id, navigate]);

  const updateItem = (index: number, field: keyof InvoiceEquipment, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, [field]: field === "name" || field === "details" ? value : value === "" ? Number.NaN : Math.max(0, Number(value)) }
      : item));
  };

  const saveInvoice = async (download = false) => {
    setSaveAttempted(true);
    if (missingFields.length) {
      toast.error("Complete the customer, dates, and every line item before saving");
      return;
    }
    setSaving(true);
    try {
      const profile = profiles.find((item) => item.id === companyProfileId);
      const project = projects.find((item) => item.id === sectorProjectId);
      const payload: Invoice = {
        invoiceNo,
        invoiceType,
        invoiceCategory,
        date,
        validTill,
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim(),
        invoiceTo: customerName.trim(),
        quoteReference: quoteReference.trim(),
        fbrReference: fbrReference.trim(),
        poNumber: poNumber.trim() || undefined,
        poStatus,
        millName: customerName.trim(),
        location: customerAddress.trim(),
        equipment: items.map((item) => ({ ...item, name: item.name.trim(), details: item.details?.trim() || undefined })),
        invoiceAmount: total,
        balancePaid,
        invoiceStatus: legacyStatus,
        invoiceWorkflowStatus: workflowStatus,
        note,
        terms,
        companyProfileId: companyProfileId || undefined,
        companyProfileName: profile?.company_name,
        sectorProjectId: sectorProjectId || undefined,
        sectorProjectName: project?.name,
      };
      let saved: Invoice;
      if (id) {
        await invoiceAPI.update(id, payload);
        saved = { ...payload, id };
      } else {
        saved = await invoiceAPI.create(payload);
        setInvoiceNo(saved.invoiceNo);
      }
      toast.success(id ? "Invoice updated" : "Invoice created");
      if (download) {
        try {
          await downloadInvoicePDF(saved, saved.companyProfileId);
        } catch (error: any) {
          toast.error(error?.message || "Invoice saved, but PDF download failed");
        }
      }
      navigate("/invoices");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) return <div className="p-8 text-center text-muted-foreground">Loading invoice...</div>;

  return (
    <div className="w-full min-w-0 space-y-4 pb-6 sm:space-y-6 sm:pb-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate("/invoices")} aria-label="Back to invoices"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">{id ? "Edit Invoice" : "New Invoice"}</h1><p className="text-sm text-muted-foreground">Create and manage customer invoices</p></div>
      </div>

      {saveAttempted && missingFields.length > 0 && <div role="status" aria-live="polite" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><p className="font-medium">Missing required fields</p><ul className="mt-1 list-inside list-disc">{missingFields.map((field) => <li key={field}>{field}</li>)}</ul></div>}

      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xl">Invoice Details</CardTitle></CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-4 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-3 2xl:grid-cols-5">
          <div className="min-w-0 space-y-2"><Label>Invoice Number</Label><Input className="min-w-0" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} placeholder="Auto-generated on save" /></div>
          <div className="min-w-0 space-y-2"><Label>Issue Date *</Label><Input className={`min-w-0 ${saveAttempted && !date ? "border-destructive focus-visible:ring-destructive" : ""}`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required aria-invalid={saveAttempted && !date} /></div>
          <div className="min-w-0 space-y-2"><Label>Due Date *</Label><Input className={`min-w-0 ${saveAttempted && !validTill ? "border-destructive focus-visible:ring-destructive" : ""}`} type="date" value={validTill} onChange={(event) => setValidTill(event.target.value)} required aria-invalid={saveAttempted && !validTill} /></div>
          <div className="min-w-0 space-y-2"><Label>Invoice Reference</Label><Input className="min-w-0" value={quoteReference} onChange={(event) => setQuoteReference(event.target.value)} placeholder="e.g. INV-2026-001" /></div>
          <div className="min-w-0 space-y-2"><Label>Sector</Label><select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={sectorProjectId} onChange={(event) => setSectorProjectId(event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <div className="min-w-0 space-y-2"><Label>Company Profile</Label><select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={companyProfileId} onChange={(event) => setCompanyProfileId(event.target.value)}><option value="">Default profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.company_name}</option>)}</select></div>
          <div className="min-w-0 space-y-2"><Label>Invoice To / Customer *</Label><Input className={`min-w-0 ${saveAttempted && !customerName.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required aria-invalid={saveAttempted && !customerName.trim()} /></div>
          <div className="min-w-0 space-y-2"><Label>Phone</Label><Input className="min-w-0" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></div>
          <div className="min-w-0 space-y-2"><Label>FBR Reference</Label><Input className="min-w-0" value={fbrReference} onChange={(event) => setFbrReference(event.target.value)} placeholder="FBR reference" /></div>
          <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-3 2xl:col-span-5"><Label>Address</Label><Input className="min-w-0" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0"><CardTitle>Invoice Items</CardTitle><p className="mt-1 text-sm text-muted-foreground">Add products or services and set quantity, tax, and unit price.</p></div>
          <Button variant="default" size="sm" className="w-full sm:w-auto" onClick={() => setItems((current) => [...current, emptyItem()])}><Plus className="mr-2 h-4 w-4" />Add item</Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-3 2xl:hidden">
            {items.map((item, index) => <div key={index} className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Item {String(index + 1).padStart(2, "0")}</p><Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : [emptyItem()])} aria-label={`Remove item ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div>
              <div className="space-y-2"><Label htmlFor={`invoice-item-description-${index}`}>Description</Label><Textarea id={`invoice-item-description-${index}`} className={`min-h-20 resize-y ${saveAttempted && !item.name.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`} rows={2} value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="Enter item or service description" aria-invalid={saveAttempted && !item.name.trim()} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor={`invoice-item-quantity-${index}`}>Quantity</Label><Input id={`invoice-item-quantity-${index}`} className={saveAttempted && !Number.isFinite(item.quantity) ? "border-destructive focus-visible:ring-destructive" : ""} type="number" min="0" value={Number.isFinite(item.quantity) ? item.quantity : ""} onChange={(event) => updateItem(index, "quantity", event.target.value)} aria-invalid={saveAttempted && !Number.isFinite(item.quantity)} /></div>
                <div className="space-y-2"><Label htmlFor={`invoice-item-tax-${index}`}>Tax (%)</Label><Input id={`invoice-item-tax-${index}`} type="number" min="0" step="0.01" value={item.taxPercent ?? ""} onChange={(event) => updateItem(index, "taxPercent", event.target.value)} /></div>
                <div className="col-span-2 space-y-2"><Label htmlFor={`invoice-item-price-${index}`}>Unit Price (PKR)</Label><Input id={`invoice-item-price-${index}`} type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} placeholder="Enter price" /></div>
              </div>
              <div className="space-y-2 border-t pt-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="tabular-nums">PKR {formatPKR(itemAmount(item))}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax Amount</span><span className="tabular-nums">PKR {formatPKR(itemTax(item))}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">PKR {formatPKR(itemTotal(item))}</span></div></div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setItems((current) => [...current.slice(0, index + 1), { ...current[index] }, ...current.slice(index + 1)])}><Copy className="mr-2 h-4 w-4" />Duplicate item</Button>
            </div>)}
            <div className="overflow-hidden rounded-xl border text-sm"><div className="flex justify-between border-b px-4 py-2.5"><span>Sub-total (PKR)</span><span className="font-semibold tabular-nums">{formatPKR(subtotal)}</span></div>{taxTotal > 0 && <div className="flex justify-between border-b px-4 py-2.5"><span>Tax (PKR)</span><span className="tabular-nums">{formatPKR(taxTotal)}</span></div>}<div className="flex justify-between px-4 py-2.5 font-bold"><span>Grand Total (PKR)</span><span className="tabular-nums">{formatPKR(total)}</span></div></div>
          </div>
          <div className="hidden overflow-x-auto rounded-lg border 2xl:block"><table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="bg-muted/60"><tr className="border-b text-left"><th className="w-12 px-4 py-3 font-semibold text-muted-foreground">#</th><th className="w-[32%] px-4 py-3 font-semibold">Description</th><th className="w-16 px-4 py-3 font-semibold">Qty</th><th className="w-28 px-4 py-3 font-semibold">Unit Price</th><th className="w-36 px-4 py-3 text-right font-semibold">Amount</th><th className="w-24 px-4 py-3 font-semibold">Tax (%)</th><th className="w-36 px-4 py-3 text-right font-semibold">Tax Amount</th><th className="w-36 px-4 py-3 text-right font-semibold">Total (PKR)</th><th className="w-24 px-4 py-3 text-center font-semibold">Actions</th></tr></thead>
            <tbody>{items.map((item, index) => <tr key={index} className="border-b last:border-0 transition-colors hover:bg-muted/20">
              <td className="px-4 py-3 align-middle text-muted-foreground">{String(index + 1).padStart(2, "0")}</td>
              <td className="px-4 py-3"><Textarea className={`min-h-20 min-w-[320px] resize-y border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background ${saveAttempted && !item.name.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`} rows={2} value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="Enter item or service description" aria-label={`Item ${index + 1} description`} aria-invalid={saveAttempted && !item.name.trim()} /></td>
              <td className="px-4 py-3"><Input className={`w-16 ${!Number.isFinite(item.quantity) ? "border-destructive focus-visible:ring-destructive" : ""}`} type="number" min="0" value={Number.isFinite(item.quantity) ? item.quantity : ""} onChange={(event) => updateItem(index, "quantity", event.target.value)} aria-label={`Item ${index + 1} quantity`} aria-invalid={saveAttempted && !Number.isFinite(item.quantity)} /></td>
              <td className="px-4 py-3"><Input className="w-24" type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} aria-label={`Item ${index + 1} unit price`} /></td>
              <td className="px-4 py-3 text-right align-middle font-medium tabular-nums">{formatPKR(itemAmount(item))}</td>
              <td className="px-4 py-3"><Input className="w-20" type="number" min="0" step="0.01" value={item.taxPercent ?? ""} onChange={(event) => updateItem(index, "taxPercent", event.target.value)} aria-label={`Item ${index + 1} tax percent`} /></td>
              <td className="px-4 py-3 text-right align-middle tabular-nums">{item.taxPercent ? formatPKR(itemTax(item)) : "—"}</td><td className="px-4 py-3 text-right align-middle font-medium tabular-nums">{formatPKR(itemTotal(item))}</td>
              <td className="px-4 py-3 text-center"><div className="flex justify-center gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => setItems((current) => [...current.slice(0, index + 1), { ...current[index] }, ...current.slice(index + 1)])} aria-label={`Duplicate item ${index + 1}`}><Copy className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : [emptyItem()])} aria-label={`Remove item ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div></td>
            </tr>)}</tbody>
            <tfoot className="bg-muted/40"><tr><td colSpan={7} className="px-4 py-2 text-right">Sub-total (PKR)</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{formatPKR(subtotal)}</td><td /></tr>{taxTotal > 0 && <tr><td colSpan={7} className="px-4 py-2 text-right">Tax (PKR)</td><td className="px-4 py-2 text-right tabular-nums">{formatPKR(taxTotal)}</td><td /></tr>}<tr className="border-t font-bold"><td colSpan={7} className="px-4 py-3 text-right">Grand Total (PKR)</td><td className="px-4 py-3 text-right text-base tabular-nums">{formatPKR(total)}</td><td /></tr></tfoot>
          </table></div>
        </CardContent>
      </Card>

      <Card><CardHeader className="p-4 sm:p-6"><CardTitle className="text-xl">Note</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0"><Textarea className="w-full resize-y" value={note} onChange={(event) => setNote(event.target.value)} rows={4} /></CardContent></Card>
      <Card><CardHeader className="p-4 sm:p-6"><CardTitle className="text-xl">General Terms &amp; Conditions</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0"><Textarea className="w-full resize-y" value={terms} onChange={(event) => setTerms(event.target.value)} rows={8} /></CardContent></Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => navigate("/invoices")}>Cancel</Button><Button variant="secondary" disabled={saving} onClick={() => saveInvoice(true)}>{saving ? "Saving..." : "Save & Download PDF"}</Button><Button disabled={saving} onClick={() => saveInvoice()}>{saving ? "Saving..." : "Save Invoice"}</Button></div>
    </div>
  );
}
