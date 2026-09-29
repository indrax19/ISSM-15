/**
 * Remove undefined values from an object before saving to Firestore
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/**
 * Handle Firestore errors with standard error messages
 * Returns true if error was handled (and should be suppressed), false otherwise
 */
export function handleFirestoreError(error: any): boolean {
  // Suppress abort errors (query cancelled due to unmount, etc)
  // This includes AbortError from signal cancellation
  if (
    error?.name === "AbortError" ||
    error?.code === "aborted" ||
    error?.message?.includes("abort") ||
    error?.message?.includes("signal is aborted") ||
    error?.message?.includes("without reason") // Catch "signal is aborted without reason"
  ) {
    // Silently suppress abort errors - these are expected cleanup operations
    return true;
  }
  if (error.code === "unavailable" || error.message?.includes("Could not reach Cloud Firestore")) {
    console.warn("Firebase connection unavailable - app may be offline", error);
    return true;
  }
  // Handle missing composite index errors
  if (error.message?.includes("The query requires an index")) {
    console.error(
      "Firestore composite index is missing. Please create the required index in Firebase Console:",
      error.message
    );
    // Still allow the error to propagate so UI can handle it
    return false;
  }
  // Handle network fetch errors - suppress temporarily but allow retry
  if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
    console.warn("Network error connecting to Firebase", error);
    // Suppress this error - Firestore will retry automatically
    return true;
  }
  return false;
}

/**
 * Check if network is available
 */
export function isNetworkAvailable(): boolean {
  return navigator.onLine;
}

/**
 * Wait for network connection with timeout
 */
export async function waitForNetwork(timeoutMs: number = 5000): Promise<boolean> {
  if (navigator.onLine) return true;

  return new Promise((resolve) => {
    const handleOnline = () => {
      window.removeEventListener("online", handleOnline);
      clearTimeout(timeoutId);
      resolve(true);
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener("online", handleOnline);
      resolve(false);
    }, timeoutMs);

    window.addEventListener("online", handleOnline);
  });
}
