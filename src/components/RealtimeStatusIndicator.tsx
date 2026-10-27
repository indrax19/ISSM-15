import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

interface RealtimeStatusProps {
  isConnected: boolean;
  error: Error | null;
  isLoading: boolean;
  successMessage?: string;
}

/**
 * Component to display real-time connection status, errors, and loading states
 * Optimized for mobile and web with clear visual feedback
 */
export function RealtimeStatusIndicator({
  isConnected,
  error,
  isLoading,
  successMessage,
}: RealtimeStatusProps) {
  // Show nothing if everything is working fine
  if (isConnected && !error && !isLoading && !successMessage) {
    return null;
  }

  // Show connection error
  if (!isConnected && !error) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
        <CardContent className="pt-6 flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-700 flex-shrink-0" />
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Reconnecting to database... Your changes will sync when connection is restored.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show error
  if (error) {
    const errorMessage = error.message || "An unexpected error occurred";
    const isNetworkError =
      errorMessage.includes("unavailable") ||
      errorMessage.includes("offline") ||
      errorMessage.includes("network");

    return (
      <Card className={`border-red-200 bg-red-50 dark:bg-red-950`}>
        <CardContent className="pt-6 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-700 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              {isNetworkError ? "Connection Error" : "Error Loading Data"}
            </p>
            <p className="text-xs text-red-800 dark:text-red-200 mt-1">
              {isNetworkError
                ? "Unable to connect. Check your internet connection."
                : errorMessage}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show success message
  if (successMessage) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950">
        <CardContent className="pt-6 flex items-center gap-2">
          <Wifi className="h-4 w-4 text-green-700" />
          <p className="text-sm text-green-900 dark:text-green-100">{successMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return null;
}

/**
 * Loading skeleton for large data sections
 */
export function DataLoadingSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
        <div className="h-20 w-full bg-muted animate-pulse rounded"></div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 w-full bg-muted animate-pulse rounded"></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Connection status badge for header
 */
export function ConnectionBadge({ isConnected }: { isConnected: boolean }) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900">
        <WifiOff className="h-3 w-3 text-amber-700" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-200">Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900">
      <Wifi className="h-3 w-3 text-green-700" />
      <span className="text-xs font-medium text-green-700 dark:text-green-200">Live</span>
    </div>
  );
}
