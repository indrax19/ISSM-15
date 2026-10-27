import { useState, useEffect, Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Trash2, Loader2, ChevronDown, ChevronRight, X, Info, MessageSquarePlus } from "lucide-react";
import StatusHistoryPanel from "./StatusHistoryPanel";
import SiteDetailsModal from "./SiteDetailsModal";
import FollowUpsPanel from "./FollowUpsPanel";
import { toast } from "sonner";
import { ComplaintPageSize, ComplaintWithDetails } from "@/hooks/useComplaints";
import { complaintsAPI, type ComplaintStatus } from "@/integrations/firebase/complaintsAPI";
import { usersAPI, type User } from "@/integrations/firebase/usersAPI";
import { format, formatInTimeZone } from "date-fns-tz";
import { STATUS_COLORS } from "@/lib/colors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ComplaintsTableProps {
  complaints: ComplaintWithDetails[];
  projects: { id: string; name: string }[];
  sites: { id: string; name: string; projectId?: string }[];
  isLoading: boolean;
  pageSize: ComplaintPageSize;
  onPageSizeChange: (pageSize: ComplaintPageSize) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onStatusUpdateClick?: (complaint: ComplaintWithDetails) => void;
  onFollowUpClick?: (complaint: ComplaintWithDetails) => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

const STATUS_MAPPING: Record<ComplaintStatus, keyof typeof STATUS_COLORS> = {
  "Open": "open",
  "In Progress": "in-progress",
  "Waiting for Response": "waiting",
  "Resolved": "resolved",
};

const STATUS_OPTIONS: ComplaintStatus[] = [
  "Open",
  "In Progress",
  "Waiting for Response",
  "Resolved",
];

type StatusFilter = "All" | ComplaintStatus;

const PAKISTAN_TIMEZONE = "Asia/Karachi";

const isNewComplaint = (createdTime: string, status: string, statusHistory?: any[]): boolean => {
  if (status === "Resolved") return false;
  if (statusHistory && statusHistory.length > 1) return false;
  const createdDate = new Date(createdTime);
  const now = new Date();
  const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  return diffHours < 24;
};

const hasFollowUps = (followUps?: any[]): boolean => {
  return followUps && followUps.length > 0;
};

const formatCreatedTimeWithTZ = (createdTime: string): string => {
  return formatInTimeZone(new Date(createdTime), PAKISTAN_TIMEZONE, "MMM dd, yyyy HH:mm");
};

