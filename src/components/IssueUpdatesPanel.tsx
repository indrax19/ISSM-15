import { useEffect, useState } from "react";
import { MessageSquare, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { issueUpdatesAPI, IssueUpdate } from "@/integrations/firebase/issueUpdatesAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IssueUpdatesPanelProps {
  issueId: string;
  isOpen?: boolean;
}

const UPDATE_TYPE_COLORS: Record<string, string> = {
  status_update: "bg-blue-100 text-blue-800 border-blue-300",
  work_progress: "bg-green-100 text-green-800 border-green-300",
  note: "bg-yellow-100 text-yellow-800 border-yellow-300",
  internal_comment: "bg-purple-100 text-purple-800 border-purple-300",
};

const UPDATE_TYPE_LABELS: Record<string, string> = {
  status_update: "Status Update",
  work_progress: "Work Progress",
  note: "Note",
  internal_comment: "Internal Comment",
};

export default function IssueUpdatesPanel({ issueId, isOpen = true }: IssueUpdatesPanelProps) {
  const [updates, setUpdates] = useState<IssueUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!isOpen || !issueId) {
      setUpdates([]);
      return;
    }

    setIsLoading(true);

    const unsub = issueUpdatesAPI.subscribeToIssueUpdates(
      issueId,
      (data) => {
        setUpdates(data);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error loading updates:", error);
        setIsLoading(false);
      }
    );

    setUnsubscribe(() => unsub);

    return () => {
      unsub();
    };
  }, [issueId, isOpen]);

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (updates.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No updates yet</p>
            <p className="text-xs text-gray-400">Add updates to track progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          Updates ({updates.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {updates.map((update) => (
            <div
              key={update.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              {/* Header with type and time */}
              <div className="flex items-start justify-between mb-2">
                <Badge
                  className={`${UPDATE_TYPE_COLORS[update.updateType] || "bg-gray-100"} border`}
                  variant="outline"
                >
                  {UPDATE_TYPE_LABELS[update.updateType] || update.updateType}
                </Badge>
                <span className="text-xs text-gray-500">
                  {format(new Date(update.createdAt), "MMM dd, HH:mm")}
                </span>
              </div>

              {/* Message */}
              <p className="text-sm text-gray-800 mb-2 leading-relaxed">
                {update.message}
              </p>

              {/* Updated by */}
              <p className="text-xs text-gray-500">
                by <span className="font-semibold">{update.updatedByName || update.updatedBy}</span>
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
