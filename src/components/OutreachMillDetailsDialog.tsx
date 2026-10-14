import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OutreachMill } from "@/integrations/firebase/outreachMillsAPI";

type DetailRow = [string, string | undefined];

function DetailTable({ title, rows }: { title: string; rows: DetailRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="border-b bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th className="w-40 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>
              <td className="whitespace-pre-wrap bg-white px-4 py-3 text-slate-900">{value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function getMillCategory(mill: OutreachMill) {
  return mill.category?.trim() || "Textile";
}

function getMillStatus(mill: OutreachMill) {
  return mill.transferredAt ? "Transferred" : mill.status === "Active" || mill.status === "Pending" || !mill.status ? "Outreach" : mill.status === "Close" ? "Closed" : mill.status;
}

function statusClass(status: string) {
  return ({ Outreach: "border-violet-200 bg-violet-50 text-violet-700", Working: "border-blue-200 bg-blue-50 text-blue-700", "On Hold": "border-amber-200 bg-amber-50 text-amber-700", "Follow Up": "border-emerald-200 bg-emerald-50 text-emerald-700", Closed: "border-red-200 bg-red-50 text-red-700", Transferred: "border-slate-200 bg-slate-100 text-slate-700" } as Record<string, string>)[status] || "border-slate-200 bg-slate-50 text-slate-700";
}

export default function OutreachMillDetailsDialog({ mill, onClose }: { mill: OutreachMill | null; onClose: () => void }) {
  return (
    <Dialog open={!!mill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Outreach record</p>
              <DialogTitle className="text-2xl tracking-tight text-slate-950">{mill?.spinningMill || "Mill details"}</DialogTitle>
              <DialogDescription className="mt-1">Complete mill profile, contacts, assignment and follow-up history.</DialogDescription>
            </div>
            {mill && <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(getMillStatus(mill))}`}>{getMillStatus(mill)}</span>}
          </div>
        </DialogHeader>
        {mill && (
          <div className="space-y-5">
            <DetailTable title="Mill information" rows={[["Mill Name", mill.spinningMill], ["Unit", mill.unit], ["Category", getMillCategory(mill)], ["City", mill.city], ["Address", mill.address]]} />
            <div className="grid gap-5 lg:grid-cols-2">
              <DetailTable title="Contact information" rows={[["Phone", mill.phone], ["Email", mill.email]]} />
              <DetailTable title="Point of contact" rows={[["Name", mill.pocName], ["Number", mill.pocNumber], ["Email", mill.pocEmail]]} />
            </div>
            <DetailTable title="Assignment and status" rows={[["Assigned to", mill.assignedTo], ["Status", getMillStatus(mill)], ["Last updated", mill.updated_at ? new Date(mill.updated_at).toLocaleString() : "—"]]} />
            <DetailTable title="Notes" rows={[["Notes", mill.notes]]} />
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold text-slate-900">Follow-up remarks</h3></div>
              {mill.remarks?.length ? <div className="divide-y divide-slate-100">{[...mill.remarks].reverse().map((remark) => <div key={remark.id} className="px-4 py-3"><p className="text-sm text-slate-900">{remark.text}</p><p className="mt-1 text-xs text-slate-500">{new Date(remark.createdAt).toLocaleString()}{remark.createdBy ? ` · ${remark.createdBy}` : ""}</p></div>)}</div> : <p className="px-4 py-5 text-sm text-slate-500">No remarks recorded.</p>}
            </section>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
