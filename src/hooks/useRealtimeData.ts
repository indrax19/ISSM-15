import { useState, useEffect, useRef, useCallback } from 'react';
import { Query, onSnapshot, Unsubscribe } from 'firebase/firestore';

export interface RealtimeDataState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook for subscribing to real-time Firestore data
 * Automatically manages subscription lifecycle and cleanup
 * @param query - Firestore query to listen to
 * @param mapFn - Optional function to transform snapshot data
 * @returns Object containing data, loading state, and error
 */
export function useRealtimeData<T>(
  query: Query | null,
  mapFn?: (docs: any[]) => T
): RealtimeDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      unsubscribeRef.current = onSnapshot(
        query,
        (snapshot) => {
          try {
            const docs = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            const transformedData = mapFn ? mapFn(docs) : (docs as T);
            setData(transformedData);
            setIsLoading(false);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            setIsLoading(false);
          }
        },
        (err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          setIsLoading(false);
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [query, mapFn]);

  return { data, isLoading, error };
}

/**
 * Hook for subscribing to a single Firestore document with real-time updates
 * @param docRef - Firestore document reference
 * @returns Object containing document data, loading state, and error
 */
export function useRealtimeDoc<T>(
  docRef: any | null
): RealtimeDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!docRef) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      unsubscribeRef.current = onSnapshot(
        docRef,
        (snapshot) => {
          try {
            if (snapshot.exists()) {
              const docData = {
                id: snapshot.id,
                ...snapshot.data(),
              };
              setData(docData as T);
              setIsLoading(false);
            } else {
              setData(null);
              setIsLoading(false);
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            setIsLoading(false);
          }
        },
        (err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          setIsLoading(false);
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [docRef]);

  return { data, isLoading, error };
}
