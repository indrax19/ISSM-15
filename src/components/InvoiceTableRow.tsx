import { memo, useCallback, useState } from "react";
import { Invoice } from "@/integrations/firebase/invoiceAPI";
import { useAuth } from "@/context/AuthContext";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Download, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePDF } from "@/utils/invoicePDF";
import { toast } from "sonner";

interface InvoiceTableRowProps {
  invoice: Invoice;
  srNumber: number;
  onDelete: (invoiceId: string) => void;
  onView: (invoice: Invoice) => void;
  onPayment?: (invoice: Invoice) => void;
}

const InvoiceTableRow = memo(function InvoiceTableRow({
  invoice,
  srNumber,
  onDelete,
  onView,
  onPayment,
}: InvoiceTableRowProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleEdit = useCallback(() => {
    navigate(`/invoices/${invoice.id}`);
  }, [invoice.id, navigate]);

  const handleView = useCallback(() => {
    onView(invoice);
  }, [invoice, onView]);

  const handleDelete = useCallback(() => {
    onDelete(invoice.id!);
  }, [invoice.id, onDelete]);

  const handleDownloadPDF = useCallback(() => {
    try {
      setIsDownloading(true);
      downloadInvoicePDF(invoice, invoice.companyProfileId);
      toast.success("Invoice PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading invoice PDF:", error);
      toast.error("Failed to download invoice PDF");
    } finally {
      setIsDownloading(false);
    }
  }, [invoice]);

  const handlePayment = useCallback(() => {
    onPayment?.(invoice);
  }, [invoice, onPayment]);

  const totalAmount = invoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0);
  const balance = totalAmount - invoice.balancePaid;

  return (
    <TableRow className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-150">
      <TableCell className="font-medium text-sm text-gray-900 py-4">{srNumber}</TableCell>
      <TableCell className="text-sm text-gray-700 py-4">
        {format(new Date(invoice.date), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="font-mono font-semibold text-sm text-blue-600 py-4">
        {invoice.invoiceNo}
      </TableCell>
      <TableCell className="text-sm text-gray-700 py-4">
        {invoice.poNumber || "—"}
      </TableCell>
      <TableCell className="text-sm text-gray-900 font-medium py-4">{invoice.millName}</TableCell>
      <TableCell className="text-sm text-gray-700 py-4">{invoice.location}</TableCell>
      <TableCell className="text-sm font-semibold text-gray-900 text-right py-4">
        ₨ {totalAmount.toLocaleString()}
      </TableCell>
      <TableCell className="text-sm font-semibold text-green-600 text-right py-4">
        ₨ {invoice.balancePaid?.toLocaleString() || "0"}
      </TableCell>
      <TableCell className={`text-sm font-semibold text-right py-4 ${balance > 0 ? "text-amber-600" : "text-green-600"}`}>
        ₨ {balance.toLocaleString()}
      </TableCell>
      <TableCell className="py-4">
        <Badge
          variant="outline"
          className={`font-medium transition-colors ${
            invoice.poStatus === "completed"
              ? "bg-green-100 text-green-800 border-green-300"
              : invoice.poStatus === "cancelled"
              ? "bg-red-100 text-red-800 border-red-300"
              : "bg-amber-100 text-amber-800 border-amber-300"
          }`}
        >
          {invoice.poStatus || "Pending"}
        </Badge>
      </TableCell>
      <TableCell className="text-right py-4">
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-all duration-150"
            onClick={handleView}
            title="View invoice"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            title="Download invoice as PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
          {isAdmin ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-all duration-150"
                onClick={handleEdit}
                title="Edit invoice"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all duration-150"
                onClick={handleDelete}
                title="Delete invoice"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : balance > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-green-600 hover:bg-green-100 hover:text-green-700 transition-all duration-150"
              onClick={handlePayment}
              title="Make payment"
            >
              <CreditCard className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.invoice.id === nextProps.invoice.id &&
    prevProps.invoice.updated_at === nextProps.invoice.updated_at &&
    prevProps.invoice.invoiceNo === nextProps.invoice.invoiceNo &&
    prevProps.invoice.millName === nextProps.invoice.millName &&
    prevProps.invoice.poStatus === nextProps.invoice.poStatus &&
    prevProps.invoice.balancePaid === nextProps.invoice.balancePaid &&
    prevProps.invoice.companyProfileId === nextProps.invoice.companyProfileId &&
    prevProps.srNumber === nextProps.srNumber
  );
});

export default InvoiceTableRow;
