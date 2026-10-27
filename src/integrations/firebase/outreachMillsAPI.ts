import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Unsubscribe, updateDoc } from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError, removeUndefined } from "./utils";

export interface OutreachRemark {
  id: string;
  text: string;
  createdAt: string;
  createdBy?: string;
}

export interface OutreachMillPoc {
  name: string;
  number: string;
  email: string;
}

export interface OutreachMill {
  id?: string;
  spinningMill: string;
  unit?: string;
  category?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  pocName?: string;
  pocNumber?: string;
  pocEmail?: string;
  pocs?: OutreachMillPoc[];
  notes?: string;
  remarks: OutreachRemark[];
  status?: string;
  scheduledDate?: string;
  assignedTo?: string;
  assignedToUserId?: string;
  transferredProjectId?: string;
  transferredSurveyReportId?: string;
  transferredQuotationId?: string;
  transferredAt?: string;
  parentProjectId?: string;
  sequence?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const outreachMillsAPI = {
  async create(mill: Omit<OutreachMill, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...mill, category: mill.category?.trim() || "Textile", sequence: mill.sequence ?? Date.now(), created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, "outreach_mills"), data);
    return { id: reference.id, ...data };
  },

  async update(id: string, mill: Partial<OutreachMill>) {
    await updateDoc(doc(db, "outreach_mills", id), removeUndefined({ ...mill, updated_at: new Date().toISOString() }));
  },

  async delete(id: string) {
    await deleteDoc(doc(db, "outreach_mills", id));
  },

  subscribeAll(callback: (mills: OutreachMill[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "outreach_mills"), orderBy("created_at", "asc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as OutreachMill[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      }
    );
  },
};
