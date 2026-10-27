import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Bell, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/context/ActivityContext';
import { useAuth } from '@/context/AuthContext';
import { notificationsAPI, type Notification } from '@/integrations/firebase/notificationsAPI';
import { useUnresolvedComplaintsCount } from '@/hooks/useUnresolvedComplaintsCount';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';

interface CombinedNotification {
  id: string;
  type: 'activity' | 'issue';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  icon: 'activity' | 'issue_created' | 'issue_resolved' | 'issue_updated';
}

export function NotificationBell() {
  const { activities, unreadCount, markAsRead, markAllAsRead } = useActivity();
  const { appUser, hasPermission } = useAuth();
  const [issueNotifications, setIssueNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const hasLoadedIssueNotificationsRef = useRef(false);
  const shownIssueToastIdsRef = useRef<Set<string>>(new Set());
  const unresolvedComplaintsCount = useUnresolvedComplaintsCount();
  const canViewComplaints = hasPermission('complaints');

  // Subscribe to issue notifications for the current user
  useEffect(() => {
    if (!appUser?.id) return;

    unsubscribeRef.current = notificationsAPI.subscribeToUserNotifications(
      appUser.id,
      (notifications) => {
        setIssueNotifications(notifications);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [appUser?.id]);

  useEffect(() => {
    const activeNotificationIds = new Set(
      issueNotifications.map((notification) => notification.id).filter(Boolean) as string[]
    );

    shownIssueToastIdsRef.current.forEach((notificationId) => {
      if (!activeNotificationIds.has(notificationId)) {
        shownIssueToastIdsRef.current.delete(notificationId);
      }
    });

    if (!hasLoadedIssueNotificationsRef.current) {
      activeNotificationIds.forEach((notificationId) => {
        shownIssueToastIdsRef.current.add(notificationId);
      });
      hasLoadedIssueNotificationsRef.current = true;
      return;
    }

    issueNotifications.forEach((notification) => {
      if (!notification.id || notification.isRead || shownIssueToastIdsRef.current.has(notification.id)) {
        return;
      }

      shownIssueToastIdsRef.current.add(notification.id);

      if (notification.createdBy && notification.createdBy === appUser?.name) {
        return;
      }

      if (notification.type === 'issue_resolved') {
        toast.success(notification.title, {
          description: notification.message,
        });
        return;
      }

      toast(notification.title, {
        description: notification.message,
      });
    });
  }, [issueNotifications, appUser?.name]);

  // Combine activity and issue notifications
  const combinedNotifications: CombinedNotification[] = [
    ...activities.map((a) => ({
      id: a.id,
      type: 'activity' as const,
      title: a.type === 'new_site' ? 'New Site Added' : 'Site Updated',
      message:
        a.type === 'new_site'
          ? `New site added: ${a.siteName}`
          : `Site updated: ${a.siteName}`,
      timestamp: a.timestamp,
      isRead: a.isRead,
      icon: 'activity' as const,
    })),
    ...issueNotifications.map((n) => ({
      id: n.id || '',
      type: 'issue' as const,
      title: n.title,
      message: n.message,
      timestamp: new Date(n.createdAt),
      isRead: n.isRead,
      icon: n.type as 'issue_created' | 'issue_resolved' | 'issue_updated',
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const recentNotifications = combinedNotifications.slice(0, 5);
  const complaintsBadgeCount = canViewComplaints ? unresolvedComplaintsCount : 0;
  const totalUnread = unreadCount + issueNotifications.filter((n) => !n.isRead).length + complaintsBadgeCount;

  const handleMarkAsRead = async (notification: CombinedNotification) => {
    if (notification.type === 'activity') {
      markAsRead(notification.id);
    } else if (notification.type === 'issue') {
      try {
        await notificationsAPI.markAsRead(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    if (appUser?.id) {
      try {
        await notificationsAPI.markAllAsRead(appUser.id);
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
      }
    }
  };

  const getNotificationIcon = (icon: CombinedNotification['icon']) => {
    if (icon === 'issue_created') {
      return <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />;
    } else if (icon === 'issue_resolved') {
      return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (icon === 'issue_updated') {
      return <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
    return null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 h-auto w-auto"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {totalUnread > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto p-0"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {recentNotifications.length > 0 ? (
            recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`border-b p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                  !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                }`}
                onClick={() => handleMarkAsRead(notification)}
              >
                <div className="flex items-start gap-3">
                  {notification.type === 'issue' && (
                    getNotificationIcon(notification.icon)
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(notification.timestamp, 'MMM d, HH:mm')}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
