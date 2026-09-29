import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import { removeUndefined } from "./utils";

export interface OutreachProject {
  id?: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const projectsCollection = collection(db, "outreach_projects");

export const outreachProjectsAPI = {
  async create(project: Omit<OutreachProject, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const data = removeUndefined({ ...project, created_at: now, updated_at: now });
    const reference = await addDoc(projectsCollection, data);
    return { id: reference.id, ...data } as OutreachProject;
  },

  async update(id: string, project: Partial<OutreachProject>) {
    await updateDoc(doc(db, "outreach_projects", id), removeUndefined({ ...project, updated_at: new Date().toISOString() }));
  },

  async delete(id: string) {
    await deleteDoc(doc(db, "outreach_projects", id));
  },

  subscribeAll(callback: (projects: OutreachProject[]) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(projectsCollection, orderBy("created_at", "desc")),
      (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as OutreachProject[]),
      (error) => onError?.(error as Error),
    );
  },

  subscribeById(id: string, callback: (project: OutreachProject | null) => void, onError?: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      doc(db, "outreach_projects", id),
      (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as OutreachProject) : null),
      (error) => onError?.(error as Error),
    );
  },

  async getById(id: string) {
    const snapshot = await getDoc(doc(db, "outreach_projects", id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as OutreachProject) : null;
  },
};
