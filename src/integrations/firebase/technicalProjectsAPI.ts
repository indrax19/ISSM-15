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

export interface TechnicalProject {
  id?: string;
  name: string;
  description?: string;
  assignedUsers?: string[]; // Array of user IDs who can view/edit this project
  iconUrl?: string;
  category?: "ISSM" | "Obsidian"; // Project category/type
  created_at?: string;
  updated_at?: string;
}

export const technicalProjectsAPI = {
  // Get all technical projects
  async getAll() {
    try {
      const q = query(
        collection(db, "technical_projects"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TechnicalProject[];
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Get technical project by ID
  async getById(id: string) {
    try {
      const docRef = doc(db, "technical_projects", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as TechnicalProject;
      }
      return null;
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  // Create new technical project
  async create(projectData: TechnicalProject) {
    try {
      const data = removeUndefined({
        name: projectData.name,
        ...(projectData.description ? { description: projectData.description } : {}),
        ...(projectData.iconUrl ? { iconUrl: projectData.iconUrl } : {}),
        ...(projectData.category ? { category: projectData.category } : {}),
        assignedUsers: projectData.assignedUsers || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "technical_projects"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create technical project"
      );
    }
  },

  // Update technical project
  async update(id: string, projectData: Partial<TechnicalProject>) {
    try {
      const data = removeUndefined({
        ...(projectData.name ? { name: projectData.name } : {}),
        ...(projectData.description !== undefined ? { description: projectData.description } : {}),
        ...(projectData.iconUrl !== undefined ? { iconUrl: projectData.iconUrl } : {}),
        ...(projectData.category !== undefined ? { category: projectData.category } : {}),
        ...(projectData.assignedUsers !== undefined ? { assignedUsers: projectData.assignedUsers } : {}),
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "technical_projects", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update technical project"
      );
    }
  },

  // Delete technical project
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "technical_projects", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete technical project"
      );
    }
  },

  // Real-time listener for all technical projects
  subscribeAll(
    callback: (projects: TechnicalProject[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const q = query(collection(db, "technical_projects"), orderBy("created_at", "desc"));
      return onSnapshot(
        q,
        (snapshot) => {
          const projects = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as TechnicalProject[];
          callback(projects);
        },
        (error) => {
          console.error("Error in technical projects subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      console.error("Failed to set up technical projects listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },

  // Real-time listener for a single technical project
  subscribeById(
    id: string,
    callback: (project: TechnicalProject | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const docRef = doc(db, "technical_projects", id);
      return onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as TechnicalProject);
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error("Error in technical project subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      console.error("Failed to set up technical project listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },
};
