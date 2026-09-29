import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentAPI, Payment } from "@/integrations/firebase/paymentAPI";
import { invoiceAPI, Invoice } from "@/integrations/firebase/invoiceAPI";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { X } from "lucide-react";

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onPaymentSuccess?: () => void;
}

export default function PaymentForm({ open, onOpenChange, invoice, onPaymentSuccess }: PaymentFormProps) {
  const { appUser } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "cheque" | "online">("bank_transfer");
  const [notes, setNotes] = useState("");

  const invoiceAmount = invoice.equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0);
  const paidAmount = invoice.balancePaid || 0;
  const remainingBalance = invoiceAmount - paidAmount;

  const handleNumberInputWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const paymentAmount = Number(amount);

      if (!paymentAmount || paymentAmount <= 0) {
        throw new Error("Please enter a valid payment amount");
      }

      if (paymentAmount > remainingBalance) {
        throw new Error(`Payment amount cannot exceed balance of ₨${remainingBalance.toLocaleString()}`);
      }

      // Create payment record
      const payment: Payment = {
        invoiceId: invoice.id!,
        invoiceNo: invoice.invoiceNo,
        amount: paymentAmount,
        paymentDate,
        paymentMethod,
        notes: notes || undefined,
        createdBy: appUser?.id,
        createdByName: appUser?.fullName,
      };

      await paymentAPI.create(payment);

      // Update invoice with new balance paid
      const newBalancePaid = paidAmount + paymentAmount;
      await invoiceAPI.update(invoice.id!, {
        balancePaid: newBalancePaid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment recorded successfully!");
      setAmount("");
      setNotes("");
      onOpenChange(false);
      onPaymentSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const handleSubmit = () => {
    paymentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Invoice {invoice.invoiceNo} - {invoice.millName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Summary */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Amount:</span>
                <span className="font-semibold">₨ {invoiceAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Already Paid:</span>
                <span className="font-semibold text-green-600">₨ {paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-blue-200">
                <span className="font-medium text-gray-900">Remaining Balance:</span>
                <span className="font-bold text-blue-600">₨ {remainingBalance.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setAmount("");
                  } else {
                    const num = Number(val);
                    if (!isNaN(num) && num >= 0) {
                      setAmount(num.toString());
                    }
                  }
                }}
                onWheel={handleNumberInputWheel}
                className="text-sm"
                disabled={paymentMutation.isPending}
              />
              <p className="text-xs text-gray-500">
                Max: ₨ {remainingBalance.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment Date *</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-sm"
                disabled={paymentMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: any) => setPaymentMethod(value)}
                disabled={paymentMutation.isPending}
              >
                <SelectTrigger id="payment-method" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="e.g., Check #12345, Reference ID..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
                disabled={paymentMutation.isPending}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={paymentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={paymentMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {paymentMutation.isPending ? "Recording..." : "Record Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
