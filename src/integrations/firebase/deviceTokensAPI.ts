import { db } from "./config";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface DeviceToken {
  id?: string;
  userId: string;
  token: string;
  userRole: "admin" | "user";
  siteIds: string[]; // Sites this user has access to
  userEmail: string;
  deviceName?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export const deviceTokensAPI = {
  /**
   * Store or update a device token for a user
   */
  async saveDeviceToken(
    userId: string,
    token: string,
    userRole: "admin" | "user",
    siteIds: string[],
    userEmail: string,
    deviceName?: string
  ) {
    try {
      const tokenDocId = `${userId}_${token}`.substring(0, 128);
      const now = new Date().toISOString();

      const deviceTokenData: DeviceToken = {
        userId,
        token,
        userRole,
        siteIds,
        userEmail,
        deviceName,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      await setDoc(doc(db, "deviceTokens", tokenDocId), removeUndefined(deviceTokenData), {
        merge: true,
      });

      console.log("Device token saved successfully for user:", userId);
      return { id: tokenDocId, ...deviceTokenData };
    } catch (error: any) {
      console.error("Error saving device token:", error);
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to save device token"
      );
    }
  },

  /**
   * Get a specific device token
   */
  async getDeviceToken(tokenDocId: string): Promise<DeviceToken | null> {
    try {
      const docRef = doc(db, "deviceTokens", tokenDocId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as DeviceToken;
      }
      return null;
    } catch (error: any) {
      console.error("Error getting device token:", error);
      if (handleFirestoreError(error)) return null;
      return null;
    }
  },

  /**
   * Get all device tokens for a user
   */
  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    try {
      const q = query(
        collection(db, "deviceTokens"),
        where("userId", "==", userId),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeviceToken[];
    } catch (error: any) {
      console.error("Error getting user device tokens:", error);
      if (handleFirestoreError(error)) return [];
      return [];
    }
  },

  /**
   * Get all device tokens for users with access to a specific site
   */
  async getDeviceTokensBySiteId(siteId: string): Promise<DeviceToken[]> {
    try {
      const q = query(
        collection(db, "deviceTokens"),
        where("siteIds", "array-contains", siteId),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeviceToken[];
    } catch (error: any) {
      console.error("Error getting device tokens for site:", error);
      if (handleFirestoreError(error)) return [];
      return [];
    }
  },

  /**
   * Get all admin device tokens
   */
  async getAdminDeviceTokens(): Promise<DeviceToken[]> {
    try {
      const q = query(
        collection(db, "deviceTokens"),
        where("userRole", "==", "admin"),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeviceToken[];
    } catch (error: any) {
      console.error("Error getting admin device tokens:", error);
      if (handleFirestoreError(error)) return [];
      return [];
    }
  },

  /**
   * Update device token status
   */
  async updateDeviceToken(tokenDocId: string, updates: Partial<DeviceToken>) {
    try {
      const docRef = doc(db, "deviceTokens", tokenDocId);
      await updateDoc(docRef, {
        ...removeUndefined(updates),
        updatedAt: new Date().toISOString(),
      });
      console.log("Device token updated:", tokenDocId);
    } catch (error: any) {
      console.error("Error updating device token:", error);
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update device token"
      );
    }
  },

  /**
   * Delete a device token
   */
  async deleteDeviceToken(tokenDocId: string) {
    try {
      await deleteDoc(doc(db, "deviceTokens", tokenDocId));
      console.log("Device token deleted:", tokenDocId);
    } catch (error: any) {
      console.error("Error deleting device token:", error);
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete device token"
      );
    }
  },

  /**
   * Disable all device tokens for a user (logout)
   */
  async disableUserTokens(userId: string) {
    try {
      const tokens = await this.getUserDeviceTokens(userId);
      const updates = tokens.map((token) =>
        updateDoc(doc(db, "deviceTokens", token.id!), {
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(updates);
      console.log(`Disabled ${tokens.length} device tokens for user:`, userId);
    } catch (error: any) {
      console.error("Error disabling user tokens:", error);
    }
  },
};
