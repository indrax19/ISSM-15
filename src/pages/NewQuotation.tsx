import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Bold, Italic, List, ListOrdered, Heading2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { quotationAPI, Quotation, QuotationItem } from "@/integrations/firebase/quotationAPI";
import { CompanyProfile, companyProfileAPI } from "@/integrations/firebase/firestore";
import { parentProjectsAPI, ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { downloadQuotationPDF } from "@/lib/quotationPdfGenerator";
import { DEFAULT_QUOTATION_NOTE, DEFAULT_QUOTATION_TERMS } from "@/lib/quotationDefaults";

function termsTextToHtml(text: string) {
  // Keep existing saved plain-text terms readable when opening an older quotation.
  if (/<(h[1-6]|p|ul|ol|li|strong|em|div)\b/i.test(text)) return text;
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "<p><br /></p>";
    if (trimmed.endsWith(":") && !trimmed.startsWith("-")) {
      return `<h3>${trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>`;
    }
    if (trimmed.startsWith("- ")) {
      const content = trimmed.slice(2).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<ul><li>${content}</li></ul>`;
    }
    return `<p>${trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
  }).join("");
}

function TermsRichEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef("");
  const runCommand = (command: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmitted.current = html;
      onChange(html);
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmitted.current) return;
    editor.innerHTML = termsTextToHtml(value);
  }, [value]);

  const toolbarButton = (label: string, title: string, command: string, icon: React.ReactNode, argument?: string) => (
    <Button
      key={command}
      type="button"
      variant="outline"
      size="sm"
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => runCommand(command, argument)}
    >
      {icon}<span className="ml-1 hidden sm:inline">{label}</span>
    </Button>
  );

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-2">
        {toolbarButton("Bold", "Bold", "bold", <Bold className="h-4 w-4" />)}
        {toolbarButton("Italic", "Italic", "italic", <Italic className="h-4 w-4" />)}
        {toolbarButton("Heading", "Section heading", "formatBlock", <Heading2 className="h-4 w-4" />, "h3")}
        {toolbarButton("Bullets", "Bulleted list", "insertUnorderedList", <List className="h-4 w-4" />)}
        {toolbarButton("Numbering", "Numbered list", "insertOrderedList", <ListOrdered className="h-4 w-4" />)}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="General Terms and Conditions editor"
        aria-multiline="true"
        onInput={(event) => {
          const html = event.currentTarget.innerHTML;
          lastEmitted.current = html;
          onChange(html);
        }}
        className="min-h-[280px] space-y-2 p-3 text-sm outline-none sm:min-h-[320px] sm:p-4 [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:min-h-5 [&_ul]:my-2 [&_ol]:my-2"
      />
      <p className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Select text and use Bold, Italic, Heading, Bullets, or Numbering to format the terms.
      </p>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const defaultValidTill = () => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  return date.toISOString().slice(0, 10);
};
const emptyQuotationItem = (): QuotationItem => ({ description: "", quantity: 1, taxPercent: 0, unitPrice: 0 });
const formatPKR = (amount: number) => amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const itemAmount = (item: QuotationItem) => Number.isFinite(item.quantity) ? item.quantity * item.unitPrice : 0;
const itemTaxAmount = (item: QuotationItem) => Math.round((itemAmount(item) * (item.taxPercent || 0) / 100 + Number.EPSILON) * 100) / 100;
const itemTotal = (item: QuotationItem) => itemAmount(item) + itemTaxAmount(item);

