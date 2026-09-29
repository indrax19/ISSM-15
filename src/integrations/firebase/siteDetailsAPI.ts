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

export interface CameraConfig {
  id?: string;
  name: string; // Camera 1, Camera 2, etc.
  ip?: string;
}

export interface SiteDetails {
  id?: string;
  siteName?: string;
  supervisorName?: string;
  technicianName?: string;
  date?: string;
  millName?: string;
  millLocation?: string;
  unitNo?: string;
  pocName?: string;
  pocContact?: string;
  gpuUserName?: string;
  gpuPassword?: string;
  anydeskId?: string;
  anydeskPassword?: string;
  anydeskId2?: string;
  anydeskPassword2?: string;
  tailscaleIp?: string;
  remoteanydeskPassword?: string;
  remoteanydeskAccountName?: string;
  rustdeskId?: string;
  rustdeskPassword?: string;
  rustdeskId2?: string;
  rustdeskPassword2?: string;
  pcNic?: string;
  subnet?: string;
  defaultGateway?: string;
  dns?: string;
  liveIp?: string;
  nvrIp?: string;
  nvrIp2?: string;
  nvrUsername?: string;
  nvrPassword?: string;
  cameraUsername?: string;
  cameraPassword?: string;
  cameras: CameraConfig[];
  additionalDetails?: string;
  hardwareCompleted?: boolean;
  dataCopy?: boolean;
  patch1Date?: string;
  patch2Date?: string;
  completionCertificate?: boolean;
  roiCreated?: boolean;
  completionFormImageUrl?: string;
  technical_project_id?: string; // Link to parent technical project
  created_at?: string;
  updated_at?: string;
}

export const siteDetailsAPI = {
  // Get all site details
  async getAll() {
    try {
      const q = query(
        collection(db, "site_details"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SiteDetails[];
    } catch (error: any) {
      // Suppress abort errors silently
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Get site by ID
  async getById(id: string) {
    try {
      const docRef = doc(db, "site_details", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SiteDetails;
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

  // Get site by name
  async getByName(siteName: string) {
    try {
      const q = query(collection(db, "site_details"));
      const snapshot = await getDocs(q);
      const sites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SiteDetails[];
      return sites.find((s) => s.siteName === siteName) || null;
    } catch (error: any) {
      // Suppress abort errors silently
      if (handleFirestoreError(error)) {
        return null;
      }
      return null;
    }
  },

  // Create new site details
  async create(siteDetails: SiteDetails) {
    try {
      const data = removeUndefined({
        ...siteDetails,
        date: siteDetails.date || new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "site_details"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create site details"
      );
    }
  },

  // Update site details
  async update(id: string, siteDetails: Partial<SiteDetails>) {
    try {
      const data = removeUndefined({
        ...siteDetails,
        updated_at: new Date().toISOString(),
      });
      const docRef = doc(db, "site_details", id);
      await updateDoc(docRef, data);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update site details"
      );
    }
  },

  // Delete site details
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "site_details", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete site details"
      );
    }
  },

  // Real-time listener for all site details
  subscribeAll(
    callback: (sites: SiteDetails[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "site_details"),
      orderBy("created_at", "desc")
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const sites = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SiteDetails[];
        callback(sites);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in site details subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Real-time listener for a single site detail
  subscribeById(
    id: string,
    callback: (site: SiteDetails | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, "site_details", id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as SiteDetails);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in site details subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Real-time listener for sites by technical_project_id
  subscribeByProjectId(
    projectId: string,
    callback: (sites: SiteDetails[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, "site_details"),
      where("technical_project_id", "==", projectId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const sites = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .sort((a, b) => {
            // Sort by created_at in descending order (newest first)
            const dateA = new Date((a as any).created_at || "").getTime();
            const dateB = new Date((b as any).created_at || "").getTime();
            return dateB - dateA;
          }) as SiteDetails[];
        callback(sites);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in site details by project subscription:", error);
        onError?.(error as Error);
      }
    );
  },

};
