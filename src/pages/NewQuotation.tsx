import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { quotationAPI, Quotation, QuotationItem } from "@/integrations/firebase/quotationAPI";
import { CompanyProfile, companyProfileAPI } from "@/integrations/firebase/firestore";
import { downloadQuotationPDF } from "@/lib/quotationPdfGenerator";

export const DEFAULT_QUOTATION_NOTE = "All other material that is not included in the above quote will be provided by the client i.e., conduit, duct, piping, splicing, etc. Fiber, industrial grade, etc., and other additional and required equipment will be charged separately.";

export const DEFAULT_QUOTATION_TERMS = `Taxes & Duties:
- All prices quoted are exclusive of applicable taxes, duties and levies. Any such charges are additional and shall be borne by the client as per prevailing government regulations.
- Sales tax on services will be applied per the client's jurisdiction and preference — 5% under the Punjab Revenue Authority (PRA), 3% under the Sindh Revenue Board (SRB), or a general 15% where applicable.
- Applicable federal sales tax (GST) on hardware/goods will be charged as per prevailing FBR regulations.

Payment Schedule:
- Hardware, Supply, Software & Installation: 100% advance (bank transfer) with the Purchase Order.
- Any applicable SLA fee is billed annually in advance and is payable before installation and commissioning of the hardware/software.
- Payment Mode: direct transfer into the ISSM Labeling Solutions account (details below).
- Additional Items: The quoted amount includes only the items and services specifically mentioned. Any additional items, accessories, licenses, or services shall be charged separately.
- Quotation Validity: This quotation is valid for five (05) calendar days from the date of issuance. Prices and availability are subject to change thereafter.

Availability & Delivery:
- Availability & Delivery: Deployment activities, including hardware supply and installation, will commence upon receipt of payments as per the payment schedule. Final quantities and the installation schedule are confirmed against the site survey.
- Scope & Site Requirements: Final quantities and specifications will be confirmed based on actual requirements. Installation, cabling, civil work, electrical work, internet/network connectivity, or other site-related requirements are included only when specifically mentioned.

Payment & Cancellation:
- 100% payment is required in advance upon issuance of the PO. In case of partial or complete cancellation after PO issuance, a 25% cancellation charge on the cancelled value shall apply. Specially procured/non-cancellable items shall be subject to applicable vendor terms.

Warranty & Support:
- All applicable taxes, duties and levies are excluded and are to the client's account.
- All other material not included in this quote is provided by the client, as set out in the note above.
- Core network connectivity from the IT Room to the camera location is to be provided by the client.
- IT Room space for the NVR and network equipment is customer-provided.`;

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
        className="min-h-[320px] space-y-2 p-4 text-sm outline-none [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:min-h-5 [&_ul]:my-2 [&_ol]:my-2"
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

export default function NewQuotation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [companyProfileId, setCompanyProfileId] = useState("");
  const [quotationNo, setQuotationNo] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [validTill, setValidTill] = useState(defaultValidTill());
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [fbrReference, setFbrReference] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [note, setNote] = useState(DEFAULT_QUOTATION_NOTE);
  const [terms, setTerms] = useState(DEFAULT_QUOTATION_TERMS);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [items]);

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
      setFbrReference(quotation.fbrReference || "");
      setItems(quotation.items?.length ? quotation.items : [{ description: "", quantity: 1, unitPrice: 0 }]);
      setNote(quotation.note ?? DEFAULT_QUOTATION_NOTE);
      setTerms(quotation.terms ?? DEFAULT_QUOTATION_TERMS);
      setCompanyProfileId(quotation.companyProfileId || "");
    }).catch(() => toast.error("Failed to load quotation")).finally(() => setLoading(false));
  }, [id, navigate]);

  const updateItem = (index: number, field: keyof QuotationItem, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, [field]: field === "description" ? value : Math.max(0, Number(value) || 0) }
      : item));
  };

  const saveQuotation = async (download = false) => {
    if (!customerName.trim() || !issueDate || !validTill || items.some((item) => !item.description.trim() || item.quantity <= 0)) {
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
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("/quotations")} aria-label="Back to quotations"><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">{id ? "Edit Quotation" : "New Quotation"}</h1><p className="text-sm text-muted-foreground">Create and manage customer quotations</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle>Quotation Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2"><Label>Quote Number</Label><Input value={quotationNo} placeholder="Auto-generated on save" onChange={(event) => setQuotationNo(event.target.value)} /></div>
          <div className="space-y-2"><Label>Issue Date *</Label><Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required /></div>
          <div className="space-y-2"><Label>Valid Till *</Label><Input type="date" value={validTill} onChange={(event) => setValidTill(event.target.value)} required /></div>
          <div className="space-y-2"><Label>Quote Reference</Label><Input value={quoteReference} onChange={(event) => setQuoteReference(event.target.value)} placeholder="e.g. Q-2026-001" /></div>
          <div className="space-y-2"><Label>FBR Reference</Label><Input value={fbrReference} onChange={(event) => setFbrReference(event.target.value)} placeholder="Optional" /></div>
          <div className="space-y-2"><Label>Company Profile</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={companyProfileId} onChange={(event) => setCompanyProfileId(event.target.value)}><option value="">Default profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.company_name}</option>)}</select></div>
          <div className="space-y-2"><Label>Quote To / Customer *</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label>Address</Label><Input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>Quoted Items</CardTitle><Button variant="outline" size="sm" onClick={() => setItems((current) => [...current, { description: "", quantity: 1, unitPrice: 0 }])}><Plus className="mr-2 h-4 w-4" />Add item</Button></CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => <div key={index} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_100px_150px_120px_40px]">
            <div className="space-y-2"><Label>Description</Label><Input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Item or service description" /></div>
            <div className="space-y-2"><Label>Qty</Label><Input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></div>
            <div className="space-y-2"><Label>Unit Price (PKR)</Label><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} /></div>
            <div className="space-y-2"><Label>Total (PKR)</Label><div className="flex h-10 items-center font-medium">{(item.quantity * item.unitPrice).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</div></div>
            <Button variant="ghost" size="icon" onClick={() => setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current)} aria-label="Remove item"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>)}
          <div className="text-right text-lg font-bold">Grand Total (PKR): {total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Note</CardTitle></CardHeader><CardContent><Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} /></CardContent></Card>
      <Card><CardHeader><CardTitle>General Terms &amp; Conditions</CardTitle></CardHeader><CardContent><TermsRichEditor value={terms} onChange={setTerms} /></CardContent></Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => navigate("/quotations")}>Cancel</Button>
        <Button variant="secondary" disabled={saving} onClick={() => saveQuotation(true)}>{saving ? "Saving..." : "Save & Download PDF"}</Button>
        <Button disabled={saving} onClick={() => saveQuotation()}>{saving ? "Saving..." : "Save Quotation"}</Button>
      </div>
    </div>
  );
}
