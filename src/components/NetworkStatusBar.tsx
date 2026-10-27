import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Component that displays a warning bar when the network connection is lost
 */
export function NetworkStatusBar() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm border-b border-amber-600 py-2 px-4">
      <div className="flex items-center justify-center gap-2 text-white text-sm font-medium">
        <WifiOff className="h-4 w-4" />
        <span>No internet connection - Some features may not work. Please check your network.</span>
      </div>
    </div>
  );
}
