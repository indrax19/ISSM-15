import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceAPI, Invoice } from "@/integrations/firebase/invoiceAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Eye, FileText, Pencil, Trash2, Download, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import InvoiceTableRow from "@/components/InvoiceTableRow";
import InvoiceTableSkeleton from "@/components/InvoiceTableSkeleton";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import ErrorAlert from "@/components/ErrorAlert";
import EmptyState from "@/components/EmptyState";
import PaymentForm from "@/components/PaymentForm";
import PaymentHistory from "@/components/PaymentHistory";
import { downloadInvoicePDF } from "@/utils/invoicePDF";

export default function Invoices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ITEMS_PER_PAGE = 10;

  // Subscribe to real-time updates on mount
  useEffect(() => {
    setIsLoading(true);
    setFetchError(null);

    try {
      unsubscribeRef.current = invoiceAPI.subscribeAll(
        (data) => {
          setInvoices(data);
          setIsLoading(false);
        },
        (error) => {
          console.error("Subscription error:", error);
          setFetchError(error.message || "Failed to load invoices");
          setIsLoading(false);
        }
      );
    } catch (error: any) {
      setFetchError(error.message || "Failed to subscribe to invoices");
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
      setRetryTrigger((prev) => prev + 1);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [queryClient]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await invoiceAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete invoice");
    },
  });


  const handleDeleteClick = useCallback((invoiceId: string) => {
    if (!isAdmin) {
      setShowPermissionDenied(true);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this invoice?")) {
      return;
    }

    deleteMutation.mutate(invoiceId);
  }, [isAdmin, deleteMutation]);


  const handleViewInvoice = useCallback((invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowViewModal(true);
    setShowPaymentHistory(true);
  }, []);

  // Memoize filtered invoices
  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter((invoice: Invoice) => {
      const matchesSearch =
        invoice.invoiceNo.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.millName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.poNumber?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        invoice.location.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      const matchesDate = !filterDate || invoice.date.startsWith(filterDate);

      return matchesSearch && matchesDate;
    });
  }, [invoices, debouncedSearchTerm, filterDate]);

  // Paginate filtered results
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredInvoices.slice(startIndex, endIndex);
  }, [filteredInvoices, currentPage]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);

  const handleCreateNew = useCallback(() => {
    console.log("Create New Invoice button clicked");
    console.log("Navigating to /invoices/new");
    navigate("/invoices/new");
  }, [navigate]);

  // Calculate statistics
  const totalInvoiceAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.equipment.reduce((s, eq) => s + (eq.quantity * eq.unitPrice), 0)), 0);
  }, [invoices]);

  const totalPaidAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.balancePaid || 0), 0);
  }, [invoices]);

  const totalBalance = totalInvoiceAmount - totalPaidAmount;


  return (
    <>
      <PermissionDeniedDialog
        open={showPermissionDenied}
        onOpenChange={setShowPermissionDenied}
        message="You do not have permission to delete invoices. Only administrators can perform this action."
      />

      <div className="space-y-6 pb-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600 mt-2">
              Manage and track all your invoices and payments
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleCreateNew}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        {!isLoading && invoices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{invoices.length}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {/* Filters Section */}
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search by invoice #, mill name, PO #, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="w-full lg:w-auto">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full lg:w-auto px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full lg:w-auto border-gray-300 hover:bg-gray-50"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {fetchError && (
          <ErrorAlert
            title="Error Loading Invoices"
            message={fetchError}
            onRetry={handleRetry}
            variant="destructive"
          />
        )}

        {/* Table */}
        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-0">
                <InvoiceTableSkeleton />
              </div>
            ) : filteredInvoices && filteredInvoices.length > 0 ? (
              <>
                <div className="space-y-3 md:hidden p-4">
                  {paginatedInvoices.map((invoice: Invoice, index: number) => {
                    const invoiceAmount = invoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0);
                    const balance = invoiceAmount - invoice.balancePaid;
                    return (
                      <Card key={invoice.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm font-semibold text-blue-600 truncate">
                                {invoice.invoiceNo}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(invoice.date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Badge
                              variant={invoice.invoiceStatus === "paid" ? "default" : "secondary"}
                              className={`shrink-0 ${
                                invoice.invoiceStatus === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {invoice.invoiceStatus || "Draft"}
                            </Badge>
                          </div>

                          <div className="border-t pt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-medium text-gray-500">Mill Name</p>
                              <p className="font-semibold text-gray-900 break-words mt-1">{invoice.millName}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Location</p>
                              <p className="font-semibold text-gray-900 break-words mt-1">{invoice.location}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-medium text-gray-500">PO Number</p>
                              <p className="font-medium text-gray-900 mt-1">{invoice.poNumber || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Invoice Amount</p>
                              <p className="font-bold text-gray-900 mt-1">
                                ₨ {invoiceAmount.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 -mx-4 -mb-4 px-4 py-3">
                            <div>
                              <p className="text-xs font-medium text-gray-500">Paid Amount</p>
                              <p className="font-semibold text-green-600 mt-1">
                                ₨ {invoice.balancePaid?.toLocaleString() || "0"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Balance</p>
                              <p className={`font-semibold mt-1 ${balance > 0 ? "text-amber-600" : "text-green-600"}`}>
                                ₨ {balance.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="border-t pt-3 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-gray-700 border-gray-300 hover:bg-gray-50"
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => navigate(`/invoices/${invoice.id}`)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleDeleteClick(invoice.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50 border-b-2 border-gray-200">
                      <TableRow className="hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700 h-12">SR #</TableHead>
                        <TableHead className="font-semibold text-gray-700">Date</TableHead>
                        <TableHead className="font-semibold text-gray-700">Invoice #</TableHead>
                        <TableHead className="font-semibold text-gray-700">PO #</TableHead>
                        <TableHead className="font-semibold text-gray-700">Mill Name</TableHead>
                        <TableHead className="font-semibold text-gray-700">Location</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-right">Invoice Amount</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-right">Paid Amount</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-right">Balance</TableHead>
                        <TableHead className="font-semibold text-gray-700">Status</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvoices.map((invoice: Invoice, index: number) => (
                        <InvoiceTableRow
                          key={invoice.id}
                          invoice={invoice}
                          srNumber={(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                          onDelete={handleDeleteClick}
                          onView={handleViewInvoice}
                          onPayment={(inv) => {
                            setViewingInvoice(inv);
                            setShowPaymentForm(true);
                          }}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 py-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-sm font-medium text-gray-600">
                      Showing <span className="font-semibold text-gray-900">{paginatedInvoices.length}</span> of <span className="font-semibold text-gray-900">{filteredInvoices.length}</span> invoices
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="border-gray-300 hover:bg-gray-100"
                      >
                        Previous
                      </Button>
                      <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
                        {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="border-gray-300 hover:bg-gray-100"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={FileText}
                title={searchTerm || filterDate ? "No Results" : "No Invoices Yet"}
                description={
                  searchTerm || filterDate
                    ? "No invoices match your filters"
                    : "No invoices yet. Create your first one!"
                }
                action={isAdmin ? {
                  label: "Create Invoice",
                  onClick: handleCreateNew,
                } : undefined}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900">Invoice Details</DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <ScrollArea className="flex-1 w-full rounded-md p-4">
              <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Invoice Number</p>
                    <p className="font-mono font-bold text-blue-600 mt-1">{viewingInvoice.invoiceNo}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Date</p>
                    <p className="font-medium text-gray-900 mt-1">{format(new Date(viewingInvoice.date), "MMM d, yyyy")}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase">PO Number</p>
                    <p className="font-medium text-gray-900 mt-1">{viewingInvoice.poNumber || "—"}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase">PO Status</p>
                    <Badge className={`mt-1 ${viewingInvoice.poStatus === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {viewingInvoice.poStatus || "Pending"}
                    </Badge>
                  </div>
                </div>

                {/* Payment History Section - MOVED UP FOR VISIBILITY */}
                <div className="border-t pt-6 bg-blue-50 p-6 rounded-lg border-l-4 border-l-blue-600">
                  <h3 className="text-sm font-bold text-gray-900 uppercase mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Payment History & Details
                  </h3>
                  <PaymentHistory invoiceId={viewingInvoice.id!} />
                </div>

                {/* Recipient Info */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">Recipient Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Mill Name</p>
                      <p className="font-medium text-gray-900 mt-2">{viewingInvoice.millName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Location</p>
                      <p className="font-medium text-gray-900 mt-2">{viewingInvoice.location}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Unit</p>
                      <p className="font-medium text-gray-900 mt-2">{viewingInvoice.unit || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">Items</h3>
                  <div className="space-y-2">
                    {viewingInvoice.equipment.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-600 mt-1">{item.details || "—"}</p>
                          <p className="text-xs text-gray-500 mt-2">Qty: {item.quantity} × ₨ {item.unitPrice.toLocaleString()}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 ml-4 flex-shrink-0">₨ {(item.quantity * item.unitPrice).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Invoice Amount:</span>
                      <span className="font-semibold text-gray-900">₨ {viewingInvoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Paid Amount:</span>
                      <span className="font-semibold text-green-600">₨ {viewingInvoice.balancePaid?.toLocaleString() || "0"}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t">
                      <span className="text-sm font-bold text-gray-900">Balance Due:</span>
                      <span className={`text-lg font-bold ${(viewingInvoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0) - viewingInvoice.balancePaid) > 0 ? "text-amber-600" : "text-green-600"}`}>
                        ₨ {(viewingInvoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0) - viewingInvoice.balancePaid).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </ScrollArea>
          )}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (viewingInvoice) {
                    downloadInvoicePDF(viewingInvoice, viewingInvoice.companyProfileId);
                  }
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              {viewingInvoice && !isAdmin && (viewingInvoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0) - viewingInvoice.balancePaid) > 0 && (
                <Button
                  onClick={() => {
                    setShowPaymentForm(true);
                  }}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CreditCard className="h-4 w-4" />
                  Make Payment
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowViewModal(false)}
                className="border-gray-300 hover:bg-gray-50"
              >
                Close
              </Button>
              {viewingInvoice && isAdmin && (
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    navigate(`/invoices/${viewingInvoice.id}`);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Invoice
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Form */}
      {viewingInvoice && (
        <PaymentForm
          open={showPaymentForm}
          onOpenChange={setShowPaymentForm}
          invoice={viewingInvoice}
          onPaymentSuccess={() => {
            setShowPaymentForm(false);
          }}
        />
      )}
    </>
  );
}
