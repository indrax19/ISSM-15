import { useState, useEffect } from 'react';

/**
 * Hook to detect network connectivity status
 * Returns true when online, false when offline
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Initialize with current network status
    return navigator.onLine;
  });

  useEffect(() => {
    // Handler for when connection is restored
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Network connection restored');
    };

    // Handler for when connection is lost
    const handleOffline = () => {
      setIsOnline(false);
      console.warn('Network connection lost - Firebase operations may fail');
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
