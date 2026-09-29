import { useState, useEffect, useRef } from 'react';
import { Issue, issuesAPI } from '@/integrations/firebase/issuesAPI';

export interface IssueWithDuration extends Issue {
  duration?: string; // Formatted duration (e.g., "1h 30m" or "45m")
  durationMs?: number; // Duration in milliseconds
}

export interface UseIssuesState {
  issues: IssueWithDuration[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Calculates the formatted duration between two timestamps
 * @param startTime ISO timestamp string
 * @param endTime ISO timestamp string (optional, defaults to now if issue is open)
 * @returns Formatted duration string (e.g., "1h 30m")
 */
function calculateDuration(startTime: string, endTime?: string): { formatted: string; ms: number } {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const diffMs = end.getTime() - start.getTime();

  // Convert to hours and minutes
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return {
    formatted: parts.length > 0 ? parts.join(' ') : '0m',
    ms: diffMs,
  };
}

/**
 * Hook for subscribing to issues for a specific site with duration tracking
 * Automatically updates durations for open issues every minute
 * @param siteId - The site ID to fetch issues for (if empty, returns empty issues)
 * @returns Object containing issues with durations, loading state, and error
 */
export function useIssuesBySite(siteId: string): UseIssuesState {
  const [issues, setIssues] = useState<IssueWithDuration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<NodeJS.Timer | null>(null);

  const addDurations = (issuesList: Issue[]): IssueWithDuration[] => {
    return issuesList.map((issue) => {
      const endTime = issue.resolvedTime;
      const { formatted, ms } = calculateDuration(issue.createdTime, endTime);
      return {
        ...issue,
        duration: formatted,
        durationMs: ms,
      };
    });
  };

  useEffect(() => {
    // If siteId is empty, don't subscribe to anything
    if (!siteId || siteId.trim() === "") {
      setIssues([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Subscribe to issues for this site
      unsubscribeRef.current = issuesAPI.subscribeBySiteId(
        siteId,
        (fetchedIssues) => {
          const issuesWithDurations = addDurations(fetchedIssues);
          setIssues(issuesWithDurations);
          setIsLoading(false);
        },
        (err) => {
          setError(err);
          setIsLoading(false);
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
    }

    // Set up interval to update durations for open issues (every 60 seconds)
    timerRef.current = setInterval(() => {
      setIssues((prevIssues) => addDurations(prevIssues));
    }, 60000); // Update every 60 seconds

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [siteId]);

  return { issues, isLoading, error };
}

/**
 * Hook for subscribing to issues for a specific project (all sites)
 * @param projectId - Not directly used, but kept for consistency
 * @returns Object containing all issues, loading state, and error
 */
export function useAllIssues(): UseIssuesState {
  const [issues, setIssues] = useState<IssueWithDuration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<NodeJS.Timer | null>(null);

  const addDurations = (issuesList: Issue[]): IssueWithDuration[] => {
    return issuesList.map((issue) => {
      const endTime = issue.resolvedTime;
      const { formatted, ms } = calculateDuration(issue.createdTime, endTime);
      return {
        ...issue,
        duration: formatted,
        durationMs: ms,
      };
    });
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    try {
      // Subscribe to all issues
      unsubscribeRef.current = issuesAPI.subscribeAll(
        (fetchedIssues) => {
          const issuesWithDurations = addDurations(fetchedIssues);
          setIssues(issuesWithDurations);
          setIsLoading(false);
        },
        (err) => {
          setError(err);
          setIsLoading(false);
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
    }

    // Set up interval to update durations for open issues
    timerRef.current = setInterval(() => {
      setIssues((prevIssues) => addDurations(prevIssues));
    }, 60000); // Update every 60 seconds

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { issues, isLoading, error };
}
