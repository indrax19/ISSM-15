import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Building2, Download, FileUp, FolderOpen, MapPin, Pencil, Plus, Search, Trash2, ArrowLeft, Eye, Loader2, MessageSquarePlus, Send, Upload, X, CalendarDays } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { parentProjectsAPI as trackingProjectsAPI, type ParentProject } from "@/integrations/firebase/parentProjectsAPI";
import { outreachProjectsAPI, type OutreachProject } from "@/integrations/firebase/outreachProjectsAPI";
import { outreachMillsAPI, type OutreachMill, type OutreachMillPoc, type OutreachRemark } from "@/integrations/firebase/outreachMillsAPI";
import { projectTrackingAPI } from "@/integrations/firebase/projectTrackingAPI";
import { quotationAPI } from "@/integrations/firebase/quotationAPI";
import { DEFAULT_QUOTATION_NOTE, DEFAULT_QUOTATION_TERMS } from "@/lib/quotationDefaults";
import { textileSurveyReportAPI } from "@/integrations/firebase/siteSurveyReportAPI";
import { defaultTextileData } from "@/components/SurveyTemplates/SurveyTemplateBase";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OutreachMillDetailsDialog from "@/components/OutreachMillDetailsDialog";

const statuses = ["Outreach", "Connected", "Visit schedule", "Survey Form", "Quote sent", "Working", "On Hold", "Follow Up", "Data Not Found", "Association", "Other Vendor", "Shutdown", "Closed"] as const;
const statusClass = (status: string) => ({ Outreach: "border-violet-200 bg-violet-50 text-violet-700", Connected: "border-cyan-200 bg-cyan-50 text-cyan-700", "Visit schedule": "border-blue-200 bg-blue-50 text-blue-700", "Survey Form": "border-amber-200 bg-amber-50 text-amber-700", "Quote sent": "border-emerald-200 bg-emerald-50 text-emerald-700", Working: "border-blue-200 bg-blue-50 text-blue-700", "On Hold": "border-amber-200 bg-amber-50 text-amber-700", "Follow Up": "border-emerald-200 bg-emerald-50 text-emerald-700", "Data Not Found": "border-orange-200 bg-orange-50 text-orange-700", Association: "border-cyan-200 bg-cyan-50 text-cyan-700", "Other Vendor": "border-slate-300 bg-slate-200 text-slate-800", Shutdown: "border-rose-200 bg-rose-50 text-rose-700", Closed: "border-red-200 bg-red-100 text-red-800" }[status] || "border-slate-200 bg-slate-50 text-slate-700");
const isTerminalMillStatus = (status?: string) => /^(closed|shutdown|Other Vendor)$/i.test(status?.trim() || "");
const scheduleDateLabel = (value?: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  const monthName = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1];
  return year && monthName && day ? `${day} ${monthName}` : value;
};
const millUpdatedAt = (mill: OutreachMill) => Date.parse(mill.updated_at || mill.created_at || "") || 0;
const updatedDateLabel = (mill: OutreachMill) => millUpdatedAt(mill) ? new Date(millUpdatedAt(mill)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";
const pageButtonClass = "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 hover:-translate-y-px hover:shadow-sm active:translate-y-0";
const tableActionButtonClass = "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2";
const emptyMill = (): Omit<OutreachMill, "id" | "created_at" | "updated_at"> => ({
  spinningMill: "", unit: "", category: "Textile", city: "", address: "", phone: "", email: "",
  pocName: "", pocNumber: "", pocEmail: "", pocs: [{ name: "", number: "", email: "" }], notes: "", remarks: [], status: "Outreach", assignedTo: "", assignedToUserId: "",
});

export default function OutreachMillHierarchy() {
  const { id } = useParams<{ id: string }>();
  return id ? <OutreachProjectDetail projectId={id} /> : <OutreachProjects />;
}

function OutreachProjects() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<OutreachProject[]>([]);
  const [mills, setMills] = useState<OutreachMill[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [editingProject, setEditingProject] = useState<OutreachProject | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<OutreachProject | null>(null);

  useEffect(() => outreachProjectsAPI.subscribeAll(setProjects, () => toast.error("Unable to load outreach projects.")), []);
  useEffect(() => outreachMillsAPI.subscribeAll(setMills, () => toast.error("Unable to load outreach mills.")), []);

  const outreachProjects = projects;
  const visibleProjects = useMemo(() => outreachProjects.filter((project) => !search.trim() || project.name.toLowerCase().includes(search.toLowerCase()) || project.description?.toLowerCase().includes(search.toLowerCase())), [outreachProjects, search]);
  const matchingMills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? mills.filter((mill) => mill.city?.toLowerCase().includes(query)) : [];
  }, [mills, search]);
  const counts = useMemo(() => new Map(outreachProjects.map((project) => [project.id, mills.filter((mill) => mill.parentProjectId === project.id).length])), [outreachProjects, mills]);
  const latestUpdatedMills = useMemo(() => [...mills].sort((a, b) => millUpdatedAt(b) - millUpdatedAt(a)).slice(0, 10), [mills]);
  const scheduledMills = useMemo(() => mills.filter((mill) => /^(visit schedule|schedule)$/i.test(mill.status?.trim() || "")).sort((a, b) => (a.scheduledDate || "9999-12-31").localeCompare(b.scheduledDate || "9999-12-31")), [mills]);

  useEffect(() => {
    if (!isAdmin) return;
    const sector = projects.find((project) => project.name.trim().toLowerCase() === "textile sector");
    const textile = projects.find((project) => project.name.trim().toLowerCase() === "textile");
    if (!sector?.id || !textile?.id || sector.id === textile.id) return;
    const millsToMove = mills.filter((mill) => mill.id && mill.parentProjectId === textile.id);
    if (!millsToMove.length) {
      outreachProjectsAPI.delete(textile.id).catch(() => toast.error("Unable to remove the old Textile project."));
      return;
    }
    Promise.all(millsToMove.map((mill) => outreachMillsAPI.update(mill.id!, { parentProjectId: sector.id })))
      .then(() => outreachProjectsAPI.delete(textile.id))
      .catch(() => toast.error("Unable to move existing mills to Textile Sector."));
  }, [projects, mills, isAdmin]);


  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!isAdmin || !name.trim()) return;
    try {
      if (editingProject?.id) {
        const projectIconUrl = selectedIconFile ? await uploadProjectIcon(editingProject.id) : iconPreview;
        await outreachProjectsAPI.update(editingProject.id, { name: name.trim(), description: description.trim() || undefined, projectIconUrl });
        toast.success("Parent project updated");
      } else {
        const createdProject = await outreachProjectsAPI.create({ name: name.trim(), description: description.trim() || undefined });
        let iconUploadFailed = false;
        if (selectedIconFile && createdProject.id) {
          try {
            const projectIconUrl = await uploadProjectIcon(createdProject.id);
            if (projectIconUrl) await outreachProjectsAPI.update(createdProject.id, { projectIconUrl });
          } catch {
            iconUploadFailed = true;
          }
        }
        if (iconUploadFailed) toast.error("Project created, but its icon could not be uploaded.");
        else toast.success("Parent project created");
      }
      closeProjectDialog();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save parent project"); }
  }

  function openCreateProject() { setEditingProject(null); setName(""); setDescription(""); setSelectedIconFile(null); setIconPreview(""); setDialogOpen(true); }
  function openEditProject(project: OutreachProject) { setEditingProject(project); setName(project.name); setDescription(project.description || ""); setSelectedIconFile(null); setIconPreview(project.projectIconUrl || ""); setDialogOpen(true); }
  function closeProjectDialog() { setDialogOpen(false); setEditingProject(null); setName(""); setDescription(""); setSelectedIconFile(null); setIconPreview(""); }
  function handleIconUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file for the icon."); return; }
    setSelectedIconFile(file);
    const reader = new FileReader();
    reader.onload = () => setIconPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  async function uploadProjectIcon(projectId: string) {
    if (!selectedIconFile) return iconPreview;
    setUploadingIcon(true);
    try {
      const filePath = `outreach-projects/${projectId}/icon_${Date.now()}_${selectedIconFile.name}`;
      const { error } = await supabase.storage.from("company-logos").upload(filePath, selectedIconFile, { upsert: true });
      if (error) throw error;
      return supabase.storage.from("company-logos").getPublicUrl(filePath).data.publicUrl;
    } finally { setUploadingIcon(false); }
  }
  async function deleteProject() {
    if (!isAdmin || !projectToDelete?.id) return;
    try { await outreachProjectsAPI.delete(projectToDelete.id); toast.success("Parent project deleted"); setProjectToDelete(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete parent project"); }
  }

  return <div className="min-w-0 max-w-full space-y-4 pb-4 sm:space-y-6 sm:pb-6">
    <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg"><CardContent className="p-4 sm:p-6 md:p-8"><div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-start lg:justify-between"><div className="space-y-4"><Badge className="border border-white/25 bg-white/15 text-white hover:bg-white/15">Outreach Mill</Badge><div><h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Outreach Mill</h1></div></div>{isAdmin && <Button onClick={openCreateProject} className="w-full gap-2 bg-white text-blue-700 shadow-md hover:bg-blue-50 sm:w-auto"><Plus className="h-4 w-4" /> Add Project</Button>}</div></CardContent></Card>
    <Card className="overflow-hidden border border-slate-200 shadow-sm"><CardHeader className="flex flex-col gap-4 border-b bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">Parent Projects</CardTitle><p className="mt-1 text-sm text-slate-500">{visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""} visible</p></div><div className="relative w-full sm:max-w-md"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input placeholder="Search projects or mills by city..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl border-slate-200 pl-12" /></div></CardHeader><CardContent className="space-y-5 p-3 sm:p-5">{search.trim() && <section aria-label="Mills matching city search"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Matching mills</h3><span className="text-sm text-slate-500">{matchingMills.length} mill{matchingMills.length !== 1 ? "s" : ""}</span></div>{matchingMills.length ? <div className="divide-y overflow-hidden rounded-xl border border-slate-200">{matchingMills.map((mill) => <button key={mill.id || `${mill.spinningMill}-${mill.city}`} type="button" onClick={() => mill.parentProjectId && navigate(`/outreach-mill/${mill.parentProjectId}?millId=${encodeURIComponent(mill.id || "")}`)} className="flex w-full min-w-0 flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{mill.spinningMill}</span><span className="mt-1 block truncate text-sm text-slate-500">{mill.city}{outreachProjects.find((project) => project.id === mill.parentProjectId)?.name ? ` · ${outreachProjects.find((project) => project.id === mill.parentProjectId)?.name}` : ""}</span></span></button>)}</div> : <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-slate-500">No mills found in a city matching “{search.trim()}”.</p>}</section>}<div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">{visibleProjects.map((project) => <Card key={project.id} className="group relative cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg" onClick={() => navigate(`/outreach-mill/${project.id}`)}><CardHeader className="flex flex-row items-start gap-2 p-3 pb-3 sm:gap-3 sm:p-6 sm:pb-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">{project.projectIconUrl ? <img src={project.projectIconUrl} alt={project.name} className="h-full w-full object-cover" /> : <FolderOpen className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><CardTitle className="truncate text-base group-hover:text-primary">{project.name}</CardTitle>{project.description && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{project.description}</p>}</div>{isAdmin && <div className="flex shrink-0 gap-1" onClick={(event) => event.stopPropagation()}><Button variant="ghost" size="icon" title="Edit project" className="h-10 w-10 text-blue-600 hover:bg-blue-100 sm:h-8 sm:w-8" onClick={() => openEditProject(project)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" title="Delete project" className="h-10 w-10 text-red-600 hover:bg-red-100 sm:h-8 sm:w-8" onClick={() => setProjectToDelete(project)}><Trash2 className="h-3.5 w-3.5" /></Button></div>}</CardHeader><CardContent className="border-t pt-3"><div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-foreground" /><span className="font-medium">{counts.get(project.id) || 0} mill sites</span></div></CardContent></Card>)}</div>{!visibleProjects.length && <div className="py-8 text-center text-sm text-slate-500">{search ? "No parent projects match your search." : isAdmin ? "No parent projects yet." : "No projects are assigned to you yet."}</div>}</CardContent></Card>
    <section aria-label="Mill activity summary" className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card className="min-w-0 overflow-hidden border border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-white px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg">Recently updated mills</CardTitle><p className="mt-1 text-sm text-slate-500">The 10 most recently updated site records</p></div><Badge variant="secondary" className="rounded-full">{latestUpdatedMills.length} mills</Badge></div></CardHeader>
        <CardContent className="p-0">{latestUpdatedMills.length ? <div className="max-h-[530px] divide-y divide-slate-100 overflow-y-auto overscroll-contain sm:max-h-[380px]">{latestUpdatedMills.map((mill) => {
          const parentProjectName = outreachProjects.find((project) => project.id === mill.parentProjectId)?.name || "Unassigned project";
          return <button key={mill.id || mill.spinningMill} type="button" onClick={() => mill.parentProjectId && navigate(`/outreach-mill/${mill.parentProjectId}`)} className="flex w-full min-w-0 flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{mill.spinningMill}</p><p className="mt-1 truncate text-sm text-slate-500">{parentProjectName}{mill.unit ? ` · ${mill.unit}` : ""}{mill.city ? ` · ${mill.city}` : ""}</p></div><div className="flex shrink-0 flex-wrap items-center gap-2"><Badge variant="outline" className={statusClass(mill.status || "Outreach")}>{mill.status || "Outreach"}</Badge><span className="text-xs text-slate-500">{updatedDateLabel(mill)}</span></div></button>;
        })}</div> : <p className="px-4 py-10 text-center text-sm text-slate-500">No mill sites have been added yet.</p>}</CardContent>
      </Card>
      <Card className="min-w-0 overflow-hidden border border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-blue-50/60 px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg">Visit schedule</CardTitle><p className="mt-1 text-sm text-slate-500">Mills with a scheduled visit</p></div><Badge className="rounded-full bg-blue-700 hover:bg-blue-700">{scheduledMills.length} scheduled</Badge></div></CardHeader>
        <CardContent className="p-0">{scheduledMills.length ? <div className="divide-y divide-slate-100">{scheduledMills.map((mill) => {
          const parentProjectName = outreachProjects.find((project) => project.id === mill.parentProjectId)?.name || "Unassigned project";
          return <button key={mill.id || mill.spinningMill} type="button" onClick={() => mill.parentProjectId && navigate(`/outreach-mill/${mill.parentProjectId}`)} className="flex w-full min-w-0 items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-6"><span className="flex h-11 min-w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-2 text-blue-800"><CalendarDays className="mb-0.5 h-3.5 w-3.5" /><span className="text-[9px] font-bold leading-none">{scheduleDateLabel(mill.scheduledDate) || "DATE"}</span></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{mill.spinningMill}</span><span className="mt-1 block truncate text-sm text-slate-500">{parentProjectName}{mill.unit ? ` · ${mill.unit}` : ""}{mill.city ? ` · ${mill.city}` : ""}</span></span></button>;
        })}</div> : <div className="px-4 py-10 text-center sm:px-6"><CalendarDays className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No scheduled visits</p><p className="mt-1 text-xs text-slate-500">Mills marked Visit schedule will appear here.</p></div>}</CardContent>
      </Card>
    </section>
    <Dialog open={dialogOpen} onOpenChange={(open) => open ? setDialogOpen(true) : closeProjectDialog()}><DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:w-full sm:max-w-lg"><DialogHeader><DialogTitle>{editingProject ? "Edit Parent Project" : "Add Project"}</DialogTitle><DialogDescription>{editingProject ? "Update the parent project details." : "Create the parent before adding mill sites."}</DialogDescription></DialogHeader><form onSubmit={saveProject} className="space-y-4"><div><Label>Project Name *</Label><Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} /></div><div><Label>Description</Label><Textarea className="mt-2" value={description} onChange={(event) => setDescription(event.target.value)} /></div>{isAdmin && <><div className="space-y-2"><Label>Project Icon (optional)</Label>{iconPreview && <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/10 bg-primary/10"><img src={iconPreview} alt="Project icon preview" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Icon selected</p><p className="text-xs text-slate-500">Upload occurs when saved</p></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => { setSelectedIconFile(null); setIconPreview(""); }}><X className="h-4 w-4" /></Button></div>}<input type="file" accept="image/*" onChange={handleIconUpload} disabled={uploadingIcon} className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200" /></div></>}<DialogFooter><Button type="button" variant="outline" onClick={closeProjectDialog}>Cancel</Button><Button type="submit" disabled={uploadingIcon}>{uploadingIcon ? "Uploading..." : editingProject ? "Save Changes" : "Create Project"}</Button></DialogFooter></form></DialogContent></Dialog><Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}><DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:w-full sm:max-w-lg"><DialogHeader><DialogTitle>Delete parent project?</DialogTitle><DialogDescription>This permanently removes {projectToDelete?.name}. Existing mill sites will remain available but will no longer be linked to this parent.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setProjectToDelete(null)}>Cancel</Button><Button variant="destructive" onClick={deleteProject}>Delete Project</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function OutreachProjectDetail({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedMillId = searchParams.get("millId");
  const selectedMillRowRef = useRef<HTMLTableRowElement>(null);
  const appliedSelectedMillId = useRef<string | null>(null);
  const { appUser, isAdmin } = useAuth();
  const [project, setProject] = useState<OutreachProject | null>(null);
  const [projectsForTransfer, setProjectsForTransfer] = useState<ParentProject[]>([]);
  const [mills, setMills] = useState<OutreachMill[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<30 | 50 | 100 | "All">(30);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<OutreachMill | null>(null);
  const [form, setForm] = useState(emptyMill());
  const [viewing, setViewing] = useState<OutreachMill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OutreachMill | null>(null);
  const [remarksMill, setRemarksMill] = useState<OutreachMill | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [transferMill, setTransferMill] = useState<OutreachMill | null>(null);
  const [transferDestination, setTransferDestination] = useState<"project-tracking" | "survey-reports" | "quotations">("project-tracking");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [statusEntryMill, setStatusEntryMill] = useState<OutreachMill | null>(null);
  const [manualStatus, setManualStatus] = useState("");

  useEffect(() => outreachProjectsAPI.subscribeById(projectId, setProject, () => toast.error("Unable to load parent project.")), [projectId]);
  useEffect(() => trackingProjectsAPI.subscribeAll(setProjectsForTransfer, () => toast.error("Unable to load project categories.")), []);
  useEffect(() => outreachMillsAPI.subscribeAll(setMills, () => toast.error("Unable to load outreach mills.")), []);
  useEffect(() => {
    if (!selectedMillId || appliedSelectedMillId.current === selectedMillId) return;
    const selectedMill = mills.find((mill) => mill.id === selectedMillId);
    if (!selectedMill) return;
    appliedSelectedMillId.current = selectedMillId;
    setSearch(selectedMill.spinningMill);
    setCategoryFilter("all");
    setCityFilter("all");
  }, [mills, selectedMillId]);
  const categories = useMemo(() => [...new Set(mills.filter((mill) => mill.parentProjectId === projectId).map((mill) => mill.category?.trim()).filter(Boolean) as string[])].sort(), [mills, projectId]);
  const cities = useMemo(() => [...new Set(mills.filter((mill) => mill.parentProjectId === projectId).map((mill) => mill.city?.trim()).filter(Boolean) as string[])].sort(), [mills, projectId]);
  const searchTerm = search.trim().toLowerCase().replace(/\s+/g, " ");
  const children = useMemo(() => mills.filter((mill) => mill.parentProjectId === projectId && (categoryFilter === "all" || mill.category === categoryFilter) && (cityFilter === "all" || mill.city === cityFilter) && (!searchTerm || [mill.spinningMill, mill.unit, mill.category, mill.city, mill.pocName, mill.assignedTo].some((value) => value?.trim().toLowerCase().replace(/\s+/g, " ").includes(searchTerm)))).sort((a, b) => {
    const position = (mill: OutreachMill) => mill.sequence ?? (Date.parse(mill.created_at || "") || 0);
    return position(b) - position(a);
  }), [mills, projectId, searchTerm, categoryFilter, cityFilter]);
  const totalPages = pageSize === "All" ? 1 : Math.max(1, Math.ceil(children.length / pageSize));
  const paginatedChildren = useMemo(() => pageSize === "All" ? children : children.slice((page - 1) * pageSize, page * pageSize), [children, page, pageSize]);
  useEffect(() => setPage(1), [search, categoryFilter, cityFilter, pageSize]);
  useEffect(() => {
    if (!selectedMillId) return;
    const selectedIndex = children.findIndex((mill) => mill.id === selectedMillId);
    if (selectedIndex < 0) return;
    setPage(pageSize === "All" ? 1 : Math.floor(selectedIndex / pageSize) + 1);
  }, [children, pageSize, selectedMillId]);
  useEffect(() => {
    if (paginatedChildren.some((mill) => mill.id === selectedMillId)) {
      selectedMillRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [paginatedChildren, selectedMillId]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyMill()); };
  const addPoc = () => setForm((current) => ({ ...current, pocs: [...(current.pocs || []), { name: "", number: "", email: "" }] }));
  const updatePoc = (index: number, field: keyof OutreachMillPoc, value: string) => setForm((current) => ({ ...current, pocs: (current.pocs || []).map((poc, pocIndex) => pocIndex === index ? { ...poc, [field]: value } : poc) }));
  const removePoc = (index: number) => setForm((current) => ({ ...current, pocs: (current.pocs || []).filter((_, pocIndex) => pocIndex !== index) }));
  const save = async (event: FormEvent) => { event.preventDefault(); if (!form.spinningMill.trim()) return; try { const pocs = (form.pocs || []).map((poc) => ({ name: poc.name.trim(), number: poc.number.trim(), email: poc.email.trim() })).filter((poc) => poc.name || poc.number || poc.email); const firstPoc = pocs[0]; const data = { ...form, pocs, pocName: firstPoc?.name || "", pocNumber: firstPoc?.number || "", pocEmail: firstPoc?.email || "", spinningMill: form.spinningMill.trim(), parentProjectId: projectId, created_by: appUser?.id }; if (editing?.id) await outreachMillsAPI.update(editing.id, data); else await outreachMillsAPI.create(data); toast.success(editing ? "Mill site updated" : "Mill site added"); closeForm(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save mill site"); } };
  const downloadImportTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["Mill Name *", "Unit", "City", "Address", "POC Name", "POC Number", "Email"]]);
    worksheet["!cols"] = [30, 18, 20, 36, 24, 20, 30].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mills");
    XLSX.writeFile(workbook, "outreach_mills_template.xlsx");
  };
  const importMills = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("The Excel file has no worksheets.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
      const values = (row: Record<string, unknown>, header: string) => {
        const key = Object.keys(row).find((column) => column.trim().toLowerCase().replace(/[^a-z0-9]/g, "") === header);
        return key && row[key] != null ? String(row[key]).trim() : "";
      };
      const populatedRows = rows.map((row, index) => ({ row, rowNumber: index + 2 })).filter(({ row }) => Object.values(row).some((value) => String(value).trim()));
      if (!populatedRows.length) throw new Error("No mill rows were found in the Excel file.");
      const missingNames = populatedRows.filter(({ row }) => !values(row, "millname"));
      if (missingNames.length) throw new Error(`Mill Name is required in spreadsheet row${missingNames.length > 1 ? "s" : ""} ${missingNames.map(({ rowNumber }) => rowNumber).join(", ")}. No mills were imported.`);
      const newMills = populatedRows.map(({ row }) => ({
        ...emptyMill(),
        spinningMill: values(row, "millname"),
        unit: values(row, "unit"),
        city: values(row, "city"),
        assignedTo: values(row, "enterassignee"),
        address: values(row, "address"),
        pocName: values(row, "pocname"),
        pocNumber: values(row, "pocnumber"),
        email: values(row, "email"),
        parentProjectId: projectId,
        created_by: appUser?.id,
      }));
      await Promise.all(newMills.map((mill) => outreachMillsAPI.create(mill)));
      toast.success(`${newMills.length} mill${newMills.length === 1 ? "" : "s"} imported`);
      setImportOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to import mills"); }
  };
  const updateStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => outreachMillsAPI.update(id, { status }), onError: (error: Error) => toast.error(error.message || "Unable to update status") });
  const updateScheduledDate = useMutation({ mutationFn: ({ id, scheduledDate }: { id: string; scheduledDate: string }) => outreachMillsAPI.update(id, { scheduledDate }), onError: (error: Error) => toast.error(error.message || "Unable to update schedule date") });
  const saveManualStatus = () => {
    const status = manualStatus.trim();
    if (!statusEntryMill?.id || !status) return;
    updateStatus.mutate({ id: statusEntryMill.id, status });
    setStatusEntryMill(null);
    setManualStatus("");
  };
  const addRemark = useMutation({ mutationFn: async () => {  if (!remarksMill?.id || !remarkText.trim()) throw new Error("Enter a remark first"); const nextRemark: OutreachRemark = { id: crypto.randomUUID(), text: remarkText.trim(), createdAt: new Date().toISOString(), createdBy: appUser?.fullName }; await outreachMillsAPI.update(remarksMill.id, { remarks: [...(remarksMill.remarks || []), nextRemark] }); }, onSuccess: () => { toast.success("Remark saved to history"); setRemarkText(""); setRemarksMill(null); }, onError: (error: Error) => toast.error(error.message) });
  const transferMutation = useMutation({ mutationFn: async () => {  if (!transferMill?.id) throw new Error("Select a mill to transfer"); const now = new Date().toISOString(); if (transferDestination === "survey-reports") { const report = await textileSurveyReportAPI.create({ ...defaultTextileData, millName: transferMill.spinningMill, unitName: transferMill.unit || "Not specified", fullAddress: [transferMill.address, transferMill.city].filter(Boolean).join(", "), surveyDate: now.slice(0, 10), surveyedByName: appUser?.fullName || "", millContactPerson: transferMill.pocName || "Not specified", millContactNumber: transferMill.pocNumber || transferMill.phone || transferMill.email || "Not specified", generalRemarks: transferMill.notes || "" }); await outreachMillsAPI.update(transferMill.id, { status: "Transferred", transferredSurveyReportId: report.id, transferredAt: now }); return "Survey Reports"; } if (transferDestination === "quotations") { if (!selectedProjectId) throw new Error("Select a project category"); const today = now.slice(0, 10); const validTillDate = new Date(); validTillDate.setDate(validTillDate.getDate() + 5); const quotation = await quotationAPI.create({ quotationNo: "", issueDate: today, validTill: validTillDate.toISOString().slice(0, 10), customerName: transferMill.spinningMill, customerAddress: [transferMill.address, transferMill.city].filter(Boolean).join(", "), customerPhone: transferMill.pocNumber || transferMill.phone || "", quoteReference: "", fbrReference: "", items: [{ description: transferMill.unit ? `${transferMill.spinningMill} - ${transferMill.unit}` : transferMill.spinningMill, quantity: 1, unitPrice: 0 }], note: DEFAULT_QUOTATION_NOTE, terms: DEFAULT_QUOTATION_TERMS, sectorProjectId: selectedProjectId, sectorProjectName: projectsForTransfer.find((item) => item.id === selectedProjectId)?.name, quotationStatus: "Draft" }); await outreachMillsAPI.update(transferMill.id, { status: "Transferred", transferredQuotationId: quotation.id, transferredAt: now }); return "Quotations"; } if (!selectedProjectId) throw new Error("Select a project category"); const today = now.slice(0, 10); await projectTrackingAPI.create({ project_id: selectedProjectId, millName: transferMill.spinningMill, city: transferMill.city || "Not specified", district: transferMill.city || "Not specified", address: transferMill.address, pocName: transferMill.pocName || "Not specified", pocPhone: transferMill.pocNumber || transferMill.phone || "Not specified", projectStatus: "Not Yet Started", supplierName: "", logisticsStatus: "Pending Dispatch", poStatus: "Pending", poDate: today, startDate: today, endDate: today, supervisorName: "", technicianNames: [], teamStatus: "Scheduled", hardwareStatus: "", hardwareDeliveryStatus: "Pending Dispatch" }); await outreachMillsAPI.update(transferMill.id, { status: "Transferred", transferredProjectId: selectedProjectId, transferredAt: now }); return "Project Tracking"; }, onSuccess: (destination) => { toast.success(`Mill transferred to ${destination}`); setTransferMill(null); setSelectedProjectId(""); }, onError: (error: Error) => toast.error(error.message) });
  if (!project) return <div className="py-12 text-center text-sm text-slate-500">Loading parent project...</div>;
  return <div className="min-w-0 max-w-full space-y-4 pb-4 sm:space-y-6 sm:pb-6"><div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between"><div><Button variant="ghost" className={`${pageButtonClass} mb-2 -ml-3 gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950`} onClick={() => navigate("/outreach-mill")}><ArrowLeft className="h-4 w-4" /> Parent Projects</Button><div className="flex items-center gap-3"><FolderOpen className="h-7 w-7 text-primary" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent Project</p><h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{project.name}</h1></div></div></div><div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto"><input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importMills} /><Button variant="outline" onClick={() => setImportOpen(true)} className={`${pageButtonClass} w-full justify-center gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 sm:w-auto`}><FileUp className="h-4 w-4" /> Import Excel</Button><Button onClick={() => setFormOpen(true)} className={`${pageButtonClass} w-full justify-center gap-2 bg-slate-950 hover:bg-slate-800 sm:w-auto`}><Plus className="h-4 w-4" /> Add Mill</Button></div></div><Card className="border border-slate-200 shadow-sm"><CardHeader className="border-b bg-slate-50/80"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle className="text-lg">Mill contacts</CardTitle></div><div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-3"><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select><Select value={cityFilter} onValueChange={setCityFilter}><SelectTrigger className="w-full"><SelectValue placeholder="All cities" /></SelectTrigger><SelectContent><SelectItem value="all">All cities</SelectItem>{cities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select><div className="relative w-full"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mills, contacts, or cities" className="pl-9" /></div></div></div></CardHeader><CardContent className="p-0"><p className="px-4 py-2 text-xs text-slate-500 sm:hidden">Swipe sideways to view all table columns.</p><div className="w-full min-w-0 max-w-full touch-pan-x overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[980px] text-xs"><thead className="bg-slate-50"><tr><th className="w-12 px-2 py-2 whitespace-normal break-words text-center font-semibold">Sr.</th><th className="min-w-[150px] px-2 py-2 whitespace-normal break-words text-center font-semibold">Spinning Mill</th><th className="w-20 px-2 py-2 whitespace-normal break-words text-center font-semibold">Unit</th><th className="w-28 px-2 py-2 whitespace-normal break-words text-center font-semibold">City</th><th className="w-[192px] min-w-[192px] max-w-[192px] px-2 py-2 whitespace-normal break-words text-center font-semibold">Assign To</th><th className="w-[192px] min-w-[192px] max-w-[192px] px-2 py-2 whitespace-normal break-words text-center font-semibold">Phone / Email</th><th className="min-w-[150px] px-2 py-2 whitespace-normal break-words text-center font-semibold">POC</th><th className="w-24 px-2 py-2 whitespace-normal break-words text-center font-semibold">Remarks</th><th className="w-[140px] min-w-[140px] max-w-[140px] px-2 py-2 whitespace-normal break-words text-center font-semibold">Status</th><th className="w-[160px] min-w-[160px] max-w-[160px] px-2 py-2 whitespace-normal break-words text-center font-semibold">Actions</th></tr></thead><tbody className="divide-y">{paginatedChildren.map((mill, index) => <tr key={mill.id} ref={mill.id === selectedMillId ? selectedMillRowRef : undefined} className={mill.id === selectedMillId ? "bg-blue-100 text-blue-950 ring-2 ring-inset ring-blue-600 [&>td]:bg-blue-100 hover:bg-blue-100 [&>td]:hover:bg-blue-100" : isTerminalMillStatus(mill.status) ? "bg-red-50 text-red-950 [&>td]:bg-red-50 hover:bg-red-100 [&>td]:hover:bg-red-100 [&>td]:text-red-950" : "hover:bg-slate-50"}><td className="px-2 py-2 whitespace-normal break-words align-top text-slate-500">{index + 1}</td><td className="max-w-[220px] px-2 py-2 whitespace-normal break-words align-top font-semibold text-slate-900"><p className="whitespace-normal break-words">{mill.spinningMill}</p><p className="mt-1 whitespace-normal break-words text-[11px] font-normal text-slate-500">{mill.address || "No address added"}</p></td><td className="px-2 py-2 whitespace-normal break-words text-center align-top">{mill.unit || "—"}</td><td className="px-2 py-2 whitespace-normal break-words text-center align-top">{mill.city || "—"}</td><td className="w-[192px] min-w-[192px] max-w-[192px] px-2 py-2 whitespace-normal break-words text-center align-top">{mill.assignedTo || "—"}</td><td className="w-[192px] min-w-[192px] max-w-[192px] px-2 py-2 whitespace-normal break-words text-center align-top"><p>{mill.phone || mill.pocNumber || "—"}</p><p className="mt-1 whitespace-normal break-words text-center text-[11px] text-slate-500">{mill.email || mill.pocEmail || "—"}</p></td><td className="max-w-[170px] px-2 py-2 whitespace-normal break-words align-top"><p>{mill.pocName || "—"}</p><p className="mt-1 text-[11px] text-slate-500">{mill.pocNumber || mill.pocEmail || "—"}</p></td><td className="px-2 py-2 whitespace-normal break-words align-top"><Button variant="outline" size="sm" className="h-8 gap-1 border-purple-200 bg-purple-50 px-2 text-purple-700 hover:bg-purple-100" onClick={() => setRemarksMill(mill)}><MessageSquarePlus className="h-3.5 w-3.5" />{mill.remarks?.length || 0}</Button></td><td className="w-[220px] min-w-[220px] max-w-[220px] px-2 py-2 whitespace-normal break-words text-center align-top"><div className="flex flex-wrap items-center justify-center gap-1"><Select value={mill.status || "Outreach"} onValueChange={(status) => { if (status === "__manual__") { setManualStatus(""); setStatusEntryMill(mill); } else if (mill.id) updateStatus.mutate({ id: mill.id, status }); }}><SelectTrigger className={`h-8 w-28 text-xs font-medium ${statusClass(mill.status || "Outreach")}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className={statusClass(status)}>{status}</SelectItem>)}{mill.status && !statuses.includes(mill.status as typeof statuses[number]) && <SelectItem value={mill.status}>{mill.status}</SelectItem>}<SelectItem value="__manual__">Manual Entry</SelectItem></SelectContent></Select>{/^(visit )?schedule$/i.test(mill.status || "") && <label className="relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><CalendarDays className="h-3.5 w-3.5" />{mill.scheduledDate ? scheduleDateLabel(mill.scheduledDate) : <span>Date</span>}<input type="date" aria-label={`Schedule date for ${mill.spinningMill}`} value={mill.scheduledDate || ""} onChange={(event) => mill.id && updateScheduledDate.mutate({ id: mill.id, scheduledDate: event.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label>}</div></td><td className="w-[160px] min-w-[160px] max-w-[160px] px-2 py-2 whitespace-normal break-words text-center align-top"><div className="flex flex-col items-center gap-1"><div className="flex gap-1"><Button variant="outline" size="icon" title="View" className={`h-8 w-8 ${tableActionButtonClass}`} onClick={() => setViewing(mill)}><Eye className="h-3.5 w-3.5" /></Button><Button variant="outline" size="icon" title="Edit" className={`h-8 w-8 ${tableActionButtonClass}`} onClick={() => { setEditing(mill); setForm({ ...emptyMill(), ...mill, pocs: mill.pocs?.length ? mill.pocs : [{ name: mill.pocName || "", number: mill.pocNumber || "", email: mill.pocEmail || "" }] }); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>{isAdmin && <Button variant="outline" size="icon" title="Delete" className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(mill)}><Trash2 className="h-3.5 w-3.5" /></Button>}</div><Button variant="outline" size="sm" className="h-8 border-blue-200 bg-blue-50 px-2 text-blue-700 hover:bg-blue-100" onClick={() => { setTransferDestination("project-tracking"); setSelectedProjectId(""); setTransferMill(mill); }}><Send className="mr-1 h-3.5 w-3.5" />Transfer</Button></div></td></tr>)}</tbody></table>{!children.length && <p className="p-10 text-center text-sm text-muted-foreground">No mill sites in this parent project.</p>}</div>{children.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Showing {pageSize === "All" ? 1 : (page - 1) * pageSize + 1}–{pageSize === "All" ? children.length : Math.min(page * pageSize, children.length)} of {children.length}</p><div className="flex flex-wrap items-center gap-2"><Label htmlFor="mill-page-size" className="text-xs text-slate-500">Rows</Label><Select value={String(pageSize)} onValueChange={(value) => setPageSize(value === "All" ? "All" : Number(value) as 30 | 50 | 100)}><SelectTrigger id="mill-page-size" className="h-8 w-[88px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="All">All</SelectItem></SelectContent></Select><Button type="button" variant="outline" size="sm" className={`h-8 ${pageButtonClass}`} onClick={() => setPage((current) => current - 1)} disabled={page === 1}>Previous</Button><span className="min-w-12 text-center text-xs text-slate-500">{page} / {totalPages}</span><Button type="button" variant="outline" size="sm" className={`h-8 ${pageButtonClass}`} onClick={() => setPage((current) => current + 1)} disabled={page >= totalPages}>Next</Button></div></div>}</CardContent></Card><Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:w-full sm:max-w-lg"><DialogHeader><DialogTitle>Import mills from Excel</DialogTitle><DialogDescription>Upload an Excel file with the template columns. Mill Name is required; each row will be added to {project.name}.</DialogDescription></DialogHeader><div className="space-y-3"><Button type="button" variant="outline" className={`${pageButtonClass} w-full justify-start`} onClick={downloadImportTemplate}><Download className="mr-2 h-4 w-4" />Download sample template</Button><Button type="button" className={`${pageButtonClass} w-full justify-start`} onClick={() => importInputRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Choose Excel file</Button><p className="text-xs text-slate-500">Supported formats: .xlsx and .xls</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog><Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}><DialogContent className="w-[calc(100%-1.5rem)] max-h-[92dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:w-full sm:max-w-5xl sm:p-8 lg:max-w-6xl"><DialogHeader className="border-b border-slate-200 pb-5"><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Outreach Mill</p><DialogTitle className="text-xl font-semibold sm:text-2xl">{editing ? "Edit mill site" : "Add mill site"}</DialogTitle><DialogDescription className="max-w-2xl leading-6">This site will be saved under {project.name}.</DialogDescription></div></DialogHeader><form onSubmit={save} className="space-y-6"><div className="grid gap-4 md:grid-cols-3"><Field label="Mill Name *" value={form.spinningMill} onChange={(value) => setForm({ ...form, spinningMill: value })} /><Field label="Unit" value={form.unit || ""} onChange={(value) => setForm({ ...form, unit: value })} /><Field label="City" value={form.city || ""} onChange={(value) => setForm({ ...form, city: value })} /></div><div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="assign-to">Assign To</Label><Input id="assign-to" className="mt-2" value={form.assignedTo || ""} onChange={(event) => setForm({ ...form, assignedTo: event.target.value, assignedToUserId: "" })} placeholder="Enter assignee" /></div><Field label="Address" value={form.address || ""} onChange={(value) => setForm({ ...form, address: value })} /></div><section className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold text-slate-900">Point of contact</h3><Button type="button" variant="outline" size="sm" onClick={addPoc} className="w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" /> Add another POC</Button></div><div className="space-y-3">{(form.pocs || []).map((poc, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-slate-700">POC {index + 1}</p>{(form.pocs?.length || 0) > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removePoc(index)} className="text-slate-500 hover:text-red-600">Remove</Button>}</div><div className="grid gap-4 md:grid-cols-3"><Field label="POC Name" value={poc.name} onChange={(value) => updatePoc(index, "name", value)} /><Field label="POC Number" value={poc.number} onChange={(value) => updatePoc(index, "number", value)} /><Field label="Email" value={poc.email} onChange={(value) => updatePoc(index, "email", value)} /></div></div>)}</div></section><div><Label>Notes</Label><Textarea className="mt-2" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div><DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit">Save Mill Site</Button></DialogFooter></form></DialogContent></Dialog><Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:w-full sm:max-w-lg"><DialogHeader><DialogTitle>Delete mill site?</DialogTitle><DialogDescription>This permanently removes {deleteTarget?.spinningMill}.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={async () => {  if (deleteTarget?.id) { await outreachMillsAPI.delete(deleteTarget.id); toast.success("Mill site removed"); setDeleteTarget(null); } }}>Delete</Button></DialogFooter></DialogContent></Dialog><Dialog open={!!remarksMill} onOpenChange={(open) => !open && setRemarksMill(null)}><DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:w-full sm:max-w-2xl"><DialogHeader><DialogTitle>Follow-up Remarks</DialogTitle><DialogDescription>{remarksMill?.spinningMill}</DialogDescription></DialogHeader><div className="max-h-64 space-y-3 overflow-y-auto">{remarksMill?.remarks?.length ? [...remarksMill.remarks].reverse().map((remark) => <div key={remark.id} className="rounded-lg border p-3"><p>{remark.text}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No remarks yet.</p>}</div><div><Label>Add Remark</Label><Textarea value={remarkText} onChange={(event) => setRemarkText(event.target.value)} placeholder="Document follow-up actions or important notes..." className="mt-2"  /></div><DialogFooter><Button variant="outline" onClick={() => setRemarksMill(null)}>Close</Button><Button onClick={() => addRemark.mutate()} disabled={addRemark.isPending || !remarkText.trim()}>Save Remark</Button></DialogFooter></DialogContent></Dialog><Dialog open={!!transferMill} onOpenChange={(open) => !open && setTransferMill(null)}><DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto sm:w-full sm:max-w-lg"><DialogHeader><DialogTitle>Transfer site data</DialogTitle><DialogDescription>Choose where {transferMill?.spinningMill} should be transferred.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Transfer destination</Label><Select value={transferDestination} onValueChange={(value: "project-tracking" | "survey-reports" | "quotations") => setTransferDestination(value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project-tracking">Project Tracking</SelectItem><SelectItem value="quotations">Quotation</SelectItem><SelectItem value="survey-reports">Survey Reports</SelectItem></SelectContent></Select></div>{(transferDestination === "project-tracking" || transferDestination === "quotations") && <div><Label>Available project categories</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger className="mt-2"><SelectValue placeholder="Select a project" /></SelectTrigger><SelectContent>{projectsForTransfer.map((item) => <SelectItem key={item.id} value={item.id!}>{item.name} ({item.projectType || "ISSM"})</SelectItem>)}</SelectContent></Select></div>}</div><DialogFooter><Button variant="outline" onClick={() => setTransferMill(null)}>Cancel</Button><Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending || ((transferDestination === "project-tracking" || transferDestination === "quotations") && !selectedProjectId)}>{transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transfer</Button></DialogFooter></DialogContent></Dialog><Dialog open={!!statusEntryMill} onOpenChange={(open) => { if (!open) { setStatusEntryMill(null); setManualStatus(""); } }}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-md"><DialogHeader><DialogTitle>Enter a status</DialogTitle><DialogDescription>Type the status you want to save for this mill.</DialogDescription></DialogHeader><div><Label htmlFor="manual-mill-status">Status</Label><Input id="manual-mill-status" autoFocus value={manualStatus} onChange={(event) => setManualStatus(event.target.value)} className="mt-2" /></div><DialogFooter><Button variant="outline" onClick={() => setStatusEntryMill(null)}>Cancel</Button><Button onClick={saveManualStatus} disabled={!manualStatus.trim()}>Save status</Button></DialogFooter></DialogContent></Dialog><OutreachMillDetailsDialog mill={viewing} onClose={() => setViewing(null)} /></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
