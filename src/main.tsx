import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress AbortError from Firebase Firestore - it's expected behavior
window.addEventListener("error", (event) => {
  if (
    event.error?.name === "AbortError" ||
    event.error?.message?.includes("aborted") ||
    event.error?.message?.includes("signal is aborted") ||
    event.error?.code === "aborted"
  ) {
    event.preventDefault();
  }
});

// Also suppress unhandled promise rejections from AbortError
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.name === "AbortError" ||
    event.reason?.message?.includes("aborted") ||
    event.reason?.message?.includes("signal is aborted") ||
    event.reason?.code === "aborted"
  ) {
    event.preventDefault();
  }
});

// Register Service Worker for Firebase Cloud Messaging (Push Notifications)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js")
    .then((registration) => {
      console.log("Service Worker registered successfully:", registration);
    })
    .catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
