import { useEffect, useState, useRef } from "react";
import { messaging } from "@/integrations/firebase/config";
import {
  getToken,
  onMessage,
  isSupported as checkFCMSupport,
  Messaging,
} from "firebase/messaging";
import { deviceTokensAPI } from "@/integrations/firebase/deviceTokensAPI";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface FCMInitializeOptions {
  autoRequest?: boolean;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export const useFCMInitialize = (options: FCMInitializeOptions = {}) => {
  const { appUser } = useAuth();
  const [fcmInitialized, setFcmInitialized] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSupported, setIsSupported] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const { autoRequest = false, onPermissionGranted, onPermissionDenied } = options;

  // Check if FCM is supported
  useEffect(() => {
    checkFCMSupport().then((supported) => {
      setIsSupported(supported);
      if (!supported) {
        console.warn("Firebase Cloud Messaging is not supported in this browser");
      }
    });

    if (typeof Notification !== "undefined") {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!isSupported || !messaging) {
      console.warn("FCM not available");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === "granted") {
        console.log("Notification permission granted");
        await initializeFCMToken();
        onPermissionGranted?.();
        return true;
      } else {
        console.log("Notification permission denied");
        onPermissionDenied?.();
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      onPermissionDenied?.();
      return false;
    }
  };

  // Initialize FCM token and save to Firestore
  const initializeFCMToken = async () => {
    if (!messaging || !appUser) return;

    try {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
      });

      if (token) {
        setFcmToken(token);

        // Save token to Firestore
        if (appUser) {
          await deviceTokensAPI.saveDeviceToken(
            appUser.id,
            token,
            appUser.role,
            [], // Will be updated with actual site IDs if needed
            appUser.email,
            navigator.userAgent.substring(0, 100)
          );
        }

        setFcmInitialized(true);
      }
    } catch (error) {
      console.error("Error initializing FCM token:", error);
    }
  };

  // Setup foreground message handler
  useEffect(() => {
    if (!messaging || !fcmInitialized) return;

    // Handle foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[Foreground] Message received:", payload);

      const notificationTitle = payload.notification?.title || "New Notification";
      const notificationBody = payload.notification?.body || "";
      const issueId = payload.data?.issue_id;

      // Show in-app toast notification
      toast.success(notificationTitle, {
        description: notificationBody,
        duration: 5000,
        action: issueId
          ? {
              label: "View",
              onClick: () => {
                window.location.href = `/issues/${issueId}`;
              },
            }
          : undefined,
      });

      // Emit custom event that can be listened to by components
      window.dispatchEvent(
        new CustomEvent("fcmMessageReceived", {
          detail: payload,
        })
      );
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [fcmInitialized]);

  // Listen for notification clicks from service worker
  useEffect(() => {
    const handleNotificationClick = (event: any) => {
      const { issue_id: issueId, click_action: clickAction } = event.data;
      if (issueId && clickAction === "open_issue") {
        window.location.href = `/issues/${issueId}`;
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleNotificationClick);
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleNotificationClick);
      }
    };
  }, []);

  // Auto-request permission if option is set and permission is default
  useEffect(() => {
    if (
      autoRequest &&
      isSupported &&
      permissionState === "default" &&
      Notification.permission === "default"
    ) {
      requestNotificationPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest, isSupported]);

  return {
    fcmInitialized,
    fcmToken,
    permissionState,
    isSupported,
    requestNotificationPermission,
    initializeFCMToken,
  };
};
