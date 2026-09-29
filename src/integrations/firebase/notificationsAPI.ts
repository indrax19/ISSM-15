import { db } from "./config";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  getDocs,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface Notification {
  id?: string;
  userId: string; // Recipient user ID
  type: "issue_created" | "issue_resolved" | "issue_updated"; // Type of notification
  title: string;
  message: string;
  issueId: string;
  siteId: string;
  siteName: string;
  createdBy?: string; // User who created/resolved the issue
  createdAt: string; // ISO timestamp
  isRead: boolean;
}

export const notificationsAPI = {
  // Create a new notification
  async create(notification: Notification) {
    try {
      const data = removeUndefined({
        ...notification,
        createdAt: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "notifications"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      console.error("Error creating notification:", error);
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create notification"
      );
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    try {
      const docRef = doc(db, "notifications", notificationId);
      await updateDoc(docRef, {
        isRead: true,
      });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
    }
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("isRead", "==", false)
      );
      const snapshot = await getDocs(q);
      const batch = snapshot.docs.map((docSnap) =>
        updateDoc(docSnap.ref, { isRead: true })
      );
      await Promise.all(batch);
    } catch (error: any) {
      console.error("Error marking all as read:", error);
    }
  },

  // Delete a notification
  async delete(notificationId: string) {
    try {
      await deleteDoc(doc(db, "notifications", notificationId));
    } catch (error: any) {
      console.error("Error deleting notification:", error);
    }
  },

  // Real-time listener for user's notifications
  subscribeToUserNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            // Sort by createdAt in descending order (newest first)
            const dateA = new Date(a.createdAt || "").getTime();
            const dateB = new Date(b.createdAt || "").getTime();
            return dateB - dateA;
          }) as Notification[];
        callback(notifications);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in notifications subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Get unread count for a user
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("isRead", "==", false)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return 0;
      }
      return 0;
    }
  },
};
