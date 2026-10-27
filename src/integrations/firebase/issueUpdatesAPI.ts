import { db } from "./config";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  getDocs,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface IssueUpdate {
  id?: string;
  issueId: string;
  siteId: string;
  message: string;
  updatedBy: string;
  updatedByName?: string;
  createdAt: string;
  updateType: "status_update" | "work_progress" | "note" | "internal_comment";
}

/**
 * API for managing issue updates and progress messages
 * Allows users to add comments/updates before issue is resolved
 */
export const issueUpdatesAPI = {
  /**
   * Add an update/comment to an issue
   */
  async create(update: IssueUpdate) {
    try {
      const data = removeUndefined({
        ...update,
        createdAt: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "issueUpdates"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      console.error("Error creating issue update:", error);
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create issue update"
      );
    }
  },

  /**
   * Get all updates for a specific issue
   */
  async getByIssueId(issueId: string): Promise<IssueUpdate[]> {
    try {
      const q = query(
        collection(db, "issueUpdates"),
        where("issueId", "==", issueId),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as IssueUpdate[];
    } catch (error: any) {
      console.error("Error fetching issue updates:", error);
      if (handleFirestoreError(error)) return [];
      return [];
    }
  },

  /**
   * Real-time listener for issue updates
   */
  subscribeToIssueUpdates(
    issueId: string,
    callback: (updates: IssueUpdate[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "issueUpdates"),
      where("issueId", "==", issueId),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const updates = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as IssueUpdate[];
        callback(updates);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in issue updates subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  /**
   * Get updates count for an issue
   */
  async getUpdateCount(issueId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "issueUpdates"),
        where("issueId", "==", issueId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error: any) {
      console.error("Error getting update count:", error);
      if (handleFirestoreError(error)) return 0;
      return 0;
    }
  },
};
