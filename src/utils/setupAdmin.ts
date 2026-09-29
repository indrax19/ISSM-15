import {
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { usersAPI, getAllPermissions } from "@/integrations/firebase/usersAPI";

/**
 * Creates the admin user in Firebase Authentication and Firestore
 * Call this function once during app setup
 *
 * Usage in browser console:
 * import { setupAdmin } from '@/utils/setupAdmin'
 * await setupAdmin('umair@aviratechnologies.com', '123456', 'Umair')
 */
export async function setupAdmin(
  email: string,
  password: string,
  fullName: string
) {
  try {
    console.log("Creating admin user...");

    // Check if admin already exists in Firestore
    const existingFirestoreUser = await usersAPI.getByEmail(email);
    if (existingFirestoreUser) {
      console.log("Admin already exists in Firestore:", existingFirestoreUser);
      return {
        success: true,
        message: "Admin user already exists. You can login with the credentials.",
        user: existingFirestoreUser,
        alreadyExists: true,
      };
    }

    // Create Firebase Auth user
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Firebase Auth user created:", userCredential.user.uid);
    } catch (authError: any) {
      if (authError.code === "auth/email-already-in-use") {
        console.log("Email already exists in Firebase Auth");

        // Try to create only the Firestore record if Auth user exists
        try {
          const adminUser = await usersAPI.create({
            email,
            fullName,
            role: "admin",
            isDisabled: false,
            permissions: getAllPermissions(),
          });
          console.log("Firestore user record created for existing Auth user");
          return {
            success: true,
            message: "Admin user setup completed. Auth user already existed.",
            user: adminUser,
            authUserPreExisted: true,
          };
        } catch (firestoreError) {
          // If Firestore also fails, still return success but note the situation
          return {
            success: true,
            message:
              "Admin email already registered. You can login with these credentials.",
            alreadyExists: true,
            authUserPreExisted: true,
          };
        }
      }
      throw authError;
    }

    // Create Firestore user record
    const adminUser = await usersAPI.create({
      email,
      fullName,
      role: "admin",
      isDisabled: false,
      permissions: getAllPermissions(),
    });
    console.log("Firestore user record created:", adminUser);

    // Sign out after creation
    await signOut(auth);
    console.log("Admin user setup complete!");

    return {
      success: true,
      message: "Admin user created successfully. You can now login with the provided credentials.",
      user: adminUser,
    };
  } catch (error: any) {
    console.error("Error setting up admin user:", error);

    // Try to clean up if Firebase user was created but Firestore failed
    try {
      await signOut(auth);
    } catch (e) {
      // Ignore cleanup errors
    }

    return {
      success: false,
      message: error.message || "Failed to set up admin user",
      error,
    };
  }
}

/**
 * Helper function to verify admin user exists
 */
export async function verifyAdminExists(email: string) {
  try {
    const user = await usersAPI.getByEmail(email);
    return {
      exists: !!user,
      isAdmin: user?.role === "admin",
      user,
    };
  } catch (error) {
    console.error("Error checking admin:", error);
    return {
      exists: false,
      isAdmin: false,
      error,
    };
  }
}
