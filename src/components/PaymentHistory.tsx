import { useEffect, useState, useRef } from "react";
import { paymentAPI, Payment } from "@/integrations/firebase/paymentAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

interface PaymentHistoryProps {
  invoiceId: string;
  isLoading?: boolean;
}

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  online: "Online",
};

const paymentMethodColors: Record<string, string> = {
  cash: "bg-blue-100 text-blue-800",
  bank_transfer: "bg-green-100 text-green-800",
  cheque: "bg-yellow-100 text-yellow-800",
  online: "bg-purple-100 text-purple-800",
};

export default function PaymentHistory({ invoiceId, isLoading = false }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(isLoading);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    unsubscribeRef.current = paymentAPI.subscribeByInvoiceId(
      invoiceId,
      (data) => {
        setPayments(data);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error("Error loading payments:", error);
        if (error.message?.includes("index")) {
          setError("Payment history is temporarily unavailable. Please contact support.");
        } else {
          setError("Failed to load payment history");
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribeRef.current?.();
    };
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-gray-500">Loading payment history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-300 mb-3" />
        <p className="text-sm font-medium text-red-600">{error}</p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-8 w-8 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-600">No payments yet</p>
        <p className="text-xs text-gray-500">Payments made will appear here</p>
      </div>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600 mt-1">₨ {totalPaid.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-600">Number of Payments</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{payments.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <div className="hidden md:block overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow className="hover:bg-gray-50">
              <TableHead className="font-semibold text-gray-700">Date</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">Amount</TableHead>
              <TableHead className="font-semibold text-gray-700">Method</TableHead>
              <TableHead className="font-semibold text-gray-700">Notes</TableHead>
              <TableHead className="font-semibold text-gray-700">Recorded By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id} className="hover:bg-gray-50">
                <TableCell className="text-sm">
                  {format(new Date(payment.paymentDate), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right font-semibold text-gray-900">
                  ₨ {payment.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={paymentMethodColors[payment.paymentMethod] || "bg-gray-100 text-gray-800"}>
                    {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {payment.notes || "—"}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {payment.createdByName || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {payments.map((payment) => (
          <Card key={payment.id} className="border border-gray-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">
                  {format(new Date(payment.paymentDate), "MMM d, yyyy")}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  ₨ {payment.amount.toLocaleString()}
                </p>
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Method:</span>
                  <Badge className={paymentMethodColors[payment.paymentMethod] || "bg-gray-100 text-gray-800"}>
                    {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                  </Badge>
                </div>

                {payment.notes && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-600">Notes:</span>
                    <span className="text-gray-900 text-right">{payment.notes}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">By:</span>
                  <span className="text-gray-900">{payment.createdByName || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
