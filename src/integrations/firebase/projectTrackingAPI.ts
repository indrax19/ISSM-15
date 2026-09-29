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
  where,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export interface ProjectRemark {
  text: string;
  authorName: string;
  createdAt: string;
}

export interface ProjectTracking {
  id?: string;
  project_id: string; // Reference to parent project
  // Site Information
  millName: string;
  city: string;
  district: string;
  address?: string;
  state?: string;
  cityDistrict?: string;
  unitNo?: string;
  
  // POC Details
  pocName: string;
  pocPhone: string;
  pocProjectName?: string;
  pocProjectPhone?: string;
  pocProjectEmail?: string;
  pocSiteName?: string;
  pocSitePhone?: string;
  pocSiteEmail?: string;
  pocTechnicalName?: string;
  pocTechnicalPhone?: string;
  pocTechnicalEmail?: string;
  
  // Project Status
  projectStatus: "Complete" | "Partially Completed" | "In Progress" | "Not Yet Started" | "No PO Yet";
  projectNotStarted?: boolean;
  projectCompleted?: boolean;
  preRepositoryCompleted?: boolean;
  cablingCompleted?: boolean;
  camerasInstalled?: boolean;
  nvrInstalled?: boolean;
  osInstalled?: boolean;
  softwareInstalled?: boolean;
  systemLive?: boolean;

  // Supplier
  supplierName: string;
  isSupplierCustom?: boolean;
  
  // Logistics Status
  logisticsStatus: "Pending Dispatch" | "Dispatched" | "In Transit" | "Arrived at Destination" | "Delayed – Logistics";
  
  // PO Status
  poStatus: string;
  
  // PO Date
  poDate: string;
  aviraPoStatus?: string;
  aviraPoDate?: string;

  // Project Timeline
  startDate: string;
  endDate: string;
  timelineStatus?: "Pause" | "Hold" | "Hold by Mill" | "Awaiting Confirmation";
  projectDurationDays?: number;
  
  // Supervisor / Team
  supervisorName: string;
  technicianNames: string[];
  
  // Team Status
  teamStatus: "Scheduled" | "Mobilized" | "Travelling" | "Onsite – Work In Progress" | "Onsite – Completed" | "Returned to Base" | "Standby / Idle";
  
  // Hardware / ISSM Status
  hardwareStatus: string;
  isHardwareStatusCustom?: boolean;
  
  // Hardware Delivery Status
  hardwareDeliveryStatus: "Pending Dispatch" | "Dispatched" | "In Transit" | "Arrived at Destination" | "Delayed – Logistics";

  // Project Photo/Picture
  projectPhotoUrl?: string;

  // Project Icon
  projectIconUrl?: string;

  // Site Document Upload
  siteDocumentUrl?: string | null;
  siteDocumentName?: string | null;
  siteDocumentType?: string | null;
  dispatchSlipUrl?: string | null;
  dispatchSlipName?: string | null;
  dispatchSlipType?: string | null;

  // Category/Type
  category?: "ISSM" | "Obsidian";

  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  remarksHistory?: ProjectRemark[];
}

export const projectTrackingAPI = {
  // Get all project tracking records
  async getAll() {
    try {
      const q = query(
        collection(db, "project_tracking"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProjectTracking[];

      // Sort to put ISSM Labelling Solutions at the top
      return data.sort((a, b) => {
        // If both are ISSM Labelling Solutions, maintain original order
        if (a.millName === "ISSM Labelling Solutions" && b.millName === "ISSM Labelling Solutions") {
          return 0;
        }
        // ISSM Labelling Solutions comes first
        if (a.millName === "ISSM Labelling Solutions") return -1;
        if (b.millName === "ISSM Labelling Solutions") return 1;
        // For others, maintain created_at desc order
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
    } catch (error: any) {
      // Suppress abort errors silently, return empty array
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Get project by ID
  async getById(id: string) {
    try {
      const docRef = doc(db, "project_tracking", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ProjectTracking;
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

  // Get all sites by project ID (optimized with where clause, sorted in memory)
  async getByProject(projectId: string) {
    try {
      const q = query(
        collection(db, "project_tracking"),
        where("project_id", "==", projectId)
      );
      const snapshot = await getDocs(q);
      const sites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProjectTracking[];

      // Sort to put ISSM Labelling Solutions at the top, then by updated_at descending
      return sites.sort((a, b) => {
        // If both are ISSM Labelling Solutions, maintain updated_at order
        if (a.millName === "ISSM Labelling Solutions" && b.millName === "ISSM Labelling Solutions") {
          const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return dateB - dateA;
        }
        // ISSM Labelling Solutions comes first
        if (a.millName === "ISSM Labelling Solutions") return -1;
        if (b.millName === "ISSM Labelling Solutions") return 1;
        // For others, maintain updated_at desc order
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error: any) {
      // Suppress abort errors silently
      if (handleFirestoreError(error)) {
        return [];
      }
      return [];
    }
  },

  // Create new project tracking record
  async create(projectData: ProjectTracking) {
    try {
      // Calculate project duration
      const startDate = new Date(projectData.startDate);
      const endDate = new Date(projectData.endDate);
      const durationDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const now = new Date().toISOString();
      const data = removeUndefined({
        ...projectData,
        projectDurationDays: durationDays > 0 ? durationDays : 0,
        created_at: now,
        updated_at: now,
      });
      const docRef = await addDoc(collection(db, "project_tracking"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create project tracking record"
      );
    }
  },

  // Update project tracking record
  async update(id: string, projectData: Partial<ProjectTracking>) {
    try {
      // Calculate project duration if dates are provided
      const updateData: any = removeUndefined({
        ...projectData,
        updated_at: new Date().toISOString(),
      });

      if (projectData.startDate && projectData.endDate) {
        const startDate = new Date(projectData.startDate);
        const endDate = new Date(projectData.endDate);
        const durationDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        updateData.projectDurationDays = durationDays > 0 ? durationDays : 0;
      }

      const docRef = doc(db, "project_tracking", id);
      await updateDoc(docRef, updateData);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update project tracking record"
      );
    }
  },

  // Delete project tracking record
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "project_tracking", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete project tracking record"
      );
    }
  },

  // Real-time listener for all sites by project ID (sorted in memory)
  subscribeByProject(projectId: string, callback: (sites: ProjectTracking[]) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const q = query(
        collection(db, "project_tracking"),
        where("project_id", "==", projectId)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const sites = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ProjectTracking[];

          // Sort by updated_at descending (newest first)
          sites.sort((a, b) => {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return dateB - dateA;
          });

          callback(sites);
        },
        (error) => {
          if (handleFirestoreError(error)) return;
          console.error("Error in project tracking subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return () => {};
      }
      console.error("Failed to set up project tracking listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },

  // Real-time listener for a single site
  subscribeSite(id: string, callback: (site: ProjectTracking | null) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const docRef = doc(db, "project_tracking", id);
      return onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as ProjectTracking);
          } else {
            callback(null);
          }
        },
        (error) => {
          if (handleFirestoreError(error)) return;
          console.error("Error in site subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return () => {};
      }
      console.error("Failed to set up site listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },
};
