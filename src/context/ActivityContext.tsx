import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { realtimeProjectTrackingAPI } from '@/integrations/firebase/realtimeAPI';

export interface ActivityItem {
  id: string;
  type: 'new_site' | 'updated_site';
  projectId: string;
  projectName: string;
  siteName: string;
  siteId: string;
  userName: string;
  timestamp: Date;
  isRead: boolean;
}

interface ActivityContextType {
  activities: ActivityItem[];
  unreadCount: number;
  newSiteIds: Set<string>;
  markAsRead: (activityId: string) => void;
  markAllAsRead: () => void;
  clearNewBadge: (siteId: string) => void;
  subscribeToProject: (projectId: string, projectName: string) => void;
  unsubscribeFromProject: (projectId: string) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [newSiteIds, setNewSiteIds] = useState<Set<string>>(new Set());
  const [subscriptions, setSubscriptions] = useState<Map<string, () => void>>(new Map());
  const activitiesRef = useRef<ActivityItem[]>([]);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  useEffect(() => {
    subscriptionsRef.current = subscriptions;
  }, [subscriptions]);

  const unreadCount = useMemo(() => activities.filter((a) => !a.isRead).length, [activities]);

  const markAsRead = useCallback((activityId: string) => {
    setActivities((prev) => {
      const next = prev.map((a) => (a.id === activityId ? { ...a, isRead: true } : a));
      activitiesRef.current = next;
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setActivities((prev) => {
      const next = prev.map((a) => ({ ...a, isRead: true }));
      activitiesRef.current = next;
      return next;
    });
  }, []);

  const clearNewBadge = useCallback((siteId: string) => {
    setNewSiteIds((prev) => {
      const updated = new Set(prev);
      updated.delete(siteId);
      return updated;
    });
  }, []);

  const subscribeToProject = useCallback((projectId: string, projectName: string) => {
    // Prevent duplicate subscriptions
    if (subscriptionsRef.current.has(projectId)) {
      return;
    }

    // Use real-time listener instead of polling
    const unsubscribe = realtimeProjectTrackingAPI.subscribeByProject(projectId, (sites) => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      sites.forEach(site => {
        if (site.updated_at) {
          const updatedDate = new Date(site.updated_at);
          if (updatedDate > fiveMinutesAgo) {
            // Check if this is a new activity
            const existingActivity = activitiesRef.current.find(
              (a) => a.siteId === site.id && a.projectId === projectId
            );

            if (!existingActivity) {
              const newActivity: ActivityItem = {
                id: `${site.id}-${updatedDate.getTime()}`,
                type: updatedDate > new Date(now.getTime() - 1 * 60 * 1000) ? 'new_site' : 'updated_site',
                projectId,
                projectName,
                siteName: site.millName || 'Unknown Site',
                siteId: site.id,
                userName: 'User', // This would come from the user who made the change
                timestamp: updatedDate,
                isRead: false,
              };

              setActivities((prev) => {
                const next = [newActivity, ...prev].slice(0, 50);
                activitiesRef.current = next;
                return next;
              });
              setNewSiteIds((prev) => new Set(prev).add(site.id));
            }
          }
        }
      });
    });

    setSubscriptions((prev) => {
      const next = new Map(prev).set(projectId, unsubscribe);
      subscriptionsRef.current = next;
      return next;
    });

    return unsubscribe;
  }, []);

  const unsubscribeFromProject = useCallback((projectId: string) => {
    const unsubscribe = subscriptionsRef.current.get(projectId);
    if (unsubscribe) {
      unsubscribe();
      setSubscriptions((prev) => {
        const next = new Map(prev);
        next.delete(projectId);
        subscriptionsRef.current = next;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup all subscriptions on unmount
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const value = useMemo(
    () => ({
      activities,
      unreadCount,
      newSiteIds,
      markAsRead,
      markAllAsRead,
      clearNewBadge,
      subscribeToProject,
      unsubscribeFromProject,
    }),
    [activities, unreadCount, newSiteIds, markAsRead, markAllAsRead, clearNewBadge, subscribeToProject, unsubscribeFromProject]
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
};

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within ActivityProvider');
  }
  return context;
};
