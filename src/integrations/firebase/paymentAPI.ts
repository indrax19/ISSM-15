import { db } from "./config";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface Payment {
  id?: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  paymentDate: string;
  paymentMethod: "cash" | "bank_transfer" | "cheque" | "online";
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  receipt?: string;
  created_at?: string;
  updated_at?: string;
}

export const paymentAPI = {
  async getAll(): Promise<Payment[]> {
    try {
      const q = query(collection(db, "payments"));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Payment))
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // Descending order
        });
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getByInvoiceId(invoiceId: string): Promise<Payment[]> {
    try {
      const q = query(
        collection(db, "payments"),
        where("invoiceId", "==", invoiceId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Payment))
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // Descending order
        });
    } catch (error: any) {
      handleFirestoreError(error);
      return [];
    }
  },

  async getById(id: string): Promise<Payment | null> {
    try {
      const docRef = doc(db, "payments", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Payment;
      }
      return null;
    } catch (error: any) {
      handleFirestoreError(error);
      return null;
    }
  },

  async create(payment: Payment): Promise<Payment> {
    try {
      const data = removeUndefined({
        ...payment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "payments"), data);
      return {
        id: docRef.id,
        ...data,
      } as Payment;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create payment"
      );
    }
  },

  async update(id: string, payment: Partial<Payment>): Promise<void> {
    try {
      const data = removeUndefined({
        ...payment,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "payments", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update payment"
      );
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "payments", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete payment"
      );
    }
  },

  subscribeByInvoiceId(
    invoiceId: string,
    callback: (payments: Payment[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "payments"),
      where("invoiceId", "==", invoiceId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Payment))
          .sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA; // Descending order
          });
        callback(payments);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in payments subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  subscribeAll(
    callback: (payments: Payment[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, "payments"));

    return onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Payment))
          .sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA; // Descending order
          });
        callback(payments);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in payments subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};
