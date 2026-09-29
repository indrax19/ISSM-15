import { StatusHistoryEntry, ComplaintStatus } from "@/integrations/firebase/complaintsAPI";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface StatusHistoryPanelProps {
  statusHistory?: StatusHistoryEntry[];
  currentStatus?: ComplaintStatus;
}

const STATUS_OPTIONS: { value: ComplaintStatus; label: string; color: string }[] = [
  { value: "Open", label: "Open", color: "bg-blue-100 text-blue-800" },
  { value: "In Progress", label: "In Progress", color: "bg-orange-100 text-orange-800" },
  { value: "Pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "On Hold", label: "On Hold", color: "bg-gray-100 text-gray-800" },
  { value: "Resolved", label: "Resolved", color: "bg-green-100 text-green-800" },
];

const getStatusColor = (status: ComplaintStatus): string => {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.color || "bg-gray-100 text-gray-800";
};

export default function StatusHistoryPanel({
  statusHistory = [],
  currentStatus,
}: StatusHistoryPanelProps) {
  // If no history, show default message
  if (!statusHistory || statusHistory.length === 0) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Status History</h3>
        <p className="text-xs text-gray-500">No status history available</p>
      </div>
    );
  }

  // Sort history in descending order (newest first) for display
  const sortedHistory = [...statusHistory].reverse();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Status History</h3>
      </div>

      <div className="p-4 space-y-3">
        {sortedHistory.map((entry, index) => {
          const isCurrent = index === 0 && currentStatus === entry.status;
          const nextEntry = index < sortedHistory.length - 1 ? sortedHistory[index + 1] : null;

          return (
            <div key={`${entry.timestamp}-${entry.status}`} className="flex gap-3">
              {/* Timeline line and dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`h-3 w-3 rounded-full border-2 ${
                    isCurrent ? "bg-blue-600 border-blue-600" : "bg-white border-gray-400"
                  }`}
                />
                {nextEntry && <div className="w-0.5 h-12 bg-gray-300 my-1" />}
              </div>

              {/* Status content */}
              <div className="flex-1 pt-1 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={getStatusColor(entry.status)}>{entry.status}</Badge>
                  {isCurrent && <Badge variant="outline" className="text-xs">Current</Badge>}
                </div>

                <p className="text-xs text-gray-600 mb-1">
                  <span className="font-semibold">{format(new Date(entry.timestamp), "MMM dd, yyyy HH:mm:ss")}</span>
                </p>

                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Updated by:</span> {entry.updatedByName || entry.updatedBy || "Unknown"}
                </p>

                {entry.remarks && (
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                    <p className="font-semibold mb-1">Remarks:</p>
                    <p className="whitespace-pre-wrap break-words">{entry.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
