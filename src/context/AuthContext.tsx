import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { usersAPI, User } from "@/integrations/firebase/usersAPI";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean; // Check if user has a specific permission
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      setFirebaseUser(user);
      if (user) {
        try {
          const userData = await usersAPI.getByEmail(user.email || "");
          // Only update state if component is still mounted
          if (mounted && userData) {
            setAppUser(userData);
          }
        } catch (error: any) {
          // Silently ignore AbortError - it happens when component unmounts during async operation
          if (error.name !== "AbortError" && error.code !== "aborted") {
            console.error("Error fetching user data:", error);
            // Log network errors for debugging
            if (error.message?.includes("Could not reach") || error.code === "unavailable") {
              console.warn("Firebase connection issue detected");
            }
          }
        }
      } else {
        if (mounted) {
          setAppUser(null);
        }
      }
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Retry logic for network errors
    let lastError: any;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Login attempt ${attempt}/${maxRetries}`);
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userData = await usersAPI.getByEmail(result.user.email || "");
        if (userData && userData.isDisabled) {
          await signOut(auth);
          throw new Error("Your account has been disabled");
        }
        if (userData) {
          setAppUser(userData);
          return userData.fullName;
        }
        return null;
      } catch (error: any) {
        lastError = error;
        console.error(`Login attempt ${attempt} failed:`, error.code || error.message);

        // Don't retry on auth errors (wrong password, user not found, etc)
        if (error.code && !error.code.includes("network") && error.message !== "Your account has been disabled") {
          throw error;
        }

        // Wait before retrying on network errors
        if (attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    throw lastError || new Error("Login failed after multiple attempts");
  }, [setAppUser]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setAppUser(null);
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    // Admins have all permissions
    if (appUser?.role === "admin") return true;
    // Check if user has the specific permission
    return appUser?.permissions?.includes(permission) || false;
  }, [appUser]);

  const value: AuthContextType = useMemo(() => ({
    firebaseUser,
    appUser,
    loading,
    login,
    logout,
    isAuthenticated: !!firebaseUser && !!appUser,
    isAdmin: appUser?.role === "admin",
    hasPermission,
  }), [firebaseUser, appUser, loading, login, logout, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
