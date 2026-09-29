import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Building2, Download, Eye, FileUp, Loader2, MessageSquarePlus, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useAuth } from "@/context/AuthContext";
import { outreachMillsAPI, type OutreachMill, type OutreachRemark } from "@/integrations/firebase/outreachMillsAPI";
import { parentProjectsAPI, type ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { projectTrackingAPI } from "@/integrations/firebase/projectTrackingAPI";
import { textileSurveyReportAPI } from "@/integrations/firebase/siteSurveyReportAPI";
import { defaultTextileData } from "@/components/SurveyTemplates/SurveyTemplateBase";
import OutreachMillDetailsDialog from "@/components/OutreachMillDetailsDialog";

const statuses = ["Outreach", "Working", "On Hold", "Follow Up", "Data Not Found", "APTMA", "Shutdown", "Obsidian", "Closed"] as const;
const categories = [
  "Textile",
  "Iron & Steel",
  "Beverages",
  "Hatchery",
  "Tyres",
  "Home Appliances",
  "Sugar",
  "Tiles",
] as const;
const emptyMill = (): Omit<OutreachMill, "id" | "created_at" | "updated_at"> => ({ spinningMill: "", unit: "", category: "Textile", city: "", address: "", phone: "", email: "", pocName: "", pocNumber: "", pocEmail: "", notes: "", remarks: [], status: "Outreach", assignedTo: "", assignedToUserId: "" });
const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const getMillCategory = (mill: OutreachMill) => mill.category?.trim() || "Textile";
const getMillStatus = (mill: OutreachMill) => mill.transferredAt ? "Transferred" : mill.status === "Active" || mill.status === "Pending" || !mill.status ? "Outreach" : mill.status === "Close" ? "Closed" : mill.status;
const importValue = (row: Record<string, unknown>, names: string[]) => Object.entries(row).find(([key]) => names.includes(normalizeKey(key)))?.[1] == null ? "" : String(Object.entries(row).find(([key]) => names.includes(normalizeKey(key)))?.[1]).trim();
const statusClass = (status: string) => ({ Outreach: "border-violet-200 bg-violet-50 text-violet-700", Working: "border-blue-200 bg-blue-50 text-blue-700", "On Hold": "border-amber-200 bg-amber-50 text-amber-700", "Follow Up": "border-emerald-200 bg-emerald-50 text-emerald-700", "Data Not Found": "border-orange-200 bg-orange-50 text-orange-700", APTMA: "border-cyan-200 bg-cyan-50 text-cyan-700", Shutdown: "border-slate-300 bg-slate-100 text-slate-700", Obsidian: "border-purple-200 bg-purple-50 text-purple-700", Closed: "border-red-200 bg-red-100 text-red-800" }[status] || "border-slate-200 bg-slate-50 text-slate-700");
const getLastUpdated = (mill: OutreachMill) => Date.parse(mill.updated_at || mill.created_at || "1970-01-01");

export default function OutreachMill() {
  const { appUser, isAdmin } = useAuth();
  const [mills, setMills] = useState<OutreachMill[]>([]);
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMill, setEditingMill] = useState<OutreachMill | null>(null);
  const [viewingMill, setViewingMill] = useState<OutreachMill | null>(null);
  const [form, setForm] = useState(emptyMill());
  const [remarksMill, setRemarksMill] = useState<OutreachMill | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [transferMill, setTransferMill] = useState<OutreachMill | null>(null);
  const [transferDestination, setTransferDestination] = useState<"project-tracking" | "survey-reports">("project-tracking");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [millPendingDelete, setMillPendingDelete] = useState<OutreachMill | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => outreachMillsAPI.subscribeAll(setMills, () => toast.error("Unable to load outreach mills.")), []);
  useEffect(() => parentProjectsAPI.subscribeAll(setProjects, () => toast.error("Unable to load project categories.")), []);
  useEffect(() => {
    const savedNames = localStorage.getItem("outreach-mill-assignee-names");
    if (savedNames) setAssigneeSuggestions(JSON.parse(savedNames));
  }, []);

  const cities = useMemo(() => [...new Set(mills.map((mill) => mill.city?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [mills]);
  const millCategories = useMemo(() => [...new Set(mills.map(getMillCategory))].sort((a, b) => a.localeCompare(b)), [mills]);
  const formCategories = useMemo(() => [...new Set([...categories, form.category?.trim() || "Textile"])], [form.category]);
  const orderedMills = useMemo(() => [...mills].sort((a, b) => getLastUpdated(b) - getLastUpdated(a)), [mills]);
  const filteredMills = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orderedMills.filter((mill) => (cityFilter === "all" || mill.city === cityFilter) && (categoryFilter === "all" || getMillCategory(mill) === categoryFilter) && (!needle || [mill.spinningMill, mill.unit, getMillCategory(mill), mill.city, mill.pocName, mill.email, mill.pocNumber, mill.assignedTo].some((value) => value?.toLowerCase().includes(needle))));
  }, [orderedMills, search, cityFilter, categoryFilter]);

  const saveMill = useMutation({
    mutationFn: async () => {
      if (!form.spinningMill.trim()) throw new Error("Spinning Mill is required");
      const data = { ...form, spinningMill: form.spinningMill.trim(), category: form.category?.trim() || "Textile", created_by: appUser?.id };
      if (editingMill?.id) await outreachMillsAPI.update(editingMill.id, data);
      else await outreachMillsAPI.create(data);
    },
    onSuccess: () => { toast.success(editingMill ? "Mill updated" : "Mill added to outreach"); closeForm(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: typeof statuses[number] }) => outreachMillsAPI.update(id, { status }), onError: () => toast.error("Unable to update status") });
  const addRemark = useMutation({
    mutationFn: async () => {
      if (!remarksMill?.id || !remarkText.trim()) throw new Error("Enter a remark first");
      const nextRemark: OutreachRemark = { id: crypto.randomUUID(), text: remarkText.trim(), createdAt: new Date().toISOString(), createdBy: appUser?.fullName };
      await outreachMillsAPI.update(remarksMill.id, { remarks: [...(remarksMill.remarks || []), nextRemark], status: "Working" });
    },
    onSuccess: () => { toast.success("Remark saved to history"); setRemarkText(""); setRemarksMill(null); },
    onError: (error: Error) => toast.error(error.message),
  });
  const transferMillMutation = useMutation({
    mutationFn: async () => {
      if (!transferMill?.id) throw new Error("Select a mill to transfer");
      const now = new Date().toISOString();
      if (transferDestination === "survey-reports") {
        const report = await textileSurveyReportAPI.create({ ...defaultTextileData, millName: transferMill.spinningMill, unitName: transferMill.unit || "Not specified", fullAddress: [transferMill.address, transferMill.city].filter(Boolean).join(", "), surveyDate: now.slice(0, 10), surveyedByName: appUser?.fullName || "", millContactPerson: transferMill.pocName || "Not specified", millContactNumber: transferMill.pocNumber || transferMill.phone || transferMill.email || "Not specified", generalRemarks: transferMill.notes || "" });
        await outreachMillsAPI.update(transferMill.id, { status: "Transferred", transferredSurveyReportId: report.id, transferredAt: now });
        return "Survey Reports";
      }
      if (!selectedProjectId) throw new Error("Select a project category");
      const today = now.slice(0, 10);
      await projectTrackingAPI.create({ project_id: selectedProjectId, millName: transferMill.spinningMill, city: transferMill.city || "Not specified", district: transferMill.city || "Not specified", address: transferMill.address, pocName: transferMill.pocName || "Not specified", pocPhone: transferMill.pocNumber || transferMill.phone || "Not specified", projectStatus: "Not Yet Started", supplierName: "", logisticsStatus: "Pending Dispatch", poStatus: "Pending", poDate: today, startDate: today, endDate: today, supervisorName: "", technicianNames: [], teamStatus: "Scheduled", hardwareStatus: "", hardwareDeliveryStatus: "Pending Dispatch" });
      await outreachMillsAPI.update(transferMill.id, { status: "Transferred", transferredProjectId: selectedProjectId, transferredAt: now });
      return "Project Tracking";
    },
    onSuccess: (destination) => { toast.success(`Mill transferred to ${destination}`); setTransferMill(null); setSelectedProjectId(""); setTransferDestination("project-tracking"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMill = useMutation({ mutationFn: (id: string) => outreachMillsAPI.delete(id), onSuccess: () => { toast.success("Mill removed"); setMillPendingDelete(null); }, onError: () => toast.error("Unable to remove mill") });

  function closeForm() { setFormOpen(false); setEditingMill(null); setForm(emptyMill()); }
  function openEdit(mill: OutreachMill) { setEditingMill(mill); setForm({ ...emptyMill(), ...mill, category: getMillCategory(mill), status: getMillStatus(mill) === "Transferred" ? "Outreach" : getMillStatus(mill) as typeof statuses[number], remarks: mill.remarks || [] }); setFormOpen(true); }
  function updateField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updateAssignee(value: string) {
    setForm((current) => ({ ...current, assignedTo: value, assignedToUserId: "" }));
  }
  function rememberAssignee(value: string) {
    const name = value.trim();
    if (!name) return;
    const nextNames = [name, ...assigneeSuggestions.filter((suggestion) => suggestion.toLowerCase() !== name.toLowerCase())];
    setAssigneeSuggestions(nextNames);
    localStorage.setItem("outreach-mill-assignee-names", JSON.stringify(nextNames));
  }
  function requestDelete(mill: OutreachMill) { if (!isAdmin) { setShowPermissionDenied(true); return; } setMillPendingDelete(mill); }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => { try {
      const workbook = XLSX.read(reader.result, { type: "array" }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const contacts = rows.map((row) => ({ spinningMill: importValue(row, ["spinningmill", "mill", "millname"]), unit: importValue(row, ["unit", "units"]), category: importValue(row, ["category"]) || "Textile", city: importValue(row, ["city"]), address: importValue(row, ["address"]), phone: importValue(row, ["phone", "phonenumber", "contactnumber"]), email: importValue(row, ["email", "millmail"]), pocName: importValue(row, ["pocname", "contactperson", "pointofcontact"]), pocNumber: importValue(row, ["pocnumber", "pocphone", "poccontact"]), pocEmail: importValue(row, ["pocmail", "pocemail"]), assignedTo: importValue(row, ["assignto", "assigneduser"]), status: (importValue(row, ["status"]) || "Outreach") as OutreachMill["status"], notes: importValue(row, ["notes", "note"]), remarks: [], created_by: appUser?.id })).filter((contact) => contact.spinningMill);
      if (!contacts.length) throw new Error("No Spinning Mill column data was found"); await Promise.all(contacts.map((contact) => outreachMillsAPI.create(contact))); toast.success(`${contacts.length} mill contacts imported`); setImportOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); } };
    reader.readAsArrayBuffer(file);
  }
  function downloadSampleExcel() { const ws = XLSX.utils.json_to_sheet([{ "Spinning Mill": "Sample Textile Mills Ltd", Unit: "Unit A", Category: "Textile", City: "Ahmedabad", "Assign To": "Rajesh Kumar", Status: "Outreach", Address: "123 Industrial Zone, Ahmedabad", Phone: "+91-9876543210", Email: "contact@sampletextile.com", "POC Name": "Rajesh Kumar", "POC Number": "+91-9876543211", "POC Email": "rajesh@sampletextile.com", Notes: "Large spinning mill" }]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Mills"); XLSX.writeFile(wb, "outreach_mill_sample.xlsx"); }
  function downloadMillsAsExcel() { if (!filteredMills.length) { toast.error("No mills to export"); return; } const data = filteredMills.map((mill) => ({ "Spinning Mill": mill.spinningMill, Unit: mill.unit || "—", Category: getMillCategory(mill), City: mill.city || "—", "Assign To": mill.assignedTo || "—", Status: getMillStatus(mill), Address: mill.address || "—", Phone: mill.phone || "—", Email: mill.email || "—", "POC Name": mill.pocName || "—", "POC Number": mill.pocNumber || "—", "POC Email": mill.pocEmail || "—", Notes: mill.notes || "—", "Remarks Count": mill.remarks?.length || 0 })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Mills"); XLSX.writeFile(wb, `outreach_mills_${new Date().toISOString().split("T")[0]}.xlsx`); }

  return <div className="min-h-full bg-slate-50/70 p-3 sm:p-5 lg:p-8"><div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-7">
    <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Lead management</div><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Outreach Mill</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage spinning-mill contacts, outreach notes, and project handovers from one focused workspace.</p></div><div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3"><input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} /><Button variant="outline" className="border-blue-200 bg-blue-50 font-semibold text-blue-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800" onClick={() => setImportOpen(true)}><FileUp className="mr-2 h-4 w-4" />Import contacts</Button><Button variant="outline" className="border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800" onClick={downloadMillsAsExcel}><Download className="mr-2 h-4 w-4" />Export</Button><Button className="bg-slate-950 font-semibold shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Add mill</Button></div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"><Card><CardContent className="flex min-h-[104px] items-center gap-4 p-5"><div className="rounded-xl bg-blue-100 p-3 text-blue-600"><Building2 className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Total mills</p><p className="text-2xl font-bold">{mills.length}</p></div></CardContent></Card><Card><CardContent className="flex min-h-[104px] items-center gap-4 p-5"><div className="rounded-xl bg-amber-100 p-3 text-amber-600"><MessageSquarePlus className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Active outreach</p><p className="text-2xl font-bold">{mills.filter((mill) => !mill.transferredAt).length}</p></div></CardContent></Card><Card><CardContent className="flex min-h-[104px] items-center gap-4 p-5"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-600"><Send className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Transferred</p><p className="text-2xl font-bold">{mills.filter((mill) => mill.transferredAt).length}</p></div></CardContent></Card></div>
    <Card className="overflow-hidden"><CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Mill contacts</CardTitle><p className="mt-1 text-sm text-slate-500">Keep contact details and follow-up history current.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mills or contacts" className="pl-9" /></div><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="sm:w-44"><SelectValue placeholder="Filter by category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{millCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select><Select value={cityFilter} onValueChange={setCityFilter}><SelectTrigger className="sm:w-44"><SelectValue placeholder="Filter by city" /></SelectTrigger><SelectContent><SelectItem value="all">All cities</SelectItem>{cities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-xs sm:text-sm [&_th:nth-child(2)]:w-[200px] [&_th:nth-child(2)]:min-w-[200px] [&_th:nth-child(2)]:max-w-[200px] [&_th:nth-child(2)]:whitespace-normal [&_th:nth-child(2)]:break-words [&_td:nth-child(2)]:w-[200px] [&_td:nth-child(2)]:min-w-[200px] [&_td:nth-child(2)]:max-w-[200px] [&_td:nth-child(2)]:whitespace-normal [&_td:nth-child(2)]:break-words [&_th:nth-child(7)]:w-[240px] [&_th:nth-child(7)]:min-w-[240px] [&_th:nth-child(7)]:max-w-[240px] [&_th:nth-child(7)]:whitespace-normal [&_th:nth-child(7)]:break-words [&_td:nth-child(7)]:w-[240px] [&_td:nth-child(7)]:min-w-[240px] [&_td:nth-child(7)]:max-w-[240px] [&_td:nth-child(7)]:whitespace-normal [&_td:nth-child(7)]:break-words"><thead className="border-y bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="w-12 px-2 py-3">Sr.</th><th className="w-[200px] px-3 py-3">Spinning Mill</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Assign To</th><th className="px-4 py-3">Phone / Email</th><th className="px-4 py-3">POC</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{filteredMills.map((mill, index) => <tr key={mill.id} className={`border-b last:border-0 ${getMillStatus(mill) === "Closed" ? "bg-red-100 text-red-950 hover:bg-red-200" : getMillStatus(mill) === "Follow Up" ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"}`}><td className="w-12 px-2 py-4">{index + 1}</td><td className="w-[200px] px-3 py-4 font-semibold">{mill.spinningMill}<p className="mt-1 max-w-64 truncate font-normal text-muted-foreground">{mill.address || "No address added"}</p></td><td className="px-4 py-4">{mill.unit || "—"}</td><td className="px-4 py-4">{getMillCategory(mill)}</td><td className="px-4 py-4">{mill.city || "—"}</td><td className="px-4 py-4">{mill.assignedTo || "—"}</td><td className="px-4 py-4"><p>{mill.phone || "—"}</p><p className="mt-1 text-muted-foreground">{mill.email || "—"}</p></td><td className="px-4 py-4"><p>{mill.pocName || "—"}</p><p className="mt-1 text-muted-foreground">{mill.pocNumber || "—"}</p></td><td className="px-4 py-4"><Button variant="outline" size="sm" className="border-purple-200 bg-purple-50 font-semibold text-purple-700 hover:border-purple-300 hover:bg-purple-100 hover:text-purple-800" onClick={() => setRemarksMill(mill)}><MessageSquarePlus className="mr-1 h-3.5 w-3.5" />{mill.remarks?.length || 0}</Button></td><td className="px-4 py-4">{mill.transferredAt ? <span className="font-medium">Transferred</span> : <Select value={getMillStatus(mill)} onValueChange={(status: typeof statuses[number]) => mill.id && updateStatus.mutate({ id: mill.id, status })}><SelectTrigger className={`h-8 w-28 text-xs font-medium ${statusClass(getMillStatus(mill))}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className={statusClass(status)}>{status}</SelectItem>)}</SelectContent></Select>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button variant="outline" size="icon" className="border-sky-200 bg-sky-50 text-sky-700 shadow-sm hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800" title="View details" onClick={() => setViewingMill(mill)}><Eye className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800" title="Edit" onClick={() => openEdit(mill)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="sm" className="border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-800" onClick={() => setTransferMill(mill)} disabled={!!mill.transferredAt}>Transfer</Button><Button variant="outline" size="icon" title="Delete" className="border-red-200 bg-red-50 text-red-600 shadow-sm hover:border-red-300 hover:bg-red-100 hover:text-red-700" onClick={() => requestDelete(mill)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table>{!filteredMills.length && <p className="p-10 text-center text-sm text-muted-foreground">No mill contacts match the current filters.</p>}</div></CardContent></Card>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent><DialogHeader><DialogTitle>Import contacts</DialogTitle><DialogDescription>Download the sample format or upload your outreach mill contacts file.</DialogDescription></DialogHeader><div className="space-y-3"><Button variant="outline" className="w-full justify-start" onClick={downloadSampleExcel}><Download className="mr-2 h-4 w-4" />Download sample Excel</Button><Button className="w-full justify-start" onClick={() => uploadRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Choose Excel or CSV file</Button></div></DialogContent></Dialog>
    <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editingMill ? "Edit outreach mill" : "Add outreach mill"}</DialogTitle><DialogDescription>Save the contact information for this spinning mill.</DialogDescription></DialogHeader><form onSubmit={(event: FormEvent) => { event.preventDefault(); saveMill.mutate(); }} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Mill Name *" value={form.spinningMill} onChange={(value) => updateField("spinningMill", value)} /><Field label="Unit" value={form.unit || ""} onChange={(value) => updateField("unit", value)} /><div><Label>Category</Label><Select value={form.category || "Textile"} onValueChange={(value) => updateField("category", value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{formCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><Field label="City" value={form.city || ""} onChange={(value) => updateField("city", value)} /><div><Label>Status</Label><Select value={form.status || "Outreach"} onValueChange={(value) => updateField("status", value)}><SelectTrigger className={`mt-2 font-medium ${statusClass(form.status || "Outreach")}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className={statusClass(status)}>{status}</SelectItem>)}</SelectContent></Select></div><div><Label>Assign To</Label><Input list="outreach-mill-assignee-suggestions" value={form.assignedTo || ""} onChange={(event) => updateAssignee(event.target.value)} onBlur={(event) => rememberAssignee(event.target.value)} placeholder="Enter assignee name" className="mt-2" /><datalist id="outreach-mill-assignee-suggestions">{assigneeSuggestions.map((name) => <option key={name} value={name} />)}</datalist></div><Field label="Phone" value={form.phone || ""} onChange={(value) => updateField("phone", value)} /><Field label="Email" type="email" value={form.email || ""} onChange={(value) => updateField("email", value)} /><Field label="POC Name" value={form.pocName || ""} onChange={(value) => updateField("pocName", value)} /><Field label="POC Number" value={form.pocNumber || ""} onChange={(value) => updateField("pocNumber", value)} /><Field label="POC Email" type="email" value={form.pocEmail || ""} onChange={(value) => updateField("pocEmail", value)} /></div><div><Label>Address</Label><Textarea value={form.address || ""} onChange={(event) => updateField("address", event.target.value)} className="mt-2" /></div><div><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} className="mt-2" /></div><DialogFooter><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveMill.isPending}>{saveMill.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save mill</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!remarksMill} onOpenChange={(open) => !open && setRemarksMill(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Follow-up Remarks</DialogTitle><DialogDescription>{remarksMill?.spinningMill}</DialogDescription></DialogHeader><div className="max-h-64 space-y-3 overflow-y-auto">{remarksMill?.remarks?.length ? [...remarksMill.remarks].reverse().map((remark) => <div key={remark.id} className="rounded-lg border p-3"><p>{remark.text}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No remarks yet.</p>}</div><div><Label>Add Remark</Label><Textarea value={remarkText} onChange={(event) => setRemarkText(event.target.value)} placeholder="Document follow-up actions or important notes..." className="mt-2" /></div><DialogFooter><Button variant="outline" onClick={() => setRemarksMill(null)}>Close</Button><Button onClick={() => addRemark.mutate()} disabled={addRemark.isPending || !remarkText.trim()}>Save Remark</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!transferMill} onOpenChange={(open) => !open && setTransferMill(null)}><DialogContent><DialogHeader><DialogTitle>Transfer site data</DialogTitle><DialogDescription>Choose where {transferMill?.spinningMill} should be transferred.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Transfer destination</Label><Select value={transferDestination} onValueChange={(value: "project-tracking" | "survey-reports") => setTransferDestination(value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project-tracking">Project Tracking</SelectItem><SelectItem value="survey-reports">Survey Reports</SelectItem></SelectContent></Select></div>{transferDestination === "project-tracking" && <div><Label>Available project categories</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger className="mt-2"><SelectValue placeholder="Select a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id!}>{project.name} ({project.projectType || "ISSM"})</SelectItem>)}</SelectContent></Select></div>}</div><DialogFooter><Button variant="outline" onClick={() => setTransferMill(null)}>Cancel</Button><Button onClick={() => transferMillMutation.mutate()} disabled={transferMillMutation.isPending || (transferDestination === "project-tracking" && !selectedProjectId)}>{transferMillMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transfer site data</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!millPendingDelete} onOpenChange={(open) => !open && setMillPendingDelete(null)}><DialogContent><DialogHeader><DialogTitle>Delete outreach mill?</DialogTitle><DialogDescription>This permanently removes {millPendingDelete?.spinningMill} and its follow-up history.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setMillPendingDelete(null)}>Cancel</Button><Button variant="destructive" onClick={() => millPendingDelete?.id && deleteMill.mutate(millPendingDelete.id)} disabled={deleteMill.isPending}>{deleteMill.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</Button></DialogFooter></DialogContent></Dialog>
    <OutreachMillDetailsDialog mill={viewingMill} onClose={() => setViewingMill(null)} />
    <PermissionDeniedDialog open={showPermissionDenied} onOpenChange={setShowPermissionDenied} message="Only administrators can delete outreach mill records." />
  </div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2" /></div>; }
