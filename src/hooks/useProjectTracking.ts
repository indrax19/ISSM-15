import { useState, useEffect, useRef } from 'react';
import { Unsubscribe } from 'firebase/firestore';
import { ParentProject, parentProjectsAPI } from '@/integrations/firebase/parentProjectsAPI';
import { ProjectTracking, projectTrackingAPI } from '@/integrations/firebase/projectTrackingAPI';
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
export function useRealtimeProjects(): DataState<ParentProject[]> {
  const [projects, setProjects] = useState<ParentProject[]>([]);
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
      if (parentProjectsAPI.subscribeAll) {
        unsubscribeRef.current = parentProjectsAPI.subscribeAll(
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
        parentProjectsAPI.getAllWithCounts().then((data) => {
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
export function useRealtimeProject(projectId: string | undefined): DataState<ParentProject | null> {
  const [project, setProject] = useState<ParentProject | null>(null);
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
      if (parentProjectsAPI.subscribeById) {
        unsubscribeRef.current = parentProjectsAPI.subscribeById(
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
        parentProjectsAPI.getById(projectId).then((data) => {
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
export function useRealtimeSites(projectId: string | undefined): DataState<ProjectTracking[]> {
  const [sites, setSites] = useState<ProjectTracking[]>([]);
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
      if (projectTrackingAPI.subscribeByProject) {
        unsubscribeRef.current = projectTrackingAPI.subscribeByProject(
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
        projectTrackingAPI.getByProject(projectId).then((data) => {
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
export function useRealtimeSite(siteId: string | undefined): DataState<ProjectTracking | null> {
  const [site, setSite] = useState<ProjectTracking | null>(null);
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
      if (projectTrackingAPI.subscribeSite) {
        unsubscribeRef.current = projectTrackingAPI.subscribeSite(
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
        projectTrackingAPI.getById(siteId).then((data) => {
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
