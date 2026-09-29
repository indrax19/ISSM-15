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
  runTransaction,
} from "firebase/firestore";
import { removeUndefined, handleFirestoreError } from "./utils";

export type SlaCheckResult = "" | "OK" | "Not OK" | "N/A";

export interface SlaChecklistRow {
  point: string;
  result: SlaCheckResult;
  remarks: string;
}

export interface SlaCameraInspection {
  cameraId: string;
  location: string;
  online: boolean;
  imageOk: boolean;
  recordingOk: boolean;
  physicalCondition: string;
  remarks: string;
}

export interface SlaIssueRecord {
  issue: string;
  category: string;
  priority: string;
  actionTaken: string;
  status: string;
  remarks: string;
}

export interface SlaRequirementRecord {
  requirement: string;
  reason: string;
  hardwareRequired: string;
  priority: string;
}

export interface SlaSignoff {
  name: string;
  signature: string;
  date: string;
}

export interface SslMaintenanceVisitReport {
  formNumber: string;
  documentDate: string;
  slaYear: string;
  projectName: string;
  fbrSiteId: string;
  visitDate: string;
  visitType: string;
  otherVisitType: string;
  visitNumber: string;
  previousVisitDate: string;
  customerPocName: string;
  customerDesignation: string;
  customerContact: string;
  customerEmail: string;
  engineerNames: string[];
  engineerDesignations: string[];
  cameraCounts: Record<string, string>;
  additionalRequirements: string[];
  overallStatus: string;
  siteProductionRows: SlaChecklistRow[];
  cameraInspections: SlaCameraInspection[];
  checklistRows: Record<string, SlaChecklistRow[]>;
  productionChanges: Record<string, boolean | null>;
  productionObservations: string;
  issues: SlaIssueRecord[];
  changeRequests: SlaRequirementRecord[];
  photoUrls: Array<string | null>;
  engineerRemarks: string;
  customerSignoff: SlaSignoff;
  engineerSignoffs: SlaSignoff[];
  fbrSubmission: SlaSignoff & { fbrSiteId: string; designation: string };
}

export interface SslSubProject {
  maintenanceReport?: SslMaintenanceVisitReport;
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
  
  // Project Status
  projectStatus: "Complete" | "Partially Completed" | "In Progress" | "Not Yet Started" | "No PO Yet";
  
  // Supplier
  supplierName: string;
  isSupplierCustom?: boolean;
  
  // Logistics Status
  logisticsStatus: "Pending Dispatch" | "Dispatched" | "In Transit" | "Arrived at Destination" | "Delayed – Logistics";
  
  // PO Status
  poStatus: "Issued" | "Pending" | "Cancelled" | "On Hold";
  
  // PO Date
  poDate: string;
  
  // Project Timeline
  startDate: string;
  endDate: string;
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

  // Category/Type
  category?: "ISSM" | "Obsidian";

  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export const sslSubProjectsAPI = {
  // Get all SSL sub-project records
  async getAll() {
    try {
      const q = query(
        collection(db, "ssl_sub_projects"),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SslSubProject[];

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
      const docRef = doc(db, "ssl_sub_projects", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SslSubProject;
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
        collection(db, "ssl_sub_projects"),
        where("project_id", "==", projectId)
      );
      const snapshot = await getDocs(q);
      const sites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SslSubProject[];

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

  async createMaintenanceVisit(projectData: SslSubProject & { maintenanceReport: SslMaintenanceVisitReport }): Promise<SslSubProject & { maintenanceReport: SslMaintenanceVisitReport }> {
    try {
      const startDate = new Date(projectData.startDate);
      const endDate = new Date(projectData.endDate);
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const counterRef = doc(db, "sequences", "slaVisitCounter");
      const subProjectRef = doc(collection(db, "ssl_sub_projects"));

      return await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentNumber = counterDoc.exists() ? counterDoc.data().nextNumber || 0 : 0;
        const nextNumber = currentNumber + 1;
        const now = new Date().toISOString();
        const formNumber = `SLA-${String(nextNumber).padStart(5, "0")}`;
        const data = removeUndefined({
          ...projectData,
          maintenanceReport: { ...projectData.maintenanceReport, formNumber },
          projectDurationDays: durationDays > 0 ? durationDays : 0,
          created_at: now,
          updated_at: now,
        });

        transaction.set(counterRef, { nextNumber, updated_at: now });
        transaction.set(subProjectRef, data);
        return { id: subProjectRef.id, ...data } as SslSubProject & { maintenanceReport: SslMaintenanceVisitReport };
      });
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create SLA maintenance visit"
      );
    }
  },

  // Create new SSL sub-project record
  async create(projectData: SslSubProject) {
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
      const docRef = await addDoc(collection(db, "ssl_sub_projects"), data);
      return { id: docRef.id, ...data };
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create SSL sub-project record"
      );
    }
  },

  // Update SSL sub-project record
  async update(id: string, projectData: Partial<SslSubProject>) {
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

      const docRef = doc(db, "ssl_sub_projects", id);
      await updateDoc(docRef, updateData);
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to update SSL sub-project record"
      );
    }
  },

  // Delete SSL sub-project record
  async delete(id: string) {
    try {
      await deleteDoc(doc(db, "ssl_sub_projects", id));
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to delete SSL sub-project record"
      );
    }
  },

  // Real-time listener for all sites by project ID (sorted in memory)
  subscribeByProject(projectId: string, callback: (sites: SslSubProject[]) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const q = query(
        collection(db, "ssl_sub_projects"),
        where("project_id", "==", projectId)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const sites = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SslSubProject[];

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
          console.error("Error in SSL sub-project subscription:", error);
          onError?.(error as Error);
        }
      );
    } catch (error: any) {
      if (handleFirestoreError(error)) {
        return () => {};
      }
      console.error("Failed to set up SSL sub-project listener:", error);
      if (onError) {
        onError(error as Error);
      }
      return () => {};
    }
  },

  // Real-time listener for a single site
  subscribeSite(id: string, callback: (site: SslSubProject | null) => void, onError?: (error: Error) => void): Unsubscribe {
    try {
      const docRef = doc(db, "ssl_sub_projects", id);
      return onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as SslSubProject);
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
