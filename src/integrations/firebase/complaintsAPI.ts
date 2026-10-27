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
  onSnapshot,
  Unsubscribe,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export type ComplaintStatus =
  | "Open"
  | "In Progress"
  | "Waiting for Response"
  | "Pending"
  | "On Hold"
  | "Resolved";

export interface StatusHistoryEntry {
  status: ComplaintStatus;
  updatedBy: string;
  updatedByName?: string;
  timestamp: string;
  remarks?: string;
}

export interface FollowUp {
  id?: string;
  addedBy: string;
  addedByName?: string;
  timestamp: string;
  subject?: string;
  description: string;
}

export interface ComplaintPage {
  complaints: Complaint[];
  nextCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface Complaint {
  id?: string;
  projectId: string;
  siteId: string;
  subject: string;
  description: string;
  date: string;
  createdBy: string;
  createdByName?: string;
  createdTime: string;
  status: ComplaintStatus;
  statusHistory: StatusHistoryEntry[];
  followUps?: FollowUp[];
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedTime?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export const complaintsAPI = {
  async getOpenComplaintsBySite(siteId: string) {
    try {
      const snapshot = await getDocs(collection(db, "complaints"));
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((complaint: any) => complaint.siteId === siteId && complaint.status !== "Resolved") as Complaint[];
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  async getPage(pageSize: number, cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<ComplaintPage> {
    try {
      const pageQuery = query(
        collection(db, "complaints"),
        orderBy("createdTime", "desc"),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(pageSize)
      );
      const snapshot = await getDocs(pageQuery);
      const complaints = snapshot.docs.map((complaintDoc) => ({
        id: complaintDoc.id,
        ...complaintDoc.data(),
      })) as Complaint[];

      return {
        complaints,
        nextCursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === pageSize,
      };
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return { complaints: [], nextCursor: null, hasMore: false };
      }
      throw error;
    }
  },

  async getAll() {
    try {
      const q = query(collection(db, "complaints"));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          const dateA = new Date(a.createdTime || "").getTime();
          const dateB = new Date(b.createdTime || "").getTime();
          return dateB - dateA;
        }) as Complaint[];
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  async getById(id: string) {
    try {
      const docRef = doc(db, "complaints", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Complaint;
      }
      return null;
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  async create(complaint: Complaint) {
    try {
      const data = removeUndefined({
        ...complaint,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "complaints"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create complaint"
      );
    }
  },

  async update(id: string, complaint: Partial<Complaint>) {
    try {
      const data = removeUndefined({
        ...complaint,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "complaints", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update complaint"
      );
    }
  },

  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "complaints", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete complaint"
      );
    }
  },

  subscribeAll(
    callback: (complaints: Complaint[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, "complaints"));
    return onSnapshot(
      q,
      (snapshot) => {
        const complaints = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            const dateA = new Date(a.createdTime || "").getTime();
            const dateB = new Date(b.createdTime || "").getTime();
            return dateB - dateA;
          }) as Complaint[];
        callback(complaints);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in complaints subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  async updateStatus(
    id: string,
    newStatus: ComplaintStatus,
    updatedBy: string,
    updatedByName?: string,
    remarks?: string
  ) {
    try {
      const docRef = doc(db, "complaints", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Complaint not found");
      }

      const complaint = docSnap.data() as Complaint;
      const timestamp = new Date().toISOString();

      const statusHistoryEntry: StatusHistoryEntry = {
        status: newStatus,
        updatedBy,
        updatedByName,
        timestamp,
      };

      if (remarks) {
        statusHistoryEntry.remarks = remarks;
      }

      const statusHistory = complaint.statusHistory || [];
      statusHistory.push(statusHistoryEntry);

      const updateData: Partial<Complaint> = {
        status: newStatus,
        statusHistory,
        updated_at: timestamp,
      };

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
          : error.message || "Failed to update complaint status"
      );
    }
  },

  async addFollowUp(
    id: string,
    followUp: FollowUp
  ) {
    try {
      const docRef = doc(db, "complaints", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Complaint not found");
      }

      const complaint = docSnap.data() as Complaint;
      const followUps = complaint.followUps || [];
      followUps.push(followUp);

      const updateData: Partial<Complaint> = {
        followUps,
        updated_at: new Date().toISOString(),
      };

      const data = removeUndefined(updateData);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to add follow-up"
      );
    }
  },
};
