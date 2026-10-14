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
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface KnowledgeBaseDocument {
  id?: string;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number; // in bytes
  fileType: string; // e.g., "application/pdf" or "link"
  sourceType?: "file" | "link";
  category?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  created_at?: string;
  updated_at?: string;
  downloads?: number; // Track number of downloads
}

export const knowledgeBaseAPI = {
  // Get all documents
  async getAll() {
    try {
      const q = query(
        collection(db, "knowledge_base"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as KnowledgeBaseDocument[];
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Get document by ID
  async getById(id: string) {
    try {
      const docRef = doc(db, "knowledge_base", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as KnowledgeBaseDocument;
      }
      return null;
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  // Create new document
  async create(documentData: KnowledgeBaseDocument) {
    try {
      const now = new Date().toISOString();
      const data = removeUndefined({
        ...documentData,
        downloads: 0,
        created_at: now,
        updated_at: now,
      });
      const docRef = await addDoc(collection(db, "knowledge_base"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create document"
      );
    }
  },

  // Update document
  async update(id: string, documentData: Partial<KnowledgeBaseDocument>) {
    try {
      const updateData: any = removeUndefined({
        ...documentData,
        updated_at: new Date().toISOString(),
      });

      const docRef = doc(db, "knowledge_base", id);
      await updateDoc(docRef, updateData);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update document"
      );
    }
  },

  // Delete document
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "knowledge_base", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete document"
      );
    }
  },

  // Increment download count
  async incrementDownloadCount(id: string) {
    try {
      const docRef = doc(db, "knowledge_base", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const currentDownloads = docSnap.data().downloads || 0;
        await updateDoc(docRef, {
          downloads: currentDownloads + 1,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error("Failed to increment download count:", error);
    }
  },

  // Real-time listener for all documents
  subscribeAll(callback: (documents: KnowledgeBaseDocument[]) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const q = query(
        collection(db, "knowledge_base"),
        orderBy("created_at", "desc")
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const documents = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as KnowledgeBaseDocument[];
          callback(documents);
        },
        (error) => {
          console.error("Error in knowledge base subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      console.error("Failed to set up knowledge base listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },
};
