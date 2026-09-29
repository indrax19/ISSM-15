import { useState, useMemo, useEffect, Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { AlertCircle, Edit2, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { IssueWithDuration } from "@/hooks/useIssues";
import { issuesAPI, type IssueStatus } from "@/integrations/firebase/issuesAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { format } from "date-fns";
import { STATUS_COLORS } from "@/lib/colors";
import StatusHistoryPanel from "./StatusHistoryPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IssuesTableProps {
  issues: IssueWithDuration[];
  isLoading: boolean;
  onStatusUpdateClick?: (issue: IssueWithDuration) => void;
  onEditClick?: (issue: IssueWithDuration) => void;
}

type StatusFilter = "All" | IssueStatus;

const STATUS_MAPPING: Record<IssueStatus, keyof typeof STATUS_COLORS> = {
  "Open": "open",
  "In Progress": "in-progress",
  "Pending": "pending",
  "Client Not Available": "client-not-available",
  "On Hold": "on-hold",
  "Resolved": "resolved",
};

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Pending", label: "Pending" },
  { value: "Client Not Available", label: "Client Not Available" },
  { value: "On Hold", label: "On Hold" },
  { value: "Resolved", label: "Resolved" },
];

export default function IssuesTable({
  issues,
  isLoading,
  onStatusUpdateClick,
  onEditClick,
}: IssuesTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User | null>>({});

  useEffect(() => {
    let isMounted = true;

    const fetchUserNames = async () => {
      try {
        const userIds = new Set<string>();
        issues.forEach((issue) => {
          if (issue.createdBy) userIds.add(issue.createdBy);
          if (issue.resolvedBy) userIds.add(issue.resolvedBy);
        });

        const newUserMap: Record<string, User | null> = {};
        for (const userId of userIds) {
          if (!userMap[userId]) {
            try {
              const user = await usersAPI.getById(userId);
              if (isMounted) {
                newUserMap[userId] = user;
              } else {
                return;
              }
            } catch (error: any) {
              if (error.name === "AbortError" || error.code === "aborted") {
                return;
              }
              console.error(`Failed to fetch user ${userId}:`, error);
              if (isMounted) {
                newUserMap[userId] = null;
              }
            }
          }
        }

        if (isMounted && Object.keys(newUserMap).length > 0) {
          setUserMap((prev) => ({ ...prev, ...newUserMap }));
        }
      } catch (error: any) {
        if (error.name !== "AbortError" && error.code !== "aborted") {
          console.error("Error in fetchUserNames:", error);
        }
      }
    };

    fetchUserNames();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (statusFilter === "All") {
      return issues;
    }
    return issues.filter((issue) => issue.status === statusFilter);
  }, [issues, statusFilter]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await issuesAPI.delete(id);
      toast.success("Issue deleted successfully");
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete issue");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: IssueStatus) => {
    const colorKey = STATUS_MAPPING[status];
    const colorConfig = colorKey ? STATUS_COLORS[colorKey] : null;
    const option = STATUS_OPTIONS.find((opt) => opt.value === status);

    if (!option || !colorConfig) {
      return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }

    return (
      <Badge className={colorConfig.badge}>
        <AlertCircle className="mr-1 h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  const getTechnicalDetailBadge = (status: IssueStatus) => {
    // Show Technical Detail badge only if issue is not resolved
    if (status === "Resolved") {
      return null;
    }
    return (
      <Badge className="border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-50">
        Technical Detail
      </Badge>
    );
  };

  const getUserName = (userId?: string) => {
    if (!userId) return "—";
    return userMap[userId]?.fullName || userId || "—";
  };

  const renderActionButtons = (issue: IssueWithDuration, isMobile = false) => {
    if (isMobile) {
      return (
        <div className="flex flex-wrap gap-2">
          {issue.status !== "Resolved" && onStatusUpdateClick && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusUpdateClick(issue)}
              className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <AlertCircle className="h-4 w-4" />
              Update Status
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditClick?.(issue)}
            className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeleteConfirmId(issue.id || "")}
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2">
        {issue.status !== "Resolved" && onStatusUpdateClick && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStatusUpdateClick(issue)}
            className="h-8 w-8 p-0 hover:bg-blue-100"
            title="Update Status"
          >
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEditClick?.(issue)}
          className="h-8 w-8 p-0 hover:bg-gray-200"
          title="Edit Issue"
        >
          <Edit2 className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDeleteConfirmId(issue.id || "")}
          className="h-8 w-8 p-0 hover:bg-red-100"
          title="Delete Issue"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="text-gray-600">No issues found for this site</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-sm font-semibold text-gray-700">Filter by Status:</span>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Issues ({issues.length})</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({issues.filter((i) => i.status === option.value).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredIssues.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600">No {statusFilter.toLowerCase()} issues found</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredIssues.map((issue) => {
              const isExpanded = expandedIssueId === issue.id;
              return (
                <Card key={issue.id} className="border border-slate-200 shadow-sm">
                  <div className="space-y-4 p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          onClick={() => setExpandedIssueId(isExpanded ? null : issue.id!)}
                          className="min-w-0 flex-1 text-left space-y-2 hover:opacity-75 transition-opacity"
                        >
                          <div className="flex items-start gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                            )}
                            <p className="text-base font-semibold text-slate-900 break-words flex-1">
                              {issue.title}
                            </p>
                          </div>
                          <p className="text-sm leading-6 text-slate-600 whitespace-pre-wrap break-words">
                            {issue.description}
                          </p>
                        </button>
                        <div className="flex flex-col gap-2">
                          {issue.status !== "Resolved" && getTechnicalDetailBadge(issue.status)}
                          {getStatusBadge(issue.status)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</p>
                        <p className="mt-1 text-sm text-slate-900">
                          {format(new Date(issue.createdTime), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Created By</p>
                        <p className="mt-1 text-sm text-slate-900 break-words">{getUserName(issue.createdBy)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resolved</p>
                        <p className="mt-1 text-sm text-slate-900">
                          {issue.resolvedTime ? format(new Date(issue.resolvedTime), "MMM dd, yyyy HH:mm") : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resolved By</p>
                        <p className="mt-1 text-sm text-slate-900 break-words">
                          {issue.resolvedBy ? getUserName(issue.resolvedBy) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</p>
                        <p className="mt-1 text-sm font-semibold text-blue-700">{issue.duration}</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 pt-4">
                        <StatusHistoryPanel
                          statusHistory={issue.statusHistory}
                          currentStatus={issue.status}
                        />
                      </div>
                    )}

                    {renderActionButtons(issue, true)}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border bg-white md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold">Created By</TableHead>
                    <TableHead className="font-semibold">Resolved</TableHead>
                    <TableHead className="font-semibold">Resolved By</TableHead>
                    <TableHead className="font-semibold">Duration</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue) => {
                    const isExpanded = expandedIssueId === issue.id;
                    return (
                      <Fragment key={issue.id}>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="align-top">
                            <button
                              onClick={() => setExpandedIssueId(isExpanded ? null : issue.id!)}
                              className="w-full text-left hover:opacity-75 transition-opacity max-w-sm space-y-1 xl:max-w-md"
                            >
                              <div className="flex items-start gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                                )}
                                <p className="font-medium text-gray-900 break-words flex-1">{issue.title}</p>
                              </div>
                              <p className="text-xs leading-5 text-gray-500 whitespace-pre-wrap break-words">
                                {issue.description}
                              </p>
                            </button>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-2">
                              {issue.status !== "Resolved" && getTechnicalDetailBadge(issue.status)}
                              {getStatusBadge(issue.status)}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm text-gray-600">
                            {format(new Date(issue.createdTime), "MMM dd, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="align-top text-sm text-gray-700">
                            {getUserName(issue.createdBy)}
                          </TableCell>
                          <TableCell className="align-top text-sm text-gray-600">
                            {issue.resolvedTime ? format(new Date(issue.resolvedTime), "MMM dd, yyyy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="align-top text-sm text-gray-700">
                            {issue.resolvedBy ? getUserName(issue.resolvedBy) : "—"}
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="text-sm font-medium text-blue-600">{issue.duration}</span>
                          </TableCell>
                          <TableCell className="align-top">{renderActionButtons(issue)}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-700">Previous Logs & Status Updates</p>
                                <StatusHistoryPanel
                                  statusHistory={issue.statusHistory}
                                  currentStatus={issue.status}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this issue? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={!!deletingId}
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