export default function ComplaintsTable({
  complaints,
  projects,
  sites,
  isLoading,
  pageSize,
  onPageSizeChange,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onStatusUpdateClick,
  onFollowUpClick,
  currentUserId,
  isAdmin,
}: ComplaintsTableProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User | null>>({});
  const [expandedComplaintId, setExpandedComplaintId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [projectFilter, setProjectFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");

  const availableSites = sites.filter((site) => projectFilter === "all" || site.projectId === projectFilter);
  const [siteDetailsModalOpen, setSiteDetailsModalOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>();

  const handleOpenSiteDetails = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSiteDetailsModalOpen(true);
  };

  const getLastUpdateUser = (complaint: ComplaintWithDetails): { name: string; timestamp: string } | null => {
    if (!complaint.statusHistory || complaint.statusHistory.length === 0) {
      return null;
    }
    const lastEntry = complaint.statusHistory[complaint.statusHistory.length - 1];
    return {
      name: lastEntry.updatedByName || getUserName(lastEntry.updatedBy),
      timestamp: lastEntry.timestamp,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUserNames = async () => {
      try {
        const userIds = new Set<string>();
        complaints.forEach((complaint) => {
          if (complaint.createdBy) userIds.add(complaint.createdBy);
          if (complaint.resolvedBy) userIds.add(complaint.resolvedBy);
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
  }, [complaints]);


  const canDeleteComplaint = (complaint: ComplaintWithDetails): boolean => {
    if (isAdmin) return true;
    return complaint.createdBy === currentUserId;
  };

  const canAddFollowUp = (complaint: ComplaintWithDetails): boolean => {
    return complaint.status !== "Resolved";
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await complaintsAPI.delete(id);
      toast.success("Complaint deleted successfully");
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete complaint");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    const colorKey = STATUS_MAPPING[status];
    const colorConfig = colorKey ? STATUS_COLORS[colorKey] : null;

    if (!colorConfig) {
      return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }

    return (
      <Badge className={colorConfig.badge}>
        <AlertCircle className="mr-1 h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getUserName = (userId?: string) => {
    if (!userId) return "—";
    return userMap[userId]?.fullName || userId || "—";
  };

  const filteredComplaints = complaints.filter((complaint) => {
    // Status filter
    if (statusFilter !== "All" && complaint.status !== statusFilter) {
      return false;
    }

    if (projectFilter !== "all" && complaint.projectId !== projectFilter) {
      return false;
    }

    if (siteFilter !== "all" && complaint.siteId !== siteFilter) {
      return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (complaints.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="text-gray-600">No complaints found yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">Status</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">Project</label>
            <Select value={projectFilter} onValueChange={(projectId) => {
              setProjectFilter(projectId);
              setSiteFilter("all");
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">Site Name</label>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All Sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {availableSites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(statusFilter !== "All" || projectFilter !== "all" || siteFilter !== "all") && (
            <Button size="sm" variant="outline" onClick={() => {
              setStatusFilter("All");
              setProjectFilter("all");
              setSiteFilter("all");
            }} className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-100">
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {filteredComplaints.length === 0 && complaints.length > 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600">No complaints match your filters</p>
        </Card>
      ) : complaints.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600">No complaints found</p>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredComplaints.map((complaint) => {
              const isExpanded = expandedComplaintId === complaint.id;
              return (
                <Card key={complaint.id} className="border border-slate-200 shadow-sm">
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setExpandedComplaintId(isExpanded ? null : complaint.id!)}
                        className="min-w-0 flex-1 text-left space-y-2 hover:opacity-75 transition-opacity"
                      >
                        <div className="flex items-start gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 break-words">{complaint.subject}</p>
                            {complaint.status !== "Resolved" && hasFollowUps(complaint.followUps) && (
                              <Badge className="mt-1 bg-orange-100 text-orange-800 hover:bg-orange-100">
                                {complaint.followUps!.length} follow-up{complaint.followUps!.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 break-words">{complaint.description}</p>
                      </button>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(complaint.status)}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 space-y-2 text-sm">
                      <p className="text-slate-600">
                        <span className="font-semibold">Project:</span> {complaint.projectName}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Site:</span>
                        <button
                          onClick={() => handleOpenSiteDetails(complaint.siteId)}
                          className="ml-1 text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                          title="View site details"
                        >
                          {complaint.siteName}
                          <Info className="h-3 w-3" />
                        </button>
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Created:</span> {formatCreatedTimeWithTZ(complaint.createdTime)}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">By:</span> {getUserName(complaint.createdBy)}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-semibold">Last Update By:</span> {getLastUpdateUser(complaint)?.name || "—"}
                      </p>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 pt-4 space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs font-semibold text-gray-600 mb-2">DESCRIPTION & UPDATES</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap break-words mb-3">
                            {complaint.description}
                          </p>
                          <FollowUpsPanel followUps={complaint.followUps} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-3">Status History</p>
                          <StatusHistoryPanel
                            statusHistory={complaint.statusHistory}
                            currentStatus={complaint.status}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {complaint.status !== "Resolved" && onStatusUpdateClick && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onStatusUpdateClick(complaint)}
                          className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <AlertCircle className="h-4 w-4" />
                          Update Status
                        </Button>
                      )}
                      {canAddFollowUp(complaint) && onFollowUpClick && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onFollowUpClick(complaint)}
                          className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                          Reply
                        </Button>
                      )}
                      {canDeleteComplaint(complaint) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirmId(complaint.id || "")}
                          className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
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
                    <TableHead className="font-semibold">Subject</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">Site</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold">Created By</TableHead>
                    <TableHead className="font-semibold">Last Update By</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplaints.map((complaint) => {
                    const isExpanded = expandedComplaintId === complaint.id;
                    return (
                      <Fragment key={complaint.id}>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell>
                            <button
                              onClick={() => setExpandedComplaintId(isExpanded ? null : complaint.id!)}
                              className="w-full text-left hover:opacity-75 transition-opacity max-w-sm space-y-2 xl:max-w-md"
                            >
                              <div className="flex items-start gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 break-words">{complaint.subject}</p>
                                  {complaint.status !== "Resolved" && hasFollowUps(complaint.followUps) && (
                                    <Badge className="mt-1 text-xs bg-orange-100 text-orange-800 hover:bg-orange-100">
                                      {complaint.followUps!.length} follow-up{complaint.followUps!.length > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs leading-5 text-gray-500 whitespace-pre-wrap break-words">
                                {complaint.description}
                              </p>
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{complaint.projectName}</TableCell>
                          <TableCell className="text-sm">
                            <button
                              onClick={() => handleOpenSiteDetails(complaint.siteId)}
                              className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                              title="View site details"
                            >
                              {complaint.siteName}
                              <Info className="h-3 w-3" />
                            </button>
                          </TableCell>
                          <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <span>{formatCreatedTimeWithTZ(complaint.createdTime)}</span>
                              {isNewComplaint(complaint.createdTime, complaint.status, complaint.statusHistory) && (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">New</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{getUserName(complaint.createdBy)}</TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {getLastUpdateUser(complaint)?.name || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {complaint.status !== "Resolved" && onStatusUpdateClick && (
                                <Button
                                  size="sm"
                                  onClick={() => onStatusUpdateClick(complaint)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
                                >
                                  Update Status
                                </Button>
                              )}
                              {canAddFollowUp(complaint) && onFollowUpClick && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onFollowUpClick(complaint)}
                                  className="h-8 w-8 p-0 hover:bg-blue-100"
                                  title="Reply to ticket"
                                >
                                  <MessageSquarePlus className="h-4 w-4 text-blue-600" />
                                </Button>
                              )}
                              {canDeleteComplaint(complaint) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirmId(complaint.id || "")}
                                  className="h-8 w-8 p-0 hover:bg-red-100"
                                  title="Delete Complaint"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <p className="text-sm font-semibold text-gray-700 mb-3">Description & Updates</p>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-3">
                                    {complaint.description}
                                  </p>
                                  <FollowUpsPanel followUps={complaint.followUps} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-700 mb-3">Status History & Timeline</p>
                                  <StatusHistoryPanel
                                    statusHistory={complaint.statusHistory}
                                    currentStatus={complaint.status}
                                  />
                                </div>
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

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Rows per load</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(value === "all" ? "all" : Number(value) as ComplaintPageSize)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="60">60</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pageSize !== "all" && hasMore && (
          <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoadingMore ? "Loading..." : "Load more complaints"}
          </Button>
        )}
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Complaint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this complaint? This action cannot be undone.
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

      <SiteDetailsModal
        open={siteDetailsModalOpen}
        onOpenChange={setSiteDetailsModalOpen}
        siteId={selectedSiteId}
      />
    </div>
  );
}
