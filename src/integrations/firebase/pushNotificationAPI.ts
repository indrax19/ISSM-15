import { db } from "./config";
import { collection, addDoc } from "firebase/firestore";
import { removeUndefined } from "./utils";

export interface PushNotificationPayload {
  title: string;
  body: string;
  issueId: string;
  siteId: string;
  siteName: string;
  createdBy: string;
  recipientUserIds: string[]; // User IDs to send notification to
  type: "issue_created" | "issue_resolved" | "issue_updated";
  clickAction?: "open_issue";
}

/**
 * API for managing push notifications
 * Notifications are stored in Firestore and Cloud Functions handle the actual sending
 */
export const pushNotificationAPI = {
  /**
   * Send push notification to users
   * This creates a document in 'pushNotificationQueue' collection
   * Cloud Functions will listen to this and send actual push notifications
   */
  async sendNotification(payload: PushNotificationPayload) {
    try {
      const notificationDoc = {
        ...removeUndefined(payload),
        createdAt: new Date().toISOString(),
        status: "pending",
        sentAt: null,
        failedUserIds: [],
      };

      const docRef = await addDoc(
        collection(db, "pushNotificationQueue"),
        notificationDoc
      );

      console.log("Notification queued for sending:", docRef.id);
      return { id: docRef.id, ...notificationDoc };
    } catch (error: any) {
      console.error("Error queuing push notification:", error);
      throw new Error(
        error.message || "Failed to queue push notification"
      );
    }
  },

  /**
   * Send notification when a new issue is created
   */
  async notifyIssueCreated(
    issueId: string,
    siteName: string,
    siteId: string,
    title: string,
    createdBy: string,
    recipientUserIds: string[]
  ) {
    if (recipientUserIds.length === 0) {
      console.log("No users to notify for issue creation");
      return;
    }

    return this.sendNotification({
      title: "New Issue Created",
      body: `${title} reported at ${siteName}`,
      issueId,
      siteId,
      siteName,
      createdBy,
      recipientUserIds,
      type: "issue_created",
      clickAction: "open_issue",
    });
  },

  /**
   * Send notification when an issue is resolved
   */
  async notifyIssueResolved(
    issueId: string,
    siteName: string,
    siteId: string,
    title: string,
    resolvedBy: string,
    recipientUserIds: string[]
  ) {
    if (recipientUserIds.length === 0) {
      console.log("No users to notify for issue resolution");
      return;
    }

    return this.sendNotification({
      title: "Issue Resolved",
      body: `${title} has been resolved at ${siteName}`,
      issueId,
      siteId,
      siteName,
      createdBy: resolvedBy,
      recipientUserIds,
      type: "issue_resolved",
      clickAction: "open_issue",
    });
  },

  /**
   * Send notification when an issue is updated
   */
  async notifyIssueUpdated(
    issueId: string,
    siteName: string,
    siteId: string,
    title: string,
    updatedBy: string,
    recipientUserIds: string[]
  ) {
    if (recipientUserIds.length === 0) {
      console.log("No users to notify for issue update");
      return;
    }

    return this.sendNotification({
      title: "Issue Updated",
      body: `${title} has been updated at ${siteName}`,
      issueId,
      siteId,
      siteName,
      createdBy: updatedBy,
      recipientUserIds,
      type: "issue_updated",
      clickAction: "open_issue",
    });
  },
};
