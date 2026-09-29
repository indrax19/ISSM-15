import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc, deleteDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError, removeUndefined } from "./utils";

export interface CustomerRemark {
  id: string;
  text: string;
  createdAt: string;
  createdBy?: string;
}

export interface PointOfContact {
  id: string;
  name: string;
  designation: string;
  email: string;
  mobile: string;
}

export interface CustomerData {
  id?: string;
  customerName: string;
  organization?: string;
  industry?: string;
  address?: string;
  telephone?: string;
  email?: string;
  pocs: PointOfContact[];
  source: "Social media" | "Phone" | "Email" | "Reference";
  referenceName?: string;
  remarks: CustomerRemark[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const customerDataAPI = {
  async create(customer: Omit<CustomerData, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...customer, created_at: now, updated_at: now });
    const reference = await addDoc(collection(db, "customer_data"), data);
    return { id: reference.id, ...data };
  },

  async update(id: string, customer: Partial<CustomerData>) {
    await updateDoc(doc(db, "customer_data", id), removeUndefined({ ...customer, updated_at: new Date().toISOString() }));
  },

  async delete(id: string) {
    await deleteDoc(doc(db, "customer_data", id));
  },

  subscribeAll(callback: (customers: CustomerData[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, "customer_data"), orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as CustomerData[]),
      (error) => {
        if (handleFirestoreError(error)) return;
        onError?.(error as Error);
      },
    );
  },
};
