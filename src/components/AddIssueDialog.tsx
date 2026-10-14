import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Issue, issuesAPI } from "@/integrations/firebase/issuesAPI";
import { notificationsAPI } from "@/integrations/firebase/notificationsAPI";
import { pushNotificationAPI } from "@/integrations/firebase/pushNotificationAPI";
import { usersAPI } from "@/integrations/firebase/usersAPI";
import { useAuth } from "@/context/AuthContext";

interface AddIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName?: string;
  onSuccess?: () => void;
}

export default function AddIssueDialog({
  open,
  onOpenChange,
  siteId,
  siteName = "Unknown Site",
  onSuccess,
}: AddIssueDialogProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Issue title is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Issue description is required");
      return;
    }

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const newIssue: Issue = {
        site_id: siteId,
        title: formData.title,
        description: formData.description,
        createdBy: appUser?.id || "Unknown",
        createdByName: appUser?.fullName,
        createdTime: timestamp,
        status: "Open",
        statusHistory: [
          {
            status: "Open",
            updatedBy: appUser?.id || "Unknown",
            updatedByName: appUser?.fullName,
            timestamp,
            remarks: "Issue created",
          },
        ],
      };

      const createdIssue = await issuesAPI.create(newIssue);

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
            type: "issue_created",
            title: "New Issue Added",
            message: `"${formData.title}" was added for ${siteName}`,
            issueId: createdIssue.id || "",
            siteId,
            siteName: siteName || "Unknown Site",
            createdBy: appUser?.fullName || "Unknown User",
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        );
        await Promise.all(notificationPromises);

        // Send push notifications
        if (userIds.length > 0) {
          try {
            await pushNotificationAPI.notifyIssueCreated(
              createdIssue.id || "",
              siteName || "Unknown Site",
              siteId,
              formData.title,
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
        // Don't fail the issue creation if notifications fail
      }

      toast.success(`Issue added for ${siteName}`);
      setFormData({ title: "", description: "" });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create issue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Issue
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Site Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold">Site</p>
            <p className="text-sm text-blue-900">{siteName}</p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-semibold">
              Issue Title *
            </Label>
            <Input
              id="title"
              placeholder="e.g., Camera connection failed"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={isLoading}
              maxLength={100}
            />
            <p className="text-xs text-gray-500">{formData.title.length}/100</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="font-semibold">
              Description *
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isLoading}
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">{formData.description.length}/500</p>
          </div>

          {/* Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Created by:</span> {appUser?.fullName || "Unknown"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <span className="font-semibold">Status:</span> Open
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
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Issue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
