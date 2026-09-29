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

export interface ParentProject {
  id?: string;
  name: string;
  description?: string;
  projectType?: "ISSM" | "Obsidian";
  assignedUsers?: string[]; // Array of user IDs who can view/edit this project
  projectIconUrl?: string;
  module?: "project-tracking" | "outreach";
  created_at?: string;
  updated_at?: string;
}

export const parentProjectsAPI = {
  // Get all parent projects with counts
  async getAllWithCounts() {
    try {
      const q = query(
        collection(db, "parent_projects"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      const projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ParentProject[];

      return projects;
    } catch (error: any) {
      // Suppress abort errors silently, return empty array
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Get parent project by ID
  async getById(id: string) {
    try {
      const docRef = doc(db, "parent_projects", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ParentProject;
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

  // Create new parent project
  async create(projectData: ParentProject) {
    try {
      const data = removeUndefined({
        name: projectData.name,
        ...(projectData.description ? { description: projectData.description } : {}),
        ...(projectData.projectType ? { projectType: projectData.projectType } : { projectType: "ISSM" }),
        ...(projectData.projectIconUrl ? { projectIconUrl: projectData.projectIconUrl } : {}),
        ...(projectData.module ? { module: projectData.module } : {}),
        assignedUsers: projectData.assignedUsers || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "parent_projects"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create parent project"
      );
    }
  },

  // Update parent project
  async update(id: string, projectData: Partial<ParentProject>) {
    try {
      const data = removeUndefined({
        ...(projectData.name ? { name: projectData.name } : {}),
        ...(projectData.description !== undefined ? { description: projectData.description } : {}),
        ...(projectData.projectType !== undefined ? { projectType: projectData.projectType } : {}),
        ...(projectData.projectIconUrl !== undefined ? { projectIconUrl: projectData.projectIconUrl } : {}),
        ...(projectData.module !== undefined ? { module: projectData.module } : {}),
        ...(projectData.assignedUsers !== undefined ? { assignedUsers: projectData.assignedUsers } : {}),
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "parent_projects", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update parent project"
      );
    }
  },

  // Delete parent project
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "parent_projects", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete parent project"
      );
    }
  },

  // Real-time listener for all parent projects
  subscribeAll(callback: (projects: ParentProject[]) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const q = query(collection(db, "parent_projects"), orderBy("created_at", "desc"));
      return onSnapshot(
        q,
        (snapshot) => {
          const projects = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ParentProject[];
          callback(projects);
        },
        (error) => {
          console.error("Error in parent projects subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      console.error("Failed to set up parent projects listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },

  // Real-time listener for a single parent project
  subscribeById(id: string, callback: (project: ParentProject | null) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const docRef = doc(db, "parent_projects", id);
      return onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as ParentProject);
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error("Error in parent project subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      console.error("Failed to set up parent project listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },

  subscribeByModule(
    module: ParentProject["module"],
    callback: (projects: ParentProject[]) => void,
    outreachProjectIds = new Set<string>(),
    trackingProjectIds = new Set<string>(),
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return this.subscribeAll(
      (projects) => callback(filterParentProjectsByModule(projects, module, outreachProjectIds, trackingProjectIds)),
      onError,
    );
  },
};

export function filterParentProjectsByModule(
  projects: ParentProject[],
  module: ParentProject["module"],
  outreachProjectIds = new Set<string>(),
  trackingProjectIds = new Set<string>(),
) {
  return projects.filter((project) => {
    if (module === "outreach") return project.module === "outreach";
    return project.module === "project-tracking" || (!project.module && trackingProjectIds.has(project.id || ""));
  });
}
