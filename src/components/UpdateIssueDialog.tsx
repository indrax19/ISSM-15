import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { issueUpdatesAPI, IssueUpdate } from "@/integrations/firebase/issueUpdatesAPI";
import { pushNotificationAPI } from "@/integrations/firebase/pushNotificationAPI";
import { usersAPI } from "@/integrations/firebase/usersAPI";
import { useAuth } from "@/context/AuthContext";

interface UpdateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string;
  issueTitle: string;
  siteId: string;
  siteName: string;
  onSuccess?: () => void;
}

type UpdateType = "status_update" | "work_progress" | "note" | "internal_comment";

const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  status_update: "Status Update",
  work_progress: "Work Progress",
  note: "Note",
  internal_comment: "Internal Comment",
};

export default function UpdateIssueDialog({
  open,
  onOpenChange,
  issueId,
  issueTitle,
  siteId,
  siteName,
  onSuccess,
}: UpdateIssueDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [updateType, setUpdateType] = useState<UpdateType>("work_progress");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error("Please enter an update message");
      return;
    }

    setIsLoading(true);
    try {
      // Create the update
      const newUpdate: IssueUpdate = {
        issueId,
        siteId,
        message: message.trim(),
        updatedBy: appUser?.id || "Unknown",
        updatedByName: appUser?.fullName || "Unknown User",
        createAt: new Date().toISOString(),
        updateType,
      };

      await issueUpdatesAPI.create(newUpdate);

      // Send notifications to all users
      try {
        const allUsers = await usersAPI.getAll();
        const userIds = allUsers.map((user) => user.id!);

        if (userIds.length > 0) {
          await pushNotificationAPI.sendNotification({
            title: "Issue Update",
            body: `${issueTitle} - ${UPDATE_TYPE_LABELS[updateType]}: ${message.substring(0, 50)}...`,
            issueId,
            siteId,
            siteName,
            createdBy: appUser?.id || "Unknown",
            recipientUserIds: userIds,
            type: "issue_updated",
            clickAction: "open_issue",
          });
        }
      } catch (pushError) {
        console.warn("Failed to send push notifications:", pushError);
        // Don't fail if notifications fail
      }

      toast.success("Update added successfully");
      setMessage("");
      setUpdateType("work_progress");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to add update");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Progress Update
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold">Issue</p>
            <p className="text-sm text-blue-900 font-medium">{issueTitle}</p>
            <p className="text-xs text-blue-600 mt-2">Site: {siteName}</p>
          </div>

          {/* Update Type */}
          <div className="space-y-2">
            <Label htmlFor="updateType" className="font-semibold">
              Update Type
            </Label>
            <Select value={updateType} onValueChange={(val) => setUpdateType(val as UpdateType)}>
              <SelectTrigger id="updateType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status_update">Status Update</SelectItem>
                <SelectItem value="work_progress">Work Progress</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="internal_comment">Internal Comment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="font-semibold">
              Update Message *
            </Label>
            <Textarea
              id="message"
              placeholder={`Describe the ${UPDATE_TYPE_LABELS[updateType].toLowerCase()}...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">{message.length}/500</p>
          </div>

          {/* Updated By */}
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
                Adding Update...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4" />
                Add Update
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
