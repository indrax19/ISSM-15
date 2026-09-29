import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { issuesAPI, IssueStatus } from "@/integrations/firebase/issuesAPI";
import { notificationsAPI } from "@/integrations/firebase/notificationsAPI";
import { pushNotificationAPI } from "@/integrations/firebase/pushNotificationAPI";
import { usersAPI } from "@/integrations/firebase/usersAPI";
import { IssueWithDuration } from "@/hooks/useIssues";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { STATUS_COLORS } from "@/lib/colors";

interface StatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: IssueWithDuration | null;
  siteName?: string;
  onSuccess?: () => void;
}

const STATUS_MAPPING: Record<IssueStatus, keyof typeof STATUS_COLORS> = {
  "Open": "open",
  "In Progress": "in-progress",
  "Pending": "pending",
  "Client Not Available": "client-not-available",
  "On Hold": "on-hold",
  "Resolved": "resolved",
};

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Pending", label: "Pending" },
  { value: "Client Not Available", label: "Client Not Available" },
  { value: "On Hold", label: "On Hold" },
  { value: "Resolved", label: "Resolved" },
];

const getStatusColor = (status: IssueStatus): string => {
  const colorKey = STATUS_MAPPING[status];
  return colorKey ? STATUS_COLORS[colorKey]?.badge || "bg-gray-100 text-gray-800" : "bg-gray-100 text-gray-800";
};

export default function StatusUpdateDialog({
  open,
  onOpenChange,
  issue,
  siteName = "Unknown Site",
  onSuccess,
}: StatusUpdateDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus | "">("");
  const [remarks, setRemarks] = useState("");

  // Reset form when dialog opens/closes or issue changes
  useEffect(() => {
    if (open && issue) {
      setSelectedStatus(issue.status);
      setRemarks("");
    } else {
      setSelectedStatus("");
      setRemarks("");
    }
  }, [open, issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!issue?.id || !selectedStatus) {
      toast.error("Please select a status");
      return;
    }

    if (selectedStatus === issue.status) {
      toast.error("Please select a different status");
      return;
    }

    setIsLoading(true);
    try {
      // Update status with history
      await issuesAPI.updateStatus(
        issue.id,
        selectedStatus,
        appUser?.id || "Unknown",
        appUser?.fullName,
        remarks || undefined
      );

      // Send notifications only to users with 'sites' permission
      try {
        const allUsers = await usersAPI.getAll();
        // Filter users who have 'sites' permission or are admins
        const technicalUsers = allUsers.filter(
          (user) => user.role === "admin" || user.permissions?.includes("sites")
        );
        const userIds = technicalUsers.map((user) => user.id!);

        // Determine notification type and message
        const notificationType: "issue_created" | "issue_resolved" | "issue_updated" =
          selectedStatus === "Resolved" ? "issue_resolved" : "issue_updated";
        const message =
          selectedStatus === "Resolved"
            ? `"${issue.title}" was resolved for ${siteName} by ${appUser?.fullName || "Unknown User"}`
            : `Status updated to "${selectedStatus}" for "${issue.title}" by ${appUser?.fullName || "Unknown User"}`;

        // Send in-app notifications
        const notificationPromises = technicalUsers.map((user) =>
          notificationsAPI.create({
            userId: user.id!,
            type: notificationType,
            title: selectedStatus === "Resolved" ? "Issue Resolved" : "Issue Updated",
            message,
            issueId: issue.id,
            siteId: issue.site_id,
            siteName,
            createdBy: appUser?.fullName || "Unknown User",
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        );
        await Promise.all(notificationPromises);

        // Send push notifications
        if (userIds.length > 0) {
          try {
            if (selectedStatus === "Resolved") {
              await pushNotificationAPI.notifyIssueResolved(
                issue.id,
                siteName,
                issue.site_id,
                issue.title,
                appUser?.id || "Unknown",
                userIds
              );
            } else {
              await pushNotificationAPI.notifyIssueUpdated(
                issue.id,
                siteName,
                issue.site_id,
                issue.title,
                appUser?.id || "Unknown",
                userIds
              );
            }
          } catch (pushError) {
            console.warn("Failed to send push notifications:", pushError);
          }
        }
      } catch (notificationError: any) {
        if (notificationError.name !== "AbortError" && notificationError.code !== "aborted") {
          console.error("Failed to send notifications:", notificationError);
        }
      }

      toast.success(
        selectedStatus === "Resolved"
          ? `Issue resolved for ${siteName}`
          : `Status updated to "${selectedStatus}"`
      );
      setSelectedStatus("");
      setRemarks("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  if (!issue) return null;

  const statusLabel = STATUS_OPTIONS.find((opt) => opt.value === issue.status)?.label || issue.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Update Issue Status
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Info Card */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-blue-600 font-semibold">Issue Title</p>
              <p className="text-sm font-medium text-blue-900 break-all">{issue.title}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-semibold">Description</p>
              <p className="text-xs text-blue-900 whitespace-pre-wrap break-all">{issue.description}</p>
            </div>
            <div className="flex flex-col gap-3 border-t border-blue-200 pt-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs text-blue-600 font-semibold">Current Status</p>
                <Badge className={`${getStatusColor(issue.status)} mt-1`}>{statusLabel}</Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-600 font-semibold">Duration</p>
                <p className="text-sm font-medium text-blue-900 mt-1">{issue.duration || "—"}</p>
              </div>
            </div>
          </div>

          {/* Created Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              <span className="font-semibold">Created:</span> {format(new Date(issue.createdTime), "MMM dd, yyyy HH:mm")}
            </p>
            <p className="break-all text-xs text-gray-600">
              <span className="font-semibold">Created by:</span> {issue.createdByName || issue.createdBy || "Unknown"}
            </p>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label htmlFor="status" className="font-semibold">
              New Status
            </Label>
            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as IssueStatus)}>
              <SelectTrigger disabled={isLoading}>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="font-semibold">
              Remarks {selectedStatus === "Resolved" ? "(Resolution Notes)" : "(Optional)"}
            </Label>
            <Textarea
              id="remarks"
              placeholder={
                selectedStatus === "Resolved"
                  ? "Explain how the issue was resolved..."
                  : "Add any notes about this status change..."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={500}
              className="resize-none whitespace-pre-wrap"
            />
            <p className="text-xs text-gray-500">{remarks.length}/500</p>
          </div>

          {/* Updated By Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="break-words text-xs text-blue-600">
              <span className="font-semibold">Updated by:</span> {appUser?.fullName || "Unknown"}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              <span className="font-semibold">Updated at:</span> Now
            </p>
          </div>
        </form>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedStatus || selectedStatus === issue.status}
            className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                Update Status
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