export default function NewQuotation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [companyProfileId, setCompanyProfileId] = useState("");
  const [quotationNo, setQuotationNo] = useState("");
  const [sectorProjectId, setSectorProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [validTill, setValidTill] = useState(defaultValidTill());
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [fbrReference, setFbrReference] = useState("FBR STGO NO. 27 OF 2026");
  const [items, setItems] = useState<QuotationItem[]>([emptyQuotationItem()]);
  const [note, setNote] = useState(DEFAULT_QUOTATION_NOTE);
  const [terms, setTerms] = useState(DEFAULT_QUOTATION_TERMS);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + itemAmount(item), 0), [items]);
  const fbrGst = useMemo(() => items.reduce((sum, item) => sum + itemTaxAmount(item), 0), [items]);
  const total = subtotal + fbrGst;

  useEffect(() => {
    parentProjectsAPI.getAllWithCounts().then(setProjects).catch(() => toast.error("Could not load project tracking projects"));
  }, []);

  useEffect(() => {
    companyProfileAPI.getAll().then((data) => {
      setProfiles(data || []);
      const preferred = data?.find((profile) => profile.company_name === "ISSM Labelling Solutions") || data?.[0];
      if (preferred?.id) setCompanyProfileId((current) => current || preferred.id!);
    }).catch(() => toast.error("Could not load company profiles"));
  }, []);

  useEffect(() => {
    if (!id) return;
    quotationAPI.getById(id).then((quotation) => {
      if (!quotation) {
        toast.error("Quotation not found");
        navigate("/quotations");
        return;
      }
      setQuotationNo(quotation.quotationNo);
      setIssueDate(quotation.issueDate || today());
      setValidTill(quotation.validTill || "");
      setCustomerName(quotation.customerName || "");
      setCustomerAddress(quotation.customerAddress || "");
      setCustomerPhone(quotation.customerPhone || "");
      setQuoteReference(quotation.quoteReference || "");
      setFbrReference(quotation.fbrReference || "FBR STGO NO. 27 OF 2026");
      setItems(quotation.items?.length ? quotation.items.map((item) => ({ ...item, taxPercent: item.taxPercent ?? 0 })) : [emptyQuotationItem()]);
      setNote(quotation.note ?? DEFAULT_QUOTATION_NOTE);
      setTerms(quotation.terms ?? DEFAULT_QUOTATION_TERMS);
      setCompanyProfileId(quotation.companyProfileId || "");
      setSectorProjectId(quotation.sectorProjectId || "");
    }).catch(() => toast.error("Failed to load quotation")).finally(() => setLoading(false));
  }, [id, navigate]);

  const updateItem = (index: number, field: keyof QuotationItem, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, [field]: field === "description" ? value : value === "" ? Number.NaN : Math.max(0, Number(value)) }
      : item));
  };

  const duplicateItem = (index: number) => {
    setItems((current) => [...current.slice(0, index + 1), { ...current[index] }, ...current.slice(index + 1)]);
  };

  const saveQuotation = async (download = false) => {
    setSaveAttempted(true);
    if (!customerName.trim() || !issueDate || !validTill || items.some((item) => !item.description.trim() || !Number.isFinite(item.quantity))) {
      toast.error("Complete the customer, dates, and every line item before saving");
      return;
    }
    setSaving(true);
    try {
      const profile = profiles.find((item) => item.id === companyProfileId);
      const payload: Quotation = {
        quotationNo,
        issueDate,
        validTill,
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim(),
        quoteReference: quoteReference.trim(),
        fbrReference: fbrReference.trim(),
        items,
        note,
        terms,
        companyProfileId: companyProfileId || undefined,
        companyProfileName: profile?.company_name,
        sectorProjectId: sectorProjectId || undefined,
        sectorProjectName: projects.find((project) => project.id === sectorProjectId)?.name,
      };
      let saved: Quotation;
      if (id) {
        await quotationAPI.update(id, payload);
        saved = { ...payload, id, quotationNo };
      } else {
        saved = await quotationAPI.create(payload);
        setQuotationNo(saved.quotationNo);
      }
      toast.success(id ? "Quotation updated" : "Quotation created");
      if (download) {
        try {
          await downloadQuotationPDF(saved);
        } catch (error: any) {
          toast.error(error?.message || "Quotation saved, but PDF download failed");
        }
      }
      navigate("/quotations");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading quotation...</div>;

  return (
    <div className="w-full min-w-0 space-y-4 pb-6 sm:space-y-6 sm:pb-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate("/quotations")} aria-label="Back to quotations"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">{id ? "Edit Quotation" : "New Quotation"}</h1><p className="text-sm text-muted-foreground">Create and manage customer quotations</p></div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xl">Quotation Details</CardTitle></CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-4 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-3 2xl:grid-cols-5">
          <div className="min-w-0 space-y-2"><Label>Quote Number</Label><Input className="min-w-0" value={quotationNo} placeholder="Auto-generated on save" readOnly /></div>
          <div className="min-w-0 space-y-2"><Label>Issue Date *</Label><Input className={`min-w-0 ${saveAttempted && !issueDate ? "border-destructive focus-visible:ring-destructive" : ""}`} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required aria-invalid={saveAttempted && !issueDate} /></div>
          <div className="min-w-0 space-y-2"><Label>Valid Till *</Label><Input className={`min-w-0 ${saveAttempted && !validTill ? "border-destructive focus-visible:ring-destructive" : ""}`} type="date" value={validTill} onChange={(event) => setValidTill(event.target.value)} required aria-invalid={saveAttempted && !validTill} /></div>
          <div className="min-w-0 space-y-2"><Label>Quote Reference</Label><Input className="min-w-0" value={quoteReference} onChange={(event) => setQuoteReference(event.target.value)} placeholder="e.g. Q-2026-001" /></div>
          <div className="min-w-0 space-y-2"><Label>Sector</Label><select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={sectorProjectId} onChange={(event) => setSectorProjectId(event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <div className="min-w-0 space-y-2"><Label>FBR Reference</Label><Input className="min-w-0" value={fbrReference} onChange={(event) => setFbrReference(event.target.value)} placeholder="FBR STGO NO. 27 OF 2026" /></div>
          <div className="min-w-0 space-y-2"><Label>Company Profile</Label><select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={companyProfileId} onChange={(event) => setCompanyProfileId(event.target.value)}><option value="">Default profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.company_name}</option>)}</select></div>
          <div className="min-w-0 space-y-2"><Label>Quote To / Customer *</Label><Input className={`min-w-0 ${saveAttempted && !customerName.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required aria-invalid={saveAttempted && !customerName.trim()} /></div>
          <div className="min-w-0 space-y-2"><Label>Phone</Label><Input className="min-w-0" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></div>
          <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-3 2xl:col-span-5"><Label>Address</Label><Input className="min-w-0" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0">
            <CardTitle>Quoted Items</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Add products or services and set quantity and unit price.</p>
          </div>
          <Button variant="default" size="sm" className="w-full sm:w-auto" onClick={() => setItems((current) => [...current, emptyQuotationItem()])}>
            <Plus className="mr-2 h-4 w-4" />Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-3 2xl:hidden">
            {items.map((item, index) => (
              <div key={index} className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Item {String(index + 1).padStart(2, "0")}</p>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : [emptyQuotationItem()])} aria-label={`Remove item ${index + 1}`} title="Remove item"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2"><Label htmlFor={`quotation-item-description-${index}`}>Description</Label><Textarea id={`quotation-item-description-${index}`} className={`min-h-20 resize-y ${saveAttempted && !item.description.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`} rows={2} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Enter item or service description" aria-invalid={saveAttempted && !item.description.trim()} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor={`quotation-item-quantity-${index}`}>Quantity</Label><Input id={`quotation-item-quantity-${index}`} className={saveAttempted && !Number.isFinite(item.quantity) ? "border-destructive focus-visible:ring-destructive" : ""} type="number" min="0" value={Number.isFinite(item.quantity) ? item.quantity : ""} onChange={(event) => updateItem(index, "quantity", event.target.value)} aria-invalid={saveAttempted && !Number.isFinite(item.quantity)} /></div>
                  <div className="space-y-2"><Label htmlFor={`quotation-item-tax-${index}`}>Tax Code (%)</Label><Input id={`quotation-item-tax-${index}`} type="number" min="0" step="0.01" value={item.taxPercent ?? ""} onChange={(event) => updateItem(index, "taxPercent", event.target.value)} /></div>
                  <div className="col-span-2 space-y-2"><Label htmlFor={`quotation-item-price-${index}`}>Unit Price (PKR)</Label><Input id={`quotation-item-price-${index}`} type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} placeholder="Enter price" /></div>
                </div>
                <div className="space-y-2 border-t pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="tabular-nums">PKR {formatPKR(itemAmount(item))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax Amount</span><span className="tabular-nums">PKR {formatPKR(itemTaxAmount(item))}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">PKR {formatPKR(itemTotal(item))}</span></div>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => duplicateItem(index)}><Copy className="mr-2 h-4 w-4" />Duplicate item</Button>
              </div>
            ))}
            <div className="overflow-hidden rounded-xl border text-sm">
              <div className="flex justify-between border-b px-4 py-2.5"><span>Sub-total (PKR)</span><span className="font-semibold tabular-nums">{formatPKR(subtotal)}</span></div>
              {fbrGst > 0 && <div className="flex justify-between border-b px-4 py-2.5"><span>FBR GST (PKR)</span><span className="tabular-nums">{formatPKR(fbrGst)}</span></div>}
              <div className="flex justify-between px-4 py-2.5 font-bold"><span>Grand Total (PKR)</span><span className="tabular-nums">{formatPKR(total)}</span></div>
            </div>
          </div>
          <div className="hidden overflow-x-auto rounded-lg border 2xl:block">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left">
                  <th className="w-12 px-4 py-3 font-semibold text-muted-foreground">#</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="w-24 px-4 py-3 font-semibold">Qty</th>
                  <th className="w-36 px-4 py-3 font-semibold">Unit Price</th>
                  <th className="w-36 px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="w-28 px-4 py-3 font-semibold">Tax Code (%)</th>
                  <th className="w-36 px-4 py-3 text-right font-semibold">Tax Amount</th>
                  <th className="w-36 px-4 py-3 text-right font-semibold">Total (PKR)</th>
                  <th className="w-24 px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b last:border-0 transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 align-middle text-muted-foreground">{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-3">
                      <Textarea className={`min-h-20 min-w-[240px] resize-y border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background ${saveAttempted && !item.description.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`} rows={2} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Enter item or service description" aria-label={`Item ${index + 1} description`} aria-invalid={saveAttempted && !item.description.trim()} />
                    </td>
                    <td className="px-4 py-3">
                      <Input className={`w-24 ${saveAttempted && !Number.isFinite(item.quantity) ? "border-destructive focus-visible:ring-destructive" : ""}`} type="number" min="0" value={Number.isFinite(item.quantity) ? item.quantity : ""} onChange={(event) => updateItem(index, "quantity", event.target.value)} aria-label={`Item ${index + 1} quantity`} aria-invalid={saveAttempted && !Number.isFinite(item.quantity)} />
                    </td>
                    <td className="px-4 py-3">
                      <Input className="w-32" type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} placeholder="Enter price" aria-label={`Item ${index + 1} unit price`} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle font-medium tabular-nums">{formatPKR(itemAmount(item))}</td>
                    <td className="px-4 py-3">
                      <Input className="w-24" type="number" min="0" step="0.01" value={item.taxPercent ?? ""} onChange={(event) => updateItem(index, "taxPercent", event.target.value)} aria-label={`Item ${index + 1} tax code percent`} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle tabular-nums">{item.taxPercent ? formatPKR(itemTaxAmount(item)) : "—"}</td>
                    <td className="px-4 py-3 text-right align-middle font-medium tabular-nums">{formatPKR(itemTotal(item))}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => duplicateItem(index)} aria-label={`Duplicate item ${index + 1}`} title="Duplicate item"><Copy className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : [emptyQuotationItem()])} aria-label={`Remove item ${index + 1}`} title="Remove item"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right">Sub-total (PKR)</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatPKR(subtotal)}</td>
                  <td />
                </tr>
                {fbrGst > 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-2 text-right">FBR GST (PKR)</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPKR(fbrGst)}</td>
                    <td />
                  </tr>
                )}
                <tr className="border-t font-bold">
                  <td colSpan={7} className="px-4 py-3 text-right">Grand Total (PKR)</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{formatPKR(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader className="p-4 sm:p-6"><CardTitle className="text-xl">Note</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0"><Textarea className="w-full resize-y" value={note} onChange={(event) => setNote(event.target.value)} rows={4} /></CardContent></Card>
      <Card><CardHeader className="p-4 sm:p-6"><CardTitle className="text-xl">General Terms &amp; Conditions</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0"><TermsRichEditor value={terms} onChange={setTerms} /></CardContent></Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => navigate("/quotations")}>Cancel</Button>
        <Button variant="secondary" disabled={saving} onClick={() => saveQuotation(true)}>{saving ? "Saving..." : "Save & Download PDF"}</Button>
        <Button disabled={saving} onClick={() => saveQuotation()}>{saving ? "Saving..." : "Save Quotation"}</Button>
      </div>
    </div>
  );
}
