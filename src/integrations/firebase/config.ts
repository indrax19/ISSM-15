import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";

// Your web app's Firebase configuration
// All values must be provided via environment variables
if (!import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  throw new Error("Firebase configuration is incomplete. Please set the required environment variables.");
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with memory cache only (better for network-restricted environments)
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
let messaging: Messaging | null = null;

try {
  if ('serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase Cloud Messaging not available:', error);
}

export { messaging };
