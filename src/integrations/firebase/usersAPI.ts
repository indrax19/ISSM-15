import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "./config";
import { handleFirestoreError } from "./utils";

/**
 * Available permissions/pages for the RBAC system
 *
 * To add a new page:
 * 1. Add a new permission object here with { id: "page-id", label: "Display Name" }
 * 2. Add the route in App.tsx with requiredPermission="page-id"
 * 3. Add the page to the appropriate AppSidebar.tsx navigation group with permission: "page-id"
 *
 * The permission will automatically appear in the admin panel!
 */
export const AVAILABLE_PERMISSIONS = [
  { id: "dashboard", label: "Dashboard", description: "View dashboard and overview" },
  { id: "inventory", label: "Inventory", description: "Manage inventory and categories" },
  { id: "scan", label: "Scan", description: "Scan and process items" },
  { id: "personal-inventory", label: "Personal Inventory", description: "View and manage personal inventory" },
  { id: "transactions", label: "Transactions", description: "View transaction history" },
  { id: "delivery-challans", label: "Delivery Challans", description: "Create and manage delivery challans" },
  { id: "invoices", label: "Invoices", description: "Create and manage invoices" },
  { id: "sites", label: "Technical Details", description: "Manage site details and locations" },
  { id: "project-tracking", label: "Project Tracking", description: "Track and manage projects" },
  { id: "sla", label: "SLA", description: "Manage and track SLA projects and sub projects" },
  { id: "outreach-mill", label: "Outreach Mill", description: "Manage spinning mill contacts and outreach" },
  { id: "customer-data", label: "Customer Data", description: "Manage customer contacts and email campaigns" },
  { id: "complaints", label: "Complaints", description: "View and manage complaints & issues" },
  { id: "issue-reporting", label: "Issue Reporting", description: "View issue trends and reporting" },
  { id: "reports", label: "Reports", description: "View and generate reports" },
  { id: "survey-reports", label: "Survey Reports", description: "Create and view site survey reports" },
  { id: "settings", label: "Settings", description: "Configure company profile settings" },
  { id: "knowledge-base-upload", label: "Knowledge Base - Upload", description: "Upload and manage documents in knowledge base" },
  { id: "knowledge-base-delete", label: "Knowledge Base - Delete", description: "Delete documents from knowledge base" },
];

export const AVAILABLE_PERMISSION_GROUPS = [
  { title: "Dashboard", permissionIds: ["dashboard"] },
  { title: "Operations", permissionIds: ["inventory", "scan", "personal-inventory", "delivery-challans", "invoices"] },
  { title: "Projects & Services", permissionIds: ["project-tracking", "sla", "sites"] },
  { title: "Customers", permissionIds: ["customer-data", "outreach-mill", "survey-reports", "reports"] },
  { title: "Support", permissionIds: ["complaints", "issue-reporting", "knowledge-base-upload", "knowledge-base-delete"] },
  { title: "Transactions", permissionIds: ["transactions"] },
  { title: "Administration", permissionIds: ["settings"] },
].map(({ title, permissionIds }) => ({
  title,
  permissions: AVAILABLE_PERMISSIONS.filter((permission) => permissionIds.includes(permission.id)),
}));

export function getAllPermissions(): string[] {
  return AVAILABLE_PERMISSIONS.map((p) => p.id);
}

export function getPermissionLabel(permissionId: string): string {
  const permission = AVAILABLE_PERMISSIONS.find((p) => p.id === permissionId);
  return permission?.label || permissionId;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  isDisabled: boolean;
  permissions: string[]; // Array of page permissions (e.g., ['dashboard', 'inventory', 'delivery-challans'])
  createdAt: string;
  updatedAt: string;
}

const USERS_COLLECTION = "users";

