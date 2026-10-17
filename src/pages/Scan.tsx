import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesAPI,
  subCategoriesAPI,
  inventoryItemsAPI,
  inventoryTransactionsAPI,
} from "@/integrations/firebase/firestore";
import { realtimeInventoryItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { useAuth } from "@/context/AuthContext";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { HierarchicalCategorySelect } from "@/components/HierarchicalCategorySelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScanBarcode, Plus, ArrowUpFromLine, CheckCircle, Camera, HardDrive, X, Layers } from "lucide-react";
import { z } from "zod";

type ScanMode = "add" | "issue";
type InputMode = "camera" | "manual";

export default function Scan() {
  const queryClient = useQueryClient();
  const { appUser } = useAuth();
  const manualInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  const [mode, setMode] = useState<ScanMode>("add");
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [itemName, setItemName] = useState("");
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [serialNumberInput, setSerialNumberInput] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [foundItem, setFoundItem] = useState<any>(null);
  const [storeName, setStoreName] = useState("");

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep manual input focused for continuous scanning with USB barcode scanner
  useEffect(() => {
    if (inputMode === "manual" && !dialogOpen) {
      manualInputRef.current?.focus();
    }
  }, [inputMode, dialogOpen]);


  const handleScan = async (code: string) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    if (mode === "issue") {
      const items = await inventoryItemsAPI.getByStatus("in");
      // Look for item that has this exact serial number
      const found = items.find((item) => item.serial_number === trimmedCode);

      if (found) {
        const category = await categoriesAPI.getById(found.category_id);
        const subCategory = found.subcategory_id
          ? await subCategoriesAPI.getById(found.subcategory_id)
          : null;
        setFoundItem({ ...found, categories: category, sub_categories: subCategory });
        setDialogOpen(true);
        setCameraActive(false); // Turn off camera after successful scan
        toast.success(`Found: ${found.name}`);
      } else {
        toast.error("No in-stock item found with this serial number");
      }
    } else {
      // Add mode: check for duplicates (in local list and database)
      if (serialNumbers.includes(trimmedCode)) {
        toast.error("This serial number is already added in current batch");
        return;
      }

      // Check if serial number already exists in database
      const existingItem = await inventoryItemsAPI.getBySerialNumber(trimmedCode);
      if (existingItem) {
        const category = await categoriesAPI.getById(existingItem.category_id);
        toast.error(`This serial number already exists in ${category?.name || "database"}`);
        setCameraActive(false);
        return;
      }

      setSerialNumbers([...serialNumbers, trimmedCode]);
      setScannedCode(trimmedCode);
      setCameraActive(false); // Turn off camera after successful scan
      toast.success(`Added: ${trimmedCode}`);
      if (!dialogOpen) {
        setDialogOpen(true);
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error("Please enter a serial number");
      return;
    }
    const code = manualCode.trim();
    setManualCode("");
    await handleScan(code);
  };

  const addSerialNumberManually = async () => {
    const trimmed = serialNumberInput.trim();
    if (!trimmed) {
      toast.error("Please enter a serial number");
      return;
    }
    if (serialNumbers.includes(trimmed)) {
      toast.error("This serial number is already added in current batch");
      return;
    }

    // Check if serial number already exists in database
    const existingItem = await inventoryItemsAPI.getBySerialNumber(trimmed);
    if (existingItem) {
      const category = await categoriesAPI.getById(existingItem.category_id);
      toast.error(`This serial number already exists in ${category?.name || "database"}`);
      return;
    }

    setSerialNumbers([...serialNumbers, trimmed]);
    setSerialNumberInput("");
    toast.success(`Added: ${trimmed}`);
  };

  const removeSerialNumber = (index: number) => {
    setSerialNumbers(serialNumbers.filter((_, i) => i !== index));
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!categoryId) throw new Error("Select a category");
      if (!subcategoryId) throw new Error("Select a sub-category");
      if (serialNumbers.length === 0) throw new Error("Add at least one serial number");
      if (!storeName.trim()) throw new Error("Store name is required");

      const itemName_final = itemName.trim();

      // Create one item per serial number
      for (const serialNumber of serialNumbers) {
        const itemId = await inventoryItemsAPI.create({
          name: itemName_final || serialNumber,
          serial_number: serialNumber,
          category_id: categoryId,
          ...(subcategoryId ? { subcategory_id: subcategoryId } : {}),
          status: "in",
          store_name: storeName.trim(),
        });
        await inventoryTransactionsAPI.create({
          item_id: itemId as string,
          type: "addition",
          created_by: appUser?.fullName || appUser?.email || "Unknown User",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Item added to inventory!");
      resetDialog(true);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add item");
    },
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const parsed = z.string().trim().min(1, "Recipient required").parse(recipient);
      await inventoryItemsAPI.update(foundItem.id, { status: "out" });
      await inventoryTransactionsAPI.create({
        item_id: foundItem.id,
        type: "removal",
        recipient_name: parsed,
        created_by: appUser?.fullName || appUser?.email || "Unknown User",
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Item issued successfully!");
      resetDialog();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to issue item");
    },
  });

  const resetDialog = (preserveAddSelection = false) => {
    setDialogOpen(false);
    setScannedCode(null);
    setFoundItem(null);
    setManualCode("");
    setItemName("");
    setRecipient("");
    setNotes("");
    if (!preserveAddSelection) {
      setCategoryId("");
      setSubcategoryId("");
      setStoreName("");
    }
    setSerialNumbers([]);
    setSerialNumberInput("");
  };

  const scanAnotherItem = () => {
    setDialogOpen(false);
    setScannedCode(null);
    setCameraActive(inputMode === "camera");
  };

  return (
    <div className="min-h-screen space-y-6 rounded-2xl bg-gradient-to-br from-slate-50 via-background to-blue-50/60 p-4 md:space-y-8 md:p-8 dark:from-slate-950 dark:via-background dark:to-blue-950/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between md:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ScanBarcode className="h-7 w-7" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Inventory Management</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Serial Number Scanner</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Scan serial numbers to add items to stock or issue existing inventory.</p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Scanner ready
        </Badge>
      </div>

      {/* Mode Selection with Visual Indicators */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          className={`group cursor-pointer overflow-hidden rounded-2xl border bg-card transition-all duration-300 animate-scale-in ${mode === "add" ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10" : "border-border/70 shadow-sm hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-md"}`}
          onClick={() => setMode("add")}
        >
          <CardContent className="p-5 text-center md:p-7">
            <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${mode === "add" ? "scale-105 bg-emerald-500/10" : "bg-muted group-hover:bg-emerald-500/10"}`}>
              <Plus className={`h-6 w-6 transition-colors ${mode === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground group-hover:text-emerald-600"}`} />
            </div>
            <p className={`text-base font-semibold transition-colors ${mode === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>Add Items</p>
            <p className="text-xs text-muted-foreground mt-1">Stock in to inventory</p>
          </CardContent>
        </Card>
        <Card
          className={`group cursor-pointer overflow-hidden rounded-2xl border bg-card transition-all duration-300 animate-scale-in ${mode === "issue" ? "border-rose-500 ring-2 ring-rose-500/20 shadow-lg shadow-rose-500/10" : "border-border/70 shadow-sm hover:-translate-y-0.5 hover:border-rose-500/50 hover:shadow-md"}`}
          onClick={() => setMode("issue")}
        >
          <CardContent className="p-5 text-center md:p-7">
            <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${mode === "issue" ? "scale-105 bg-rose-500/10" : "bg-muted group-hover:bg-rose-500/10"}`}>
              <ArrowUpFromLine className={`h-6 w-6 transition-colors ${mode === "issue" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground group-hover:text-rose-600"}`} />
            </div>
            <p className={`text-base font-semibold transition-colors ${mode === "issue" ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>Issue Items</p>
            <p className="text-xs text-muted-foreground mt-1">Stock out from inventory</p>
          </CardContent>
        </Card>
      </div>

      {mode === "add" && (
        <Card className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border-primary/15 bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-5 py-4 md:px-6">
            <CardTitle className="flex items-center gap-3 text-base font-semibold md:text-lg">
              <Layers className="h-5 w-5 text-primary" />
              Select Category & Sub Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            <HierarchicalCategorySelect
              selectedCategoryId={categoryId}
              selectedSubcategoryId={subcategoryId}
              onSelectCategory={(catId, subCatId) => {
                setCategoryId(catId);
                setSubcategoryId(subCatId);
              }}
              autoFocus={true}
            />
            {categoryId && subcategoryId && (
              <div className="mt-4 p-3 bg-success/10 border border-success/30 rounded-lg">
                <p className="text-sm text-success font-medium">✓ Category selected - Ready to scan</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Input Mode Selection */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          className={`group cursor-pointer rounded-2xl border bg-card transition-all duration-300 ${inputMode === "camera" ? "border-primary ring-2 ring-primary/20 shadow-md shadow-primary/10" : "border-border/70 shadow-sm hover:border-primary/40 hover:shadow-md"}`}
          onClick={() => {
            setInputMode("camera");
            setCameraActive(true);
          }}
        >
          <CardContent className="p-5 text-center md:p-7">
            <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${inputMode === "camera" ? "scale-105 bg-primary/10" : "bg-muted group-hover:bg-primary/10"}`}>
              <Camera className={`h-5 w-5 transition-colors ${inputMode === "camera" ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-sm font-semibold transition-colors ${inputMode === "camera" ? "text-primary" : "text-muted-foreground"}`}>Camera</p>
          </CardContent>
        </Card>
        <Card
          className={`group cursor-pointer rounded-2xl border bg-card transition-all duration-300 ${inputMode === "manual" ? "border-primary ring-2 ring-primary/20 shadow-md shadow-primary/10" : "border-border/70 shadow-sm hover:border-primary/40 hover:shadow-md"}`}
          onClick={() => {
            setInputMode("manual");
            setCameraActive(false);
          }}
        >
          <CardContent className="p-5 text-center md:p-7">
            <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${inputMode === "manual" ? "scale-105 bg-primary/10" : "bg-muted group-hover:bg-primary/10"}`}>
              <ScanBarcode className={`h-5 w-5 transition-colors ${inputMode === "manual" ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-sm font-semibold transition-colors ${inputMode === "manual" ? "text-primary" : "text-muted-foreground"}`}>Manual</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60 bg-muted/20 px-5 py-4 md:px-6">
          <CardTitle className="flex items-center gap-3 text-base font-semibold md:text-lg">
            <ScanBarcode className="h-5 w-5" />
            {mode === "add" ? "Scan Serial to Add" : "Scan Serial to Issue"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 md:p-6">
          {inputMode === "camera" ? (
            <BarcodeScanner onScan={handleScan} active={cameraActive} />
          ) : (
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-5 rounded-xl border border-border/60 bg-muted/20 p-4 md:p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="manual-barcode" className="text-sm font-semibold">Enter Serial Number</Label>
                  <span className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full ${cameraActive ? "text-muted-foreground" : "bg-success/10 text-success font-medium"}`}>
                    <div className={`h-2 w-2 rounded-full ${cameraActive ? "" : "bg-success animate-pulse"}`} />
                    {cameraActive ? "Camera Active" : "USB Scanner Ready"}
                  </span>
                </div>
                <Input
                  ref={manualInputRef}
                  id="manual-barcode"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Scan or type serial number..."
                  maxLength={200}
                  className={`h-12 rounded-xl bg-background text-base transition-all focus-visible:ring-2 focus-visible:ring-primary/30 ${manualCode ? "border-emerald-500 bg-emerald-500/5" : ""}`}
                  autoFocus
                />
              </div>
              <Button type="submit" className="h-12 gap-2 rounded-xl px-5 font-semibold shadow-sm transition-all hover:shadow-md">
                <ScanBarcode className="h-4 w-4" /> Process Serial Number
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Add Mode Dialog */}
      <Dialog open={dialogOpen && mode === "add"} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-md rounded-2xl border-border/70 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              Serial Number Scanned
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-xs text-muted-foreground mb-2">Serial Number:</p>
              <p className="font-mono font-bold text-lg text-center text-success">{scannedCode}</p>
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Total Items Ready:</p>
                <p className="font-bold text-lg text-primary">{serialNumbers.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-name" className="font-semibold">Store Name *</Label>
              <Select value={storeName} onValueChange={setStoreName}>
                <SelectTrigger id="store-name" className="h-11 rounded-xl text-sm">
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lahore">Lahore</SelectItem>
                  <SelectItem value="Faisalabad">Faisalabad</SelectItem>
                  <SelectItem value="Multan">Multan</SelectItem>
                  <SelectItem value="Karachi">Karachi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
            <Button variant="ghost" onClick={scanAnotherItem} className="w-full sm:w-auto">Scan Another</Button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={resetDialog}>Cancel</Button>
              <Button
                onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !categoryId || !subcategoryId || serialNumbers.length === 0 || !storeName.trim()}
              className="gap-2"
            >
                {addMutation.isPending ? "Adding..." : "Add to Inventory"} {serialNumbers.length > 0 && `(${serialNumbers.length})`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Mode Dialog */}
      <Dialog open={dialogOpen && mode === "issue"} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-md rounded-2xl border-border/70 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                <ArrowUpFromLine className="h-5 w-5 text-destructive" />
              </div>
              Issue Item
            </DialogTitle>
          </DialogHeader>
          {foundItem && (
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Item</p>
                  <p className="font-semibold text-base">{foundItem.name}</p>
                </div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><span className="font-medium">Category:</span> {foundItem.categories?.name}</p>
                  {foundItem.sub_categories && (
                    <p><span className="font-medium">Sub Category:</span> {foundItem.sub_categories.name}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Serial Number:</p>
                  <p className="font-mono text-sm font-bold bg-muted p-2 rounded">{foundItem.serial_number}</p>
                </div>
                <Badge className="w-full justify-center py-1" variant="outline">✓ In Stock</Badge>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Recipient Name *</Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Who receives this item?"
                  maxLength={200}
                  className="h-11 rounded-xl text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes (reason, department, etc.)"
                  maxLength={500}
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || !recipient.trim()}
              variant="destructive"
              className="gap-2"
            >
              {issueMutation.isPending ? "Issuing..." : "Issue Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
