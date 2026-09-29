import { useEffect, useState } from 'react';
import { complaintsAPI } from '@/integrations/firebase/complaintsAPI';
import { useAuth } from '@/context/AuthContext';

export function useUnresolvedComplaintsCount() {
  const [count, setCount] = useState(0);
  const { appUser } = useAuth();

  useEffect(() => {
    const unsubscribe = complaintsAPI.subscribeAll((complaints) => {
      const unresolvedCount = complaints.filter(
        (c) => c.status !== 'Resolved'
      ).length;
      setCount(unresolvedCount);
    });

    return () => unsubscribe();
  }, []);

  return count;
}