export const usersAPI = {
  async getAll(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return [];
      }
      console.error("Error fetching users:", error);
      throw error;
    }
  },

  async getByEmail(email: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where("email", "==", email.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as User;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled (e.g., component unmounts)
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      console.error("Error fetching user by email:", error);
      throw error;
    }
  },

  async getById(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as User;
    } catch (error: any) {
      // Silently ignore AbortError - it's expected when queries are cancelled
      if (error.name === "AbortError" || error.code === "aborted") {
        return null;
      }
      console.error("Error fetching user by id:", error);
      throw error;
    }
  },

  async create(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    try {
      const docRef = doc(collection(db, USERS_COLLECTION));
      const userData = {
        ...user,
        email: user.email.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, userData);
      return {
        id: docRef.id,
        ...userData,
      } as User;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Omit<User, "id" | "createdAt">>): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  },

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      // Send password reset email to user
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      if (error.code === "auth/user-not-found") {
        throw new Error("User not found in the system.");
      }
      throw new Error(error.message || "Failed to send password reset email");
    }
  },

  async setTemporaryPassword(userId: string, email: string, newPassword: string): Promise<void> {
    try {
      // Validate password
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      // NOTE: Firebase Client SDK doesn't provide a direct way for one user to change another's password
      // This function serves as a placeholder for a backend implementation using Firebase Admin SDK
      // For now, we recommend using sendPasswordResetEmail instead

      console.warn(
        "Direct password setting requires Firebase Admin SDK on backend. " +
        "For client-side implementation, use sendPasswordResetEmail instead."
      );

      throw new Error(
        "For security reasons, use 'Send Password Reset Email' option instead. " +
        "User will receive an email to set their own password. " +
        "For direct password setting, implement this on your backend using Firebase Admin SDK."
      );
    } catch (error: any) {
      console.error("Error setting temporary password:", error);
      throw error;
    }
  },

  async createWithPassword(
    email: string,
    password: string,
    fullName: string,
    role: "admin" | "user" = "user",
    permissions: string[] = []
  ): Promise<User> {
    try {
      // Validate inputs
      if (!email || !password || !fullName) {
        throw new Error("Email, password, and full name are required.");
      }

      // Validate password
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      // Check if email already exists in Firestore
      try {
        const existingUser = await this.getByEmail(email);
        if (existingUser) {
          throw new Error("This email is already registered. Please use a different email.");
        }
      } catch (error: any) {
        // Silently ignore AbortError during email check
        if (error.name === "AbortError" || error.code === "aborted") {
          // Continue with creation - if email exists, auth creation will fail
        } else {
          throw error;
        }
      }

      // Create Firebase Auth user
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      } catch (authError: any) {
        if (authError.code === "auth/email-already-in-use") {
          throw new Error(
            "This email is already registered in the system. Please use a different email or contact the administrator."
          );
        } else if (authError.code === "auth/invalid-email") {
          throw new Error("Please enter a valid email address.");
        } else if (authError.code === "auth/weak-password") {
          throw new Error("Password is too weak. Please use a stronger password.");
        }
        throw authError;
      }

      // Create Firestore user record
      const docRef = doc(collection(db, USERS_COLLECTION));
      const userData = {
        email: email.toLowerCase(),
        fullName,
        role,
        isDisabled: false,
        permissions: role === "admin" ? getAllPermissions() : permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(docRef, userData);
      } catch (firestoreError: any) {
        // If Firestore fails, try to clean up the Auth user
        try {
          // Get the current user and delete them
          const user = auth.currentUser;
          if (user && user.email === email) {
            await user.delete();
          }
        } catch (deleteError) {
          console.error("Failed to clean up auth user:", deleteError);
        }
        throw new Error("Failed to create user record. Please try again.");
      }

      // Sign out the newly created user to prevent accidental login
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Warning: Failed to sign out new user", signOutError);
        // Don't throw - user was created successfully
      }

      return {
        id: docRef.id,
        ...userData,
      } as User;
    } catch (error: any) {
      console.error("Error creating user with password:", error);
      throw new Error(
        error.message || "Failed to create user. Please try again."
      );
    }
  },

  // Real-time listener for all users
  subscribeAll(
    callback: (users: User[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, USERS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as User[];
        callback(users);
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in users subscription:", error);
        onError?.(error as Error);
      }
    );
  },

  // Real-time listener for a single user
  subscribeById(
    id: string,
    callback: (user: User | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(db, USERS_COLLECTION, id);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as User);
        } else {
          callback(null);
        }
      },
      (error) => {
        if (handleFirestoreError(error)) return;
        console.error("Error in user subscription:", error);
        onError?.(error as Error);
      }
    );
  },
};
