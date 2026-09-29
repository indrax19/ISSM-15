import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { handleFirestoreError } from "./utils";
import { SslProject } from "./sslProjectsAPI";
import { SslSubProject } from "./sslSubProjectsAPI";

export const realtimeSslProjectsAPI = {
  subscribeAll(
    callback: (projects: SslProject[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const q = query(collection(db, "ssl_projects"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SslProject[]);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in SSL projects subscription:", error);
        onError?.(error as Error);
      },
    );
  },

  subscribeById(
    id: string,
    callback: (project: SslProject | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, "ssl_projects", id),
      (snapshot) => {
        callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as SslProject) : null);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in SSL project subscription:", error);
        onError?.(error as Error);
      },
    );
  },
};

export const realtimeSslSubProjectsAPI = {
  subscribeAll(
    callback: (subProjects: SslSubProject[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const q = query(collection(db, "ssl_sub_projects"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SslSubProject[]);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in SSL sub-projects subscription:", error);
        onError?.(error as Error);
      },
    );
  },

  subscribeByProject(
    projectId: string,
    callback: (subProjects: SslSubProject[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const q = query(collection(db, "ssl_sub_projects"), where("project_id", "==", projectId));
    return onSnapshot(
      q,
      (snapshot) => {
        const subProjects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SslSubProject[];
        subProjects.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
        callback(subProjects);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in SSL sub-projects subscription:", error);
        onError?.(error as Error);
      },
    );
  },

  subscribeById(
    id: string,
    callback: (subProject: SslSubProject | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, "ssl_sub_projects", id),
      (snapshot) => {
        callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as SslSubProject) : null);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in SSL sub-project subscription:", error);
        onError?.(error as Error);
      },
    );
  },
};
