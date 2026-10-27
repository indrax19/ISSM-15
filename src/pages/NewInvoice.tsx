import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceAPI, Invoice, InvoiceEquipment } from "@/integrations/firebase/invoiceAPI";
import { realtimeCompanyProfileAPI } from "@/integrations/firebase/realtimeAPI";
import { CompanyProfile } from "@/integrations/firebase/firestore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, Download, Eye, Plus, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Prevent scroll wheel from changing number input values
const handleNumberInputWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  e.currentTarget.blur();
};

export default function NewInvoice() {
  console.log("NewInvoice component loading...");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { appUser, isAdmin } = useAuth();

  // Restrict invoice creation/editing to admins only
  useEffect(() => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only administrators can create or edit invoices");
      navigate("/invoices");
    }
  }, [isAdmin, navigate]);

  // Form states
  const [invoiceType, setInvoiceType] = useState<"sales" | "purchase">("sales");
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [poNumber, setPoNumber] = useState("");
  const [millName, setMillName] = useState("");
  const [location, setLocation] = useState("");
  const [unit, setUnit] = useState("");
  const [poStatus, setPoStatus] = useState<"pending" | "completed" | "cancelled">("pending");
  const [equipment, setEquipment] = useState<InvoiceEquipment[]>([
    { id: "0", name: "", details: "", quantity: 1, unitPrice: 0, barcodes: [] },
  ]);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedInvoiceProfileId, setSelectedInvoiceProfileId] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number | string>("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [invoiceCategory, setInvoiceCategory] = useState<"Hardware" | "Software" | "Deployment">("Hardware");
  const [invoiceTo, setInvoiceTo] = useState("ISSM Labelling Solutions");
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(id ? true : false);

  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profilesUnsubRef = useRef<(() => void) | null>(null);
  const existingInvoiceUnsubRef = useRef<(() => void) | null>(null);

  const selectedInvoiceProfile = profiles.find((profile) => profile.id === selectedInvoiceProfileId);
  const invoiceNumberPlaceholder = selectedInvoiceProfile
    ? `${selectedInvoiceProfile.company_name.trim().charAt(0).toUpperCase() || "I"}INV-00001`
    : invoiceType === "purchase"
    ? "Auto-generated as PI-00001"
    : "Auto-generated as SI-00001";

  // Subscribe to company profiles
  useEffect(() => {
    profilesUnsubRef.current = realtimeCompanyProfileAPI.subscribeAll((data) => {
      if (isMountedRef.current) {
        setProfiles(data || []);
      }
    });

    return () => {
      profilesUnsubRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (profiles.length === 0) {
      if (!id) {
        setInvoiceNo("");
      }
      return;
    }

    if (!selectedProfileId) {
      // Find ISSM Labelling Solutions first, otherwise fall back to first profile
      const issmProfile = profiles.find(p => p.company_name === "Avira Technologies");
      setSelectedProfileId(issmProfile?.id || profiles[0]?.id || null);
    }

    if (!selectedInvoiceProfileId) {
      // Find ISSM Labelling Solutions first, otherwise fall back to first profile
      const issmProfile = profiles.find(p => p.company_name === "Avira Technologies");
      setSelectedInvoiceProfileId(issmProfile?.id || profiles[0]?.id || null);
    }
  }, [profiles, selectedProfileId, selectedInvoiceProfileId, id]);

  // Load existing invoice if editing
  useEffect(() => {
    if (!id) return;

    existingInvoiceUnsubRef.current = invoiceAPI.subscribeById(id, (invoice) => {
      if (invoice && isMountedRef.current) {
        setInvoiceType(invoice.invoiceType === "purchase" ? "purchase" : "sales");
        setInvoiceNo(invoice.invoiceNo);
        setDate(invoice.date);
        setPoNumber(invoice.poNumber || "");
        setMillName(invoice.millName);
        setLocation(invoice.location);
        setUnit((invoice as any).unit || "");
        setPoStatus((invoice.poStatus as any) || "pending");
        setEquipment(invoice.equipment || []);
        setPaidAmount(invoice.balancePaid || "");
        setReceiptUrl((invoice as any).receiptUrl || null);
        setInvoiceCategory(invoice.invoiceCategory || "Hardware");
        setInvoiceTo(invoice.invoiceTo || "");
        if (invoice.companyProfileId) {
          setSelectedInvoiceProfileId(invoice.companyProfileId);
        }
        setIsLoading(false);
      }
    });

    return () => {
      existingInvoiceUnsubRef.current?.();
    };
  }, [id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validEquipment = equipment.filter((eq) => eq.name?.trim());

      const invoiceData: any = {
        invoiceType,
        invoiceNo: invoiceNo || undefined,
        date,
        poNumber: poNumber || undefined,
        millName,
        location,
        unit: unit || undefined,
        poStatus,
        equipment: validEquipment,
        invoiceCategory,
        invoiceTo: invoiceTo || undefined,
        receiptUrl: receiptUrl || undefined,
        companyProfileId: selectedInvoiceProfileId || undefined,
        companyProfileName: selectedInvoiceProfile?.company_name,
        invoiceAmount: validEquipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0),
        balancePaid: typeof paidAmount === "string" ? (paidAmount === "" ? 0 : Number(paidAmount) || 0) : paidAmount,
        status: "draft",
      };

      const invoiceResult = id
        ? await invoiceAPI.update(id, invoiceData).then(() => ({ id }))
        : await invoiceAPI.create(invoiceData);

      if (invoiceResult.id) {
        setSavedInvoiceId(invoiceResult.id);
      }

      return invoiceResult;
    },
    onSuccess: () => {
      if (!isMountedRef.current) return;

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(id ? "Invoice updated successfully" : "Invoice created successfully");
      setShowSuccess(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          navigate("/invoices");
        }
      }, 1500);
    },
    onError: (err: any) => {
      if (isMountedRef.current) {
        console.error("Invoice save error:", err);
        toast.error(err.message || "Failed to save invoice");
      }
    },
  });

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!isMountedRef.current) return;

    try {
      const fileExt = file.name.split(".").pop() || "pdf";
      const timestamp = Date.now();
      const filePath = `receipt_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      if (isMountedRef.current) {
        setReceiptUrl(urlData.publicUrl);
        toast.success("Receipt uploaded successfully!");
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error("Receipt upload error:", error);
      toast.error(error.message || "Failed to upload receipt");
    }
  };

  const handleViewReceipt = () => {
    if (!receiptUrl) return;
    window.open(receiptUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadReceipt = () => {
    if (!receiptUrl) return;

    const link = document.createElement("a");
    link.href = receiptUrl;
    link.download = "receipt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemoveReceipt = () => {
    setReceiptUrl(null);
  };

  const handleSave = async () => {
    if (!millName.trim()) {
      toast.error("Please enter mill name");
      return;
    }
    if (!location.trim()) {
      toast.error("Please enter location");
      return;
    }
    if (equipment.filter((eq) => eq.name?.trim()).length === 0) {
      toast.error("Please add at least one equipment");
      return;
    }

    saveMutation.mutate();
  };

  const addEquipment = () => {
    setEquipment((prev) => [
      { id: Date.now().toString(), name: "", details: "", quantity: 1, unitPrice: 0, barcodes: [] },
      ...prev,
    ]);
  };

  const updateEquipment = (index: number, field: string, value: any) => {
    setEquipment((prev) =>
      prev.map((e, i) => {
        if (i === index) {
          return { ...e, [field]: value };
        }
        return e;
      })
    );
  };

  const removeEquipment = (index: number) => {
    if (equipment.length > 1) {
      setEquipment((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const totalAmount = equipment.reduce((sum, eq) => sum + (eq.quantity * eq.unitPrice), 0);
  const totalQuantity = equipment.reduce((sum, eq) => sum + eq.quantity, 0);
  const paidAmountNum = typeof paidAmount === "string" ? (paidAmount === "" ? 0 : Number(paidAmount) || 0) : paidAmount;
  const balance = totalAmount - paidAmountNum;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" className="w-10 h-10" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
              {id ? "Edit Invoice" : "New Invoice"}
            </h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Create and manage invoices
          </p>
        </div>
      </div>

      {showSuccess && savedInvoiceId && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <p className="text-green-700 font-medium">
              Invoice saved successfully!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoice Information */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {/* Company Profile Selection */}
          <div className="space-y-3">
            <Label className="text-sm sm:text-base">Company Profile *</Label>
            {profiles.length > 0 ? (
              <RadioGroup
                value={selectedInvoiceProfileId || ""}
                onValueChange={setSelectedInvoiceProfileId}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {profiles.map((profile) => (
                  <Label
                    key={profile.id}
                    htmlFor={`invoice-company-${profile.id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      selectedInvoiceProfileId === profile.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem id={`invoice-company-${profile.id}`} value={profile.id || ""} className="mt-1" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{profile.company_name}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-sm text-muted-foreground">No company profiles. Please create one in Settings.</p>
            )}
          </div>

          {/* Upper Fields */}
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-no">Invoice Number *</Label>
              <Input
                id="invoice-no"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder={invoiceNumberPlaceholder}
                disabled
                className="text-xs sm:text-sm"
              />
              <p className="text-xs text-muted-foreground">Auto-generated on save</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-to">Invoice To *</Label>
              <Input
                id="invoice-to"
                value={invoiceTo}
                onChange={(e) => setInvoiceTo(e.target.value)}
                placeholder="Enter recipient name"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-date">Date *</Label>
              <Input
                id="invoice-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-category">Invoice Type *</Label>
              <Select value={invoiceCategory} onValueChange={(value: any) => setInvoiceCategory(value)}>
                <SelectTrigger id="invoice-category" className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hardware">Hardware</SelectItem>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Deployment">Deployment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-number">PO Number</Label>
              <Input
                id="po-number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-001"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mill-name">Mill Name *</Label>
              <Input
                id="mill-name"
                value={millName}
                onChange={(e) => setMillName(e.target.value)}
                placeholder="Enter mill name"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Enter unit"
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-status">PO Status</Label>
              <Select value={poStatus} onValueChange={(value: any) => setPoStatus(value)}>
                <SelectTrigger id="po-status" className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paid-amount">Paid Amount</Label>
              <Input
                id="paid-amount"
                type="number"
                value={paidAmount || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setPaidAmount("");
                  } else {
                    const num = Number(val);
                    if (!isNaN(num) && num >= 0) {
                      setPaidAmount(num);
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val === "" || isNaN(Number(val))) {
                    setPaidAmount(0);
                  }
                }}
                onWheel={handleNumberInputWheel}
                placeholder="0"
                className="text-xs sm:text-sm"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-upload">Upload receipt (Optional)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" variant="outline" className="gap-2 justify-start sm:justify-center" asChild>
                  <label htmlFor="receipt-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    {receiptUrl ? "Change Receipt" : "Upload Receipt"}
                  </label>
                </Button>
                {receiptUrl && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleViewReceipt}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleDownloadReceipt}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleRemoveReceipt}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <Input id="receipt-upload" type="file" className="hidden" onChange={handleReceiptUpload} />
              {receiptUrl && <p className="text-xs text-muted-foreground break-all">Uploaded receipt attached</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">Balance</Label>
              <Input
                id="balance"
                type="number"
                value={balance}
                disabled
                className="text-xs sm:text-sm bg-muted"
              />
              <p className="text-xs text-muted-foreground">Total - Paid Amount</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Equipment</CardTitle>
          <Button
            onClick={addEquipment}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Equipment
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {equipment.map((item, index) => (
            <Card key={item.id} className="p-4 bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Equipment {index + 1}</p>
                  {equipment.length > 1 && (
                    <Button
                      onClick={() => removeEquipment(index)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`equipment-name-${index}`} className="text-sm">Equipment Name *</Label>
                    <Input
                      id={`equipment-name-${index}`}
                      value={item.name}
                      onChange={(e) => updateEquipment(index, "name", e.target.value)}
                      placeholder="e.g., Motor, Pump"
                      className="text-xs sm:text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`equipment-details-${index}`} className="text-sm">Equipment Details</Label>
                    <Input
                      id={`equipment-details-${index}`}
                      value={item.details || ""}
                      onChange={(e) => updateEquipment(index, "details", e.target.value)}
                      placeholder="e.g., 1.5HP, 2000RPM"
                      className="text-xs sm:text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`equipment-qty-${index}`} className="text-sm">Qty *</Label>
                    <Input
                      id={`equipment-qty-${index}`}
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          updateEquipment(index, "quantity", "");
                        } else {
                          const num = parseInt(val);
                          if (!isNaN(num) && num >= 1) {
                            updateEquipment(index, "quantity", num);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === "" || isNaN(parseInt(val))) {
                          updateEquipment(index, "quantity", 1);
                        }
                      }}
                      onWheel={handleNumberInputWheel}
                      className="text-xs sm:text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`equipment-price-${index}`} className="text-sm">Unit Price *</Label>
                    <Input
                      id={`equipment-price-${index}`}
                      type="number"
                      value={item.unitPrice || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          updateEquipment(index, "unitPrice", "");
                        } else {
                          const num = Number(val);
                          if (!isNaN(num)) {
                            updateEquipment(index, "unitPrice", num);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === "" || isNaN(Number(val))) {
                          updateEquipment(index, "unitPrice", 0);
                        }
                      }}
                      onWheel={handleNumberInputWheel}
                      placeholder="0"
                      className="text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Total for this equipment */}
                <div className="pt-2 border-t bg-white/50 p-2 rounded">
                  <p className="text-sm font-medium">
                    Total: ₨ {(item.quantity * item.unitPrice).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}

          {/* Summary */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Total Quantity:</span>
                <span>{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span className="text-blue-600">₨ {totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => navigate("/invoices")}
          disabled={saveMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saveMutation.isPending ? "Saving..." : id ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
