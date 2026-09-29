import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ComplaintWithDetails } from "@/hooks/useComplaints";
import { complaintsAPI, type ComplaintStatus } from "@/integrations/firebase/complaintsAPI";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";

interface ComplaintStatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaint: ComplaintWithDetails | null;
  onSuccess?: () => void;
}

const STATUS_OPTIONS: ComplaintStatus[] = [
  "Open",
  "In Progress",
  "Waiting for Response",
  "Resolved",
];

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  "Open": "bg-blue-100 text-blue-800",
  "In Progress": "bg-orange-100 text-orange-800",
  "Waiting for Response": "bg-purple-100 text-purple-800",
  "Resolved": "bg-green-100 text-green-800",
};

export default function ComplaintStatusUpdateDialog({
  open,
  onOpenChange,
  complaint,
  onSuccess,
}: ComplaintStatusUpdateDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>(complaint?.status || "Open");
  const [remarks, setRemarks] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!complaint?.id) {
      toast.error("Complaint not found");
      return;
    }

    if (newStatus === complaint.status) {
      toast.error("Please select a different status");
      return;
    }

    setIsLoading(true);
    try {
      await complaintsAPI.updateStatus(
        complaint.id,
        newStatus,
        appUser?.id || "Unknown",
        appUser?.fullName,
        remarks.trim() ? remarks : undefined
      );

      toast.success(`Complaint status updated to ${newStatus}`);
      setRemarks("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update complaint status");
    } finally {
      setIsLoading(false);
    }
  };

  if (!complaint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Complaint Status</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Complaint Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold">Subject</p>
            <p className="text-sm text-blue-900 mt-1">{complaint.subject}</p>
          </div>

          {/* Current Status */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600 font-semibold mb-2">Current Status</p>
            <Badge className={STATUS_COLORS[complaint.status]}>
              {complaint.status}
            </Badge>
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="font-semibold">
              New Status *
            </Label>
            <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ComplaintStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                        status === "Open" ? "bg-blue-500" :
                        status === "In Progress" ? "bg-orange-500" :
                        status === "Pending" ? "bg-yellow-500" :
                        status === "On Hold" ? "bg-gray-500" :
                        "bg-green-500"
                      }`}></span>
                      {status}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="font-semibold">
              Reply / Notes (Optional)
            </Label>
            <Textarea
              id="remarks"
              placeholder="Add any notes about this status update..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isLoading}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">{remarks.length}/500</p>
          </div>

          {/* Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Updated by:</span> {appUser?.fullName || "Unknown"}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Status"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
