import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ComplaintWithDetails } from "@/hooks/useComplaints";
import { complaintsAPI, type FollowUp } from "@/integrations/firebase/complaintsAPI";
import { useAuth } from "@/context/AuthContext";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaint: ComplaintWithDetails | null;
  onSuccess?: () => void;
}

export default function FollowUpDialog({
  open,
  onOpenChange,
  complaint,
  onSuccess,
}: FollowUpDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!complaint?.id) {
      toast.error("Complaint not found");
      return;
    }

    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }

    setIsLoading(true);
    try {
      const followUp: FollowUp = {
        addedBy: appUser?.id || "Unknown",
        addedByName: appUser?.fullName,
        timestamp: new Date().toISOString(),
        description: message.trim(),
      };

      await complaintsAPI.addFollowUp(complaint.id, followUp);

      toast.success("Follow-up added successfully");
      setMessage("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to add follow-up");
    } finally {
      setIsLoading(false);
    }
  };

  if (!complaint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reply to Ticket</DialogTitle>
          <DialogDescription>
            Add a message or update to this ticket
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Complaint Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold">Ticket Subject</p>
            <p className="text-sm text-blue-900 mt-1">{complaint.subject}</p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="font-semibold">
              Message *
            </Label>
            <Textarea
              id="message"
              placeholder="Add a message or new issue..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">{message.length}/1000</p>
          </div>

          {/* Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Added by:</span> {appUser?.fullName || "Unknown"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <span className="font-semibold">Ticket Status:</span> {complaint.status}
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
                Sending...
              </>
            ) : (
              "Send Reply"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
