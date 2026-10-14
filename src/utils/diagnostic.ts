import { signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { usersAPI } from "@/integrations/firebase/usersAPI";

/**
 * Diagnostic function to check if admin account exists and status
 * WARNING: This function should only be called from secure admin contexts
 * @param email Admin email to check
 * @param testPassword Password to test (optional)
 */
export async function diagnosisCheckAdmin(email: string, testPassword?: string) {
  try {
    console.log("Checking admin account status for:", email);

    // Check Firestore
    console.log("1. Checking Firestore...");
    const firestoreUser = await usersAPI.getByEmail(email);
    console.log("   Firestore result:", firestoreUser);

    // Check Firebase Auth
    console.log("2. Checking Firebase Auth...");
    if (!testPassword) {
      return {
        status: "NEEDS_PASSWORD",
        message: "Provide a password parameter to test authentication",
        firestoreExists: !!firestoreUser,
      };
    }

    try {
      // Try to sign in
      await signInWithEmailAndPassword(auth, email, testPassword);
      console.log("   ✓ Can sign in with provided credentials");

      // Sign out immediately
      await signOut(auth);

      return {
        status: "ADMIN_EXISTS",
        message: "Admin account is properly set up.",
        firestoreExists: !!firestoreUser,
        authExists: true,
      };
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        console.log("   ✗ Email not found in Firebase Auth");
        return {
          status: "NOT_IN_AUTH",
          message: "Email not found in Firebase Auth. Admin needs to be created.",
          firestoreExists: !!firestoreUser,
          authExists: false,
        };
      } else if (authError.code === "auth/wrong-password") {
        console.log("   ✗ Wrong password in Firebase Auth");
        return {
          status: "WRONG_PASSWORD",
          message: "Admin account exists but password is incorrect.",
          firestoreExists: !!firestoreUser,
          authExists: true,
        };
      } else {
        throw authError;
      }
    }
  } catch (error: any) {
    console.error("Diagnosis error:", error);
    return {
      status: "ERROR",
      message: error.message,
      error,
    };
  }
}

/**
 * Reset admin password if admin account exists
 * WARNING: This should only be called from secure admin contexts
 * @param email Admin email
 * @param currentPassword Current password
 * @param newPassword New password
 */
export async function resetAdminPassword(
  email: string,
  currentPassword: string,
  newPassword: string
) {
  try {
    console.log("Attempting to reset admin password...");

    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Try to sign in with old password
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      currentPassword
    );

    // Update password
    await updatePassword(userCredential.user, newPassword);

    // Sign out
    await signOut(auth);

    console.log("✓ Password reset successfully!");
    return {
      success: true,
      message: "Admin password reset successfully",
    };
  } catch (error: any) {
    console.error("Password reset error:", error);
    return {
      success: false,
      message: error.message,
      error,
    };
  }
}

/**
 * Clean up function - removes admin from Firestore only
 * WARNING: This does NOT delete the Firebase Auth user
 * @param email Admin email to remove
 */
export async function cleanupAdminFromFirestore(email: string) {
  try {
    console.log("Cleaning up admin from Firestore...");

    const user = await usersAPI.getByEmail(email);

    if (user) {
      await usersAPI.delete(user.id);
      console.log("✓ Admin user removed from Firestore");
      return {
        success: true,
        message: "Admin removed from Firestore database",
      };
    } else {
      return {
        success: false,
        message: "Admin user not found in Firestore",
      };
    }
  } catch (error: any) {
    console.error("Cleanup error:", error);
    return {
      success: false,
      message: error.message,
      error,
    };
  }
}
