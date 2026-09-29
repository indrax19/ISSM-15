import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFCMInitialize } from "@/hooks/useFCMInitialize";

const PROMPT_DISMISSED_KEY = "notification-prompt-dismissed";

export const NotificationPermissionPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const { requestNotificationPermission, isSupported, permissionState } =
    useFCMInitialize({
      autoRequest: false,
      onPermissionGranted: () => {
        setShowPrompt(false);
        setPromptDismissed(true);
      },
      onPermissionDenied: () => {
        setShowPrompt(false);
        setPromptDismissed(true);
      },
    });

  useEffect(() => {
    setPromptDismissed(window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "true");
  }, []);

  // Show prompt only if FCM is supported, permission hasn't been requested yet,
  // and the user hasn't already dismissed it.
  useEffect(() => {
    if (isSupported && permissionState === "default" && !promptDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);

      return () => clearTimeout(timer);
    }

    setShowPrompt(false);
  }, [isSupported, permissionState, promptDismissed]);

  const dismissPrompt = () => {
    setShowPrompt(false);
    setPromptDismissed(true);
    window.localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
  };

  if (!showPrompt || permissionState !== "default") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md animate-in slide-in-from-bottom-5 sm:w-auto">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
              Stay Updated
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Enable notifications to get instant updates about new issues and status changes.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                onClick={() => requestNotificationPermission()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Enable Notifications
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={dismissPrompt}
              >
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={dismissPrompt}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
