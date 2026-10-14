/**
 * Cloud Functions for sending push notifications via Firebase Cloud Messaging (FCM)
 * 
 * Deploy with:
 * firebase deploy --only functions:sendPushNotifications
 * 
 * Requirements:
 * - Firebase Admin SDK
 * - Firestore database
 * - Firebase Cloud Messaging enabled
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

interface DeviceToken {
  userId: string;
  token: string;
  userRole: string;
  siteIds: string[];
  isActive: boolean;
}

interface PushNotificationPayload {
  title: string;
  body: string;
  issueId: string;
  siteId: string;
  siteName: string;
  createdBy: string;
  recipientUserIds: string[];
  type: "issue_created" | "issue_resolved" | "issue_updated";
  clickAction?: string;
}

/**
 * Firestore Trigger: Listens for new documents in pushNotificationQueue collection
 * Sends actual push notifications via FCM
 */
export const sendPushNotifications = functions.firestore
  .document("pushNotificationQueue/{docId}")
  .onCreate(async (snap, context) => {
    const payload = snap.data() as PushNotificationPayload;

    console.log("Processing push notification request:", {
      id: snap.id,
      payload,
    });

    try {
      // Get recipient user IDs
      const recipientUserIds = payload.recipientUserIds || [];

      if (recipientUserIds.length === 0) {
        console.log("No recipients specified, skipping notification");
        await snap.ref.update({
          status: "completed",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          failedUserIds: [],
        });
        return;
      }

      // Get device tokens for all recipients
      const allDeviceTokens: Map<string, string[]> = new Map();

      for (const userId of recipientUserIds) {
        const tokensSnapshot = await db
          .collection("deviceTokens")
          .where("userId", "==", userId)
          .where("isActive", "==", true)
          .get();

        const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);
        if (tokens.length > 0) {
          allDeviceTokens.set(userId, tokens);
        }
      }

      console.log("Found device tokens for users:", Array.from(allDeviceTokens.keys()));

      // Prepare FCM message
      const fcmMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          issue_id: payload.issueId,
          site_id: payload.siteId,
          site_name: payload.siteName,
          type: payload.type,
          click_action: payload.clickAction || "open_issue",
          timestamp: new Date().toISOString(),
        },
        webpush: {
          fcmOptions: {
            link: `${process.env.APP_URL || "https://app.example.com"}/issues/${payload.issueId}`,
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: `${process.env.APP_URL || "https://app.example.com"}/app-icon.png`,
            badge: `${process.env.APP_URL || "https://app.example.com"}/app-badge.png`,
            tag: payload.issueId,
            requireInteraction: false,
          },
        },
      };

      // Send notifications to all device tokens
      const sendPromises: Promise<string>[] = [];
      let sentCount = 0;
      let failedCount = 0;
      const failedUserIds: string[] = [];

      for (const [userId, tokens] of allDeviceTokens.entries()) {
        for (const token of tokens) {
          const promise = messaging
            .send({
              ...fcmMessage,
              token,
            })
            .then(() => {
              sentCount++;
              return `sent_to_${userId}`;
            })
            .catch((error) => {
              console.error(`Failed to send to token ${token}:`, error);

              // If token is invalid, mark it as inactive
              if (
                error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered"
              ) {
                markTokenAsInactive(token);
              }

              failedCount++;
              if (!failedUserIds.includes(userId)) {
                failedUserIds.push(userId);
              }
              return `failed_to_${userId}`;
            });

          sendPromises.push(promise);
        }
      }

      // Wait for all sends to complete
      const results = await Promise.all(sendPromises);

      console.log(`Notification sending completed:`, {
        total: results.length,
        sent: sentCount,
        failed: failedCount,
      });

      // Update the queue document status
      await snap.ref.update({
        status: "completed",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentCount,
        failedCount,
        failedUserIds,
      });

      return { success: true, sentCount, failedCount };
    } catch (error) {
      console.error("Error processing push notification:", error);

      // Mark as failed
      await snap.ref.update({
        status: "failed",
        error: (error as Error).message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      throw error;
    }
  });

/**
 * Mark a device token as inactive (for invalid tokens)
 */
async function markTokenAsInactive(token: string) {
  try {
    const snapshot = await db
      .collection("deviceTokens")
      .where("token", "==", token)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isActive: false });
    });

    await batch.commit();
    console.log(`Marked token as inactive: ${token}`);
  } catch (error) {
    console.error("Error marking token as inactive:", error);
  }
}

/**
 * HTTP Trigger: Manual notification sending (for testing/admin purposes)
 * Call with: POST /sendTestNotification with Authorization header
 * Body: { issueId, siteId, siteName, title, recipientUserIds }
 * Requires: Firebase ID token in Authorization header (Bearer token)
 */
export const sendTestNotification = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const idToken = authHeader.substring(7);

  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Optional: Check if user has admin role
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();
    if (userData?.role !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }

    const { issueId, siteId, siteName, title, recipientUserIds } = req.body;

    if (!issueId || !siteId || !title || !recipientUserIds) {
      res.status(400).send("Missing required fields");
      return;
    }

    const payload: PushNotificationPayload = {
      title: "Test: " + title,
      body: `Test notification for ${title} at ${siteName}`,
      issueId,
      siteId,
      siteName,
      createdBy: "system",
      recipientUserIds: Array.isArray(recipientUserIds) ? recipientUserIds : [recipientUserIds],
      type: "issue_created",
      clickAction: "open_issue",
    };

    // Queue the notification
    const docRef = await db.collection("pushNotificationQueue").add({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
    });

    res.json({ success: true, notificationId: docRef.id });
  } catch (error) {
    console.error("Error in sendTestNotification:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Scheduled Function: Clean up old notifications (older than 30 days)
 * Runs daily
 */
export const cleanupOldNotifications = functions.pubsub
  .schedule("every day 02:00")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshot = await db
        .collection("pushNotificationQueue")
        .where("createdAt", "<", thirtyDaysAgo)
        .get();

      const batch = db.batch();
      let count = 0;

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
        console.log(`Cleaned up ${count} old notification records`);
      }

      return { success: true, deletedCount: count };
    } catch (error) {
      console.error("Error cleaning up old notifications:", error);
      throw error;
    }
  });
