import { useState, useEffect, useRef } from 'react';
import { Unsubscribe } from 'firebase/firestore';
import { SslProject, sslProjectsAPI } from '@/integrations/firebase/sslProjectsAPI';
import { SslSubProject, sslSubProjectsAPI } from '@/integrations/firebase/sslSubProjectsAPI';
import { handleFirestoreError } from '@/integrations/firebase/utils';

export interface DataState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
}

/**
 * Hook for real-time parent projects subscription
 * Automatically handles subscription lifecycle and cleanup
 */
export function useRealtimeSslProjects(): DataState<SslProject[]> {
  const [projects, setProjects] = useState<SslProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setIsConnected(true);

    try {
      // Use real-time listener if available, otherwise fall back to fetch
      if (sslProjectsAPI.subscribeAll) {
        unsubscribeRef.current = sslProjectsAPI.subscribeAll(
          (data) => {
            setProjects(data);
            setIsLoading(false);
            setIsConnected(true);
          },
          (err) => {
            if (handleFirestoreError(err)) {
              setIsLoading(false);
              return;
            }
            console.error('Error fetching projects:', err);
            setError(err);
            setIsConnected(false);
            setIsLoading(false);
          }
        );
      } else {
        // Fallback to traditional fetch if real-time not available
        sslProjectsAPI.getAllWithCounts().then((data) => {
          setProjects(data);
          setIsLoading(false);
          setIsConnected(true);
        }).catch((err) => {
          if (handleFirestoreError(err)) {
            setIsLoading(false);
            return;
          }
          setError(err);
          setIsConnected(false);
          setIsLoading(false);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnected(false);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return { data: projects, isLoading, error, isConnected };
}

/**
 * Hook for real-time single project subscription
 */
export function useRealtimeSslProject(projectId: string | undefined): DataState<SslProject | null> {
  const [project, setProject] = useState<SslProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsConnected(true);

    try {
      if (sslProjectsAPI.subscribeById) {
        unsubscribeRef.current = sslProjectsAPI.subscribeById(
          projectId,
          (data) => {
            setProject(data);
            setIsLoading(false);
            setIsConnected(true);
          },
          (err) => {
            if (handleFirestoreError(err)) {
              setIsLoading(false);
              return;
            }
            console.error('Error fetching project:', err);
            setError(err);
            setIsConnected(false);
            setIsLoading(false);
          }
        );
      } else {
        // Fallback
        sslProjectsAPI.getById(projectId).then((data) => {
          setProject(data);
          setIsLoading(false);
          setIsConnected(true);
        }).catch((err) => {
          if (handleFirestoreError(err)) {
            setIsLoading(false);
            return;
          }
          setError(err);
          setIsConnected(false);
          setIsLoading(false);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnected(false);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [projectId]);

  return { data: project, isLoading, error, isConnected };
}

/**
 * Hook for real-time sites subscription by project ID
 * Optimized with efficient Firestore queries
 */
export function useRealtimeSslSubProjects(projectId: string | undefined): DataState<SslSubProject[]> {
  const [sites, setSites] = useState<SslSubProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!projectId) {
      setSites([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsConnected(true);

    try {
      // Use real-time listener for efficient updates
      if (sslSubProjectsAPI.subscribeByProject) {
        unsubscribeRef.current = sslSubProjectsAPI.subscribeByProject(
          projectId,
          (data) => {
            setSites(data);
            setIsLoading(false);
            setIsConnected(true);
          },
          (err) => {
            if (handleFirestoreError(err)) {
              setIsLoading(false);
              return;
            }
            console.error('Error fetching sites:', err);
            setError(err);
            setIsConnected(false);
            setIsLoading(false);
          }
        );
      } else {
        // Fallback to traditional fetch
        sslSubProjectsAPI.getByProject(projectId).then((data) => {
          setSites(data);
          setIsLoading(false);
          setIsConnected(true);
        }).catch((err) => {
          if (handleFirestoreError(err)) {
            setIsLoading(false);
            return;
          }
          setError(err);
          setIsConnected(false);
          setIsLoading(false);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnected(false);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [projectId]);

  return { data: sites, isLoading, error, isConnected };
}

/**
 * Hook for real-time single site subscription
 */
export function useRealtimeSslSubProject(siteId: string | undefined): DataState<SslSubProject | null> {
  const [site, setSite] = useState<SslSubProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!siteId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsConnected(true);

    try {
      if (sslSubProjectsAPI.subscribeSite) {
        unsubscribeRef.current = sslSubProjectsAPI.subscribeSite(
          siteId,
          (data) => {
            setSite(data);
            setIsLoading(false);
            setIsConnected(true);
          },
          (err) => {
            if (handleFirestoreError(err)) {
              setIsLoading(false);
              return;
            }
            console.error('Error fetching site:', err);
            setError(err);
            setIsConnected(false);
            setIsLoading(false);
          }
        );
      } else {
        // Fallback
        sslSubProjectsAPI.getById(siteId).then((data) => {
          setSite(data);
          setIsLoading(false);
          setIsConnected(true);
        }).catch((err) => {
          if (handleFirestoreError(err)) {
            setIsLoading(false);
            return;
          }
          setError(err);
          setIsConnected(false);
          setIsLoading(false);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnected(false);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [siteId]);

  return { data: site, isLoading, error, isConnected };
}
