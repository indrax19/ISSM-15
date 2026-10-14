import { db } from "./config";
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export type IssueStatus =
  | "Open"
  | "In Progress"
  | "Pending"
  | "Client Not Available"
  | "On Hold"
  | "Resolved";

export interface StatusHistoryEntry {
  status: IssueStatus;
  updatedBy: string; // User ID
  updatedByName?: string;
  timestamp: string; // ISO timestamp
  remarks?: string;
}

export interface Issue {
  id?: string;
  site_id: string; // Link to site
  title: string;
  description: string;
  createdBy: string; // User ID
  createdByName?: string;
  createdTime: string; // ISO timestamp
  status: IssueStatus; // Current status
  statusHistory: StatusHistoryEntry[]; // Array of all status updates
  resolvedBy?: string; // User ID who resolved
  resolvedByName?: string;
  resolvedTime?: string; // ISO timestamp when resolved
  remarks?: string;
  created_at?: string; // System timestamp
  updated_at?: string; // System timestamp
}

export const issuesAPI = {
  // Get all issues
  async getAll() {
    try {
      const q = query(collection(db, "issues"));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          // Sort by createdTime in descending order (newest first)
          const dateA = new Date(a.createdTime || "").getTime();
          const dateB = new Date(b.createdTime || "").getTime();
          return dateB - dateA;
        }) as Issue[];
    } catch (error: any) {
      // Suppress abort errors silently
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Get issue by ID
  async getById(id: string) {
    try {
      const docRef = doc(db, "issues", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Issue;
      }
      return null;
    } catch (error: any) {
      // Suppress abort errors silently
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  // Create new issue
  async create(issue: Issue) {
    try {
      const data = removeUndefined({
        ...issue,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "issues"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create issue"
      );
    }
  },

  // Update issue
  async update(id: string, issue: Partial<Issue>) {
    try {
      const data = removeUndefined({
        ...issue,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "issues", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update issue"
      );
    }
  },

  // Delete issue
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "issues", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete issue"
      );
    }
  },

  // Real-time listener for all issues
  subscribeAll(
    callback: (issues: Issue[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, "issues"));
    return onSnapshot(
      q,
      (snapshot) => {
        const issues = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            // Sort by createdTime in descending order (newest first)
            const dateA = new Date(a.createdTime || "").getTime();
            const dateB = new Date(b.createdTime || "").getTime();
            return dateB - dateA;
          }) as Issue[];
        callback(issues);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in issues subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Real-time listener for issues by site_id
  subscribeBySiteId(
    siteId: string,
    callback: (issues: Issue[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "issues"),
      where("site_id", "==", siteId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const issues = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            // Sort by createdTime in descending order (newest first)
            const dateA = new Date(a.createdTime || "").getTime();
            const dateB = new Date(b.createdTime || "").getTime();
            return dateB - dateA;
          }) as Issue[];
        callback(issues);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in issues by site subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Real-time listener for a single issue
  subscribeById(
    id: string,
    callback: (issue: Issue | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, "issues", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as Issue);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in issue subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Update issue status with history tracking
  async updateStatus(
    id: string,
    newStatus: IssueStatus,
    updatedBy: string,
    updatedByName?: string,
    remarks?: string
  ) {
    try {
      const docRef = doc(db, "issues", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Issue not found");
      }

      const issue = docSnap.data() as Issue;
      const timestamp = new Date().toISOString();

      // Create status history entry
      const statusHistoryEntry: StatusHistoryEntry = {
        status: newStatus,
        updatedBy,
        updatedByName,
        timestamp,
        remarks,
      };

      // Add to existing history
      const statusHistory = issue.statusHistory || [];
      statusHistory.push(statusHistoryEntry);

      // Prepare update data
      const updateData: Partial<Issue> = {
        status: newStatus,
        statusHistory,
        updated_at: timestamp,
      };

      // If resolved, add resolved metadata
      if (newStatus === "Resolved") {
        updateData.resolvedBy = updatedBy;
        updateData.resolvedByName = updatedByName;
        updateData.resolvedTime = timestamp;
        if (remarks) {
          updateData.remarks = remarks;
        }
      }

      const data = removeUndefined(updateData);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update issue status"
      );
    }
  },
};
