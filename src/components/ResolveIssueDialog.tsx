import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { issuesAPI } from "@/integrations/firebase/issuesAPI";
import { notificationsAPI } from "@/integrations/firebase/notificationsAPI";
import { pushNotificationAPI } from "@/integrations/firebase/pushNotificationAPI";
import { usersAPI } from "@/integrations/firebase/usersAPI";
import { IssueWithDuration } from "@/hooks/useIssues";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";

interface ResolveIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: IssueWithDuration | null;
  siteName?: string;
  onSuccess?: () => void;
}

export default function ResolveIssueDialog({
  open,
  onOpenChange,
  issue,
  siteName = "Unknown Site",
  onSuccess,
}: ResolveIssueDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [remarks, setRemarks] = useState("");

  // Reset form when dialog opens/closes or issue changes
  useEffect(() => {
    if (open && issue) {
      setRemarks(issue.remarks || "");
    } else {
      setRemarks("");
    }
  }, [open, issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!issue?.id) {
      toast.error("Issue ID is missing");
      return;
    }

    setIsLoading(true);
    try {
      const resolvedTime = new Date().toISOString();

      await issuesAPI.update(issue.id, {
        status: "Resolved",
        resolvedTime,
        resolvedBy: appUser?.id || "Unknown",
        remarks: remarks || undefined,
      });

      // Send notifications only to users with 'sites' permission
      try {
        const allUsers = await usersAPI.getAll();
        // Filter users who have 'sites' permission or are admins
        const technicalUsers = allUsers.filter(
          (user) => user.role === "admin" || user.permissions?.includes("sites")
        );
        const userIds = technicalUsers.map((user) => user.id!);

        // Send in-app notifications
        const notificationPromises = technicalUsers.map((user) =>
          notificationsAPI.create({
            userId: user.id!,
            type: "issue_resolved",
            title: "Issue Resolved",
            message: `"${issue.title}" was resolved for ${siteName} by ${appUser?.fullName || "Unknown User"}`,
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
            await pushNotificationAPI.notifyIssueResolved(
              issue.id,
              siteName,
              issue.site_id,
              issue.title,
              appUser?.id || "Unknown",
              userIds
            );
          } catch (pushError) {
            console.warn("Failed to send push notifications:", pushError);
            // Don't fail the entire operation if push notifications fail
          }
        }
      } catch (notificationError: any) {
        // Silently ignore AbortError - it's expected when dialog closes before notifications complete
        if (notificationError.name !== "AbortError" && notificationError.code !== "aborted") {
          console.error("Failed to send notifications:", notificationError);
        }
        // Don't fail the issue resolution if notifications fail
      }

      toast.success(`Issue resolved for ${siteName}`);
      setRemarks("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to resolve issue");
    } finally {
      setIsLoading(false);
    }
  };

  if (!issue) return null;

  const resolvedDuration = issue.duration || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Resolve Issue
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
                <p className="text-xs text-blue-600 font-semibold">Status</p>
                <Badge className="bg-yellow-100 text-yellow-800 mt-1">Open</Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-600 font-semibold">Duration</p>
                <p className="text-sm font-medium text-blue-900 mt-1">{resolvedDuration}</p>
              </div>
            </div>
          </div>

          {/* Created Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              <span className="font-semibold">Created:</span> {format(new Date(issue.createdTime), "MMM dd, yyyy HH:mm")}
            </p>
            <p className="break-all text-xs text-gray-600">
              <span className="font-semibold">Created by:</span> {issue.createdBy || "Unknown"}
            </p>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="font-semibold">
              Remarks/Resolution Notes
            </Label>
            <Textarea
              id="remarks"
              placeholder="Explain how the issue was resolved..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={500}
              className="resize-none whitespace-pre-wrap"
            />
            <p className="text-xs text-gray-500">{remarks.length}/500</p>
          </div>

          {/* Resolution Info */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="break-words text-xs text-green-600">
              <span className="font-semibold">Will be resolved by:</span> {appUser?.fullName || "Unknown"}
            </p>
            <p className="text-xs text-green-600 mt-1">
              <span className="font-semibold">Resolved time:</span> Now
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
            disabled={isLoading}
            className="w-full gap-2 bg-green-600 text-white hover:bg-green-700 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Resolve Issue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
