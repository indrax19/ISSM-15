import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { challanAPI, Challan, ChallanType } from "@/integrations/firebase/challanAPI";
import { companyProfileAPI, CompanyProfile } from "@/integrations/firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileText, Pencil, Trash2, Eye } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ChallanTableSkeleton from "@/components/ChallanTableSkeleton";
import ChallanFilters from "@/components/ChallanFilters";
import ChallanPagination from "@/components/ChallanPagination";
import ChallanPageHeader from "@/components/ChallanPageHeader";
import ProfileSelectionDialog from "@/components/ProfileSelectionDialog";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import SiteDataDialog from "@/components/SiteDataDialog";
import ErrorAlert from "@/components/ErrorAlert";
import EmptyState from "@/components/EmptyState";
import { ChallanTableRowOptimized } from "@/components/DeliveryChallans/ChallanTableRowOptimized";
import { ChallanMobileCard } from "@/components/DeliveryChallans/ChallanMobileCard";

export default function DeliveryChallans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedChallan, setSelectedChallan] = useState<any>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [downloadingChallan, setDownloadingChallan] = useState(false);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [showSiteDataDialog, setShowSiteDataDialog] = useState(false);
  const [selectedChallanForSiteData, setSelectedChallanForSiteData] = useState<Challan | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const profilesCacheRef = useRef<CompanyProfile[] | null>(null);
  const ITEMS_PER_PAGE = 10;
  const activeTab: ChallanType = searchParams.get("type") === "internal" ? "internal" : "external";
  const activeTabLabel = activeTab === "internal" ? "Internal" : "External";

  // Subscribe to real-time updates on mount
  useEffect(() => {
    setIsLoading(true);
    setFetchError(null);

    try {
      // Limit to 50 recent challans for better performance (instead of 200)
      unsubscribeRef.current = challanAPI.subscribeAll(
        (data) => {
          setChallans(data);
          setIsLoading(false);
        },
        (error) => {
          console.error("Subscription error:", error);
          setFetchError(error.message || "Failed to load delivery challans");
          setIsLoading(false);
        },
        50 // Reduced from default 200 for better performance on low bandwidth
      );
    } catch (error: any) {
      setFetchError(error.message || "Failed to subscribe to challans");
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [retryTrigger]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  const handleRetry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Trigger a re-subscription to get fresh data
      setRetryTrigger((prev) => prev + 1);
      // Invalidate cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      toast.success("Data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      // Reset refreshing state after a short delay for better UX
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [queryClient]);

  const loadProfiles = useCallback(async () => {
    // Return cached profiles if available
    if (profilesCacheRef.current) {
      setProfiles(profilesCacheRef.current);
      if (profilesCacheRef.current.length > 0 && !selectedProfileId) {
        setSelectedProfileId(profilesCacheRef.current[0].id || null);
      }
      return;
    }

    setProfilesLoading(true);
    try {
      const data = await companyProfileAPI.getAll();
      profilesCacheRef.current = data || [];
      setProfiles(data || []);
      if (data && data.length > 0 && !selectedProfileId) {
        setSelectedProfileId(data[0].id || null);
      }
    } catch (error) {
      console.error("Failed to load profiles:", error);
    } finally {
      setProfilesLoading(false);
    }
  }, [selectedProfileId]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, activeTab]);

  const handleTabChange = useCallback((value: string) => {
    const nextTab: ChallanType = value === "internal" ? "internal" : "external";

    if (nextTab === "internal") {
      setSearchParams({ type: "internal" });
      return;
    }

    setSearchParams({});
  }, [setSearchParams]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await challanAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      toast.success("Challan deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete challan");
    },
  });

  const handleDeleteClick = useCallback((challanId: string) => {
    if (!isAdmin) {
      setShowPermissionDenied(true);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this challan?")) {
      return;
    }

    deleteMutation.mutate(challanId);
  }, [isAdmin, deleteMutation]);

  const handleDuplicate = useCallback(async (challan: Challan) => {
    const duplicateData = {
      ...challan,
      challanNo: "",
      equipment: challan.equipment.map((item) => ({
        ...item,
        serialNumbers: [...item.serialNumbers],
        barcodes: [...item.barcodes],
        itemIds: item.itemIds ? [...item.itemIds] : undefined,
      })),
    };
    delete duplicateData.id;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;

    try {
      await challanAPI.create(duplicateData);
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      toast.success("Challan duplicated");
    } catch (error: any) {
      toast.error(error.message || "Failed to duplicate challan");
    }
  }, [queryClient]);

  const handleDownloadPDF = useCallback((challan: Challan) => {
    setSelectedChallan(challan);
    setShowProfileDialog(true);
    // Lazy load profiles when dialog is opened
    loadProfiles();
  }, [loadProfiles]);

  const handleViewSiteData = useCallback((challan: Challan) => {
    setSelectedChallanForSiteData(challan);
    setShowSiteDataDialog(true);
  }, []);

  const handleConfirmDownload = async () => {
    if (!selectedChallan) return;

    if (profiles.length === 0) {
      toast.error("Please create a company profile first in Settings");
      return;
    }

    setDownloadingChallan(true);
    try {
      // Lazy load PDF generation only when needed
      const { downloadChallanPDF } = await import("@/lib/pdfGenerator");
      await downloadChallanPDF(selectedChallan, selectedProfileId || undefined);
      toast.success("PDF downloaded successfully");
      setShowProfileDialog(false);
      setSelectedChallan(null);
    } catch (error) {
      toast.error("Failed to download PDF");
    } finally {
      setDownloadingChallan(false);
    }
  };

  // Memoize filtered challans to prevent recalculation on every render
  const filteredChallans = useMemo(() => {
    return (challans || []).filter((challan: Challan) => {
      const challanType = challan.challanType === "internal" ? "internal" : "external";
      const matchesType = challanType === activeTab;
      const matchesSearch =
        challan.challanNo.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        challan.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (challan.poNumber &&
          challan.poNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

      const matchesDate =
        !filterDate ||
        challan.date.startsWith(filterDate);

      return matchesType && matchesSearch && matchesDate;
    });
  }, [challans, debouncedSearchTerm, filterDate, activeTab]);

  // Paginate filtered results
  const paginatedChallans = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredChallans.slice(startIndex, endIndex);
  }, [filteredChallans, currentPage]);

  const totalPages = Math.ceil(filteredChallans.length / ITEMS_PER_PAGE);

  const handleCreateNew = useCallback(() => {
    navigate(
      activeTab === "internal"
        ? "/delivery-challans/new?type=internal"
        : "/delivery-challans/new"
    );
  }, [activeTab, navigate]);

  return (
    <>
      <PermissionDeniedDialog
        open={showPermissionDenied}
        onOpenChange={setShowPermissionDenied}
        message="You do not have permission to delete delivery challans. Only administrators can perform this action."
      />

      <ProfileSelectionDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onProfileSelect={setSelectedProfileId}
        onConfirm={handleConfirmDownload}
        isLoading={profilesLoading}
        isConfirming={downloadingChallan}
        confirmLabel="Download PDF"
      />

      <SiteDataDialog
        open={showSiteDataDialog}
        onOpenChange={setShowSiteDataDialog}
        challan={selectedChallanForSiteData}
      />

      <div className="space-y-6 pb-6">
        <ChallanPageHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCreateNew={handleCreateNew}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <ChallanFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterDate={filterDate}
          onFilterDateChange={setFilterDate}
        />

        {/* Error Message */}
        {fetchError && (
          <ErrorAlert
            title="Error Loading Delivery Challans"
            message={fetchError}
            onRetry={handleRetry}
            variant="destructive"
          />
        )}

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-0">
                <ChallanTableSkeleton />
              </div>
            ) : filteredChallans && filteredChallans.length > 0 ? (
              <>
                <div className="space-y-4 md:hidden px-4 pt-4">
                  {paginatedChallans.map((challan: Challan) => (
                    <ChallanMobileCard
                      key={challan.id}
                      challan={challan}
                      onDownloadPDF={handleDownloadPDF}
                      onDelete={handleDeleteClick}
                      onViewSiteData={handleViewSiteData}
                    />
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <Table className="min-w-[1072px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32 text-center">Challan No</TableHead>
                        <TableHead className="w-32 text-center">Date</TableHead>
                        <TableHead className="w-48 text-center">Customer / Site</TableHead>
                        <TableHead className="w-20 text-center">Unit</TableHead>
                        <TableHead className="w-36 text-center">Unit PO Number</TableHead>
                        <TableHead className="w-32 text-center">Equipment Count</TableHead>
                        <TableHead className="w-24 text-center">Document</TableHead>
                        <TableHead className="w-44 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedChallans.map((challan: Challan) => (
                        <ChallanTableRowOptimized
                          key={challan.id}
                          challan={challan}
                          onDownloadPDF={handleDownloadPDF}
                          onDelete={handleDeleteClick}
                          onDuplicate={handleDuplicate}
                          onViewSiteData={handleViewSiteData}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ChallanPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  filteredCount={filteredChallans.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <EmptyState
                icon={FileText}
                title={searchTerm || filterDate ? "No Results" : "No Challans Yet"}
                description={
                  searchTerm || filterDate
                    ? `No ${activeTabLabel.toLowerCase()} challans match your filters`
                    : `No ${activeTabLabel.toLowerCase()} challans yet. Create your first one!`
                }
                action={{
                  label: `Create ${activeTabLabel} Challan`,
                  onClick: handleCreateNew,
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
