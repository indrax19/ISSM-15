import { useEffect, useRef, useState } from 'react';
import { QueryKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { Unsubscribe } from 'firebase/firestore';
import { handleFirestoreError } from '@/integrations/firebase/utils';

interface RealtimeSubscriptionOptions {
  enabled?: boolean;
}

interface RealtimeSubscriptionState {
  isLoading: boolean;
  error: Error | null;
}

type RealtimeSubscribeFn<T> = (
  callback: (data: T) => void,
  onError?: (error: Error) => void
) => Unsubscribe;

/**
 * Custom hook that manages real-time Firestore subscriptions and automatically
 * updates React Query cache when data changes.
 */
export function useFirestoreRealtimeQuery<T>(
  queryKey: QueryKey,
  subscribeFn: RealtimeSubscribeFn<T>,
  options: RealtimeSubscriptionOptions = {}
): RealtimeSubscriptionState {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const { enabled = true } = options;
  const [isLoading, setIsLoading] = useState(() => enabled && queryClient.getQueryData(queryKey) === undefined);
  const [error, setError] = useState<Error | null>(null);
  const serializedKey = JSON.stringify(queryKey);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const cachedData = queryClient.getQueryData(queryKey);
    setIsLoading(cachedData === undefined);
    setError(null);

    try {
      unsubscribeRef.current = subscribeFn(
        (data) => {
          queryClient.setQueryData(queryKey, data);
          setIsLoading(false);
          setError(null);
        },
        (subscriptionError) => {
          if (handleFirestoreError(subscriptionError)) {
            setIsLoading(false);
            return;
          }
          setIsLoading(false);
          setError(subscriptionError);
          console.error('Failed to subscribe to real-time updates:', subscriptionError);
        }
      );
    } catch (subscriptionError) {
      if (handleFirestoreError(subscriptionError)) {
        setIsLoading(false);
        return;
      }

      const normalizedError = subscriptionError instanceof Error
        ? subscriptionError
        : new Error('Failed to subscribe to real-time updates');

      setIsLoading(false);
      setError(normalizedError);
      console.error('Failed to subscribe to real-time updates:', normalizedError);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, serializedKey, subscribeFn, queryClient]);

  return { isLoading, error };
}

interface RealtimeDataOptions<T> extends RealtimeSubscriptionOptions {
  queryKey: QueryKey;
  subscribeFn: RealtimeSubscribeFn<T>;
  initialData: T;
}

/**
 * Hook for subscribing to realtime data while reading the current value from
 * React Query cache.
 */
export function useFirestoreRealtimeData<T>({
  queryKey,
  subscribeFn,
  initialData,
  enabled = true,
}: RealtimeDataOptions<T>) {
  const subscriptionState = useFirestoreRealtimeQuery(queryKey, subscribeFn, { enabled });

  const query = useQuery<T>({
    queryKey,
    queryFn: async () => initialData,
    initialData,
    enabled: false,
    staleTime: Infinity,
  });

  return {
    data: query.data,
    isLoading: subscriptionState.isLoading,
    error: subscriptionState.error,
  };
}

/**
 * Hook for subscribing to single document real-time updates.
 */
export function useFirestoreRealtimeDoc<T>(
  queryKey: QueryKey,
  subscribeFn: RealtimeSubscribeFn<T | null>,
  options: RealtimeSubscriptionOptions = {}
): RealtimeSubscriptionState {
  return useFirestoreRealtimeQuery(queryKey, subscribeFn, options);
}
