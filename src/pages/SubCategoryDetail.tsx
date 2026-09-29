import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  subCategoriesAPI,
  categoriesAPI,
  inventoryItemsAPI,
  inventoryTransactionsAPI,
  type SubCategory,
  type Category,
  type InventoryItem,
} from "@/integrations/firebase/firestore";
import { realtimeSubCategoriesAPI, realtimeCategoriesAPI, realtimeInventoryItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, ArrowUpFromLine, Package, Pencil, Trash2, X, Layers, TrendingUp, TrendingDown, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { FastBarcodeScanner, type ScannedItem } from "@/components/FastBarcodeScanner";

const issueSchema = z.object({
  recipient_name: z.string().trim().min(1, "Recipient name required").max(200),
  notes: z.string().trim().max(500).optional(),
});

export default function SubCategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, appUser } = useAuth();

  // Add item states
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"serial" | "bulk">("serial");
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [bulkQuantity, setBulkQuantity] = useState<number | string>("");
  const [storeName, setStoreName] = useState("");
  const [storeNameSuggestions, setStoreNameSuggestions] = useState<string[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  // Edit/Issue states
  const [editOpen, setEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueItemId, setIssueItemId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  // Revert states
  const [revertOpen, setRevertOpen] = useState(false);
  const [revertItemId, setRevertItemId] = useState<string | null>(null);
  const [revertNotes, setRevertNotes] = useState("");

  // Real-time subscriptions
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storeNames, setStoreNames] = useState<string[]>([]);

  const subCatUnsubRef = useRef<(() => void) | null>(null);
  const categoryUnsubRef = useRef<(() => void) | null>(null);
  const itemsUnsubRef = useRef<(() => void) | null>(null);
  const migratedRecipientItemIdsRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    let subCategoryLoaded = false;
    let itemsLoaded = false;

    const checkComplete = () => {
      if (subCategoryLoaded && itemsLoaded && isMountedRef.current) {
        setIsLoading(false);
      }
    };

    // Subscribe to sub-category
    subCatUnsubRef.current = realtimeSubCategoriesAPI.subscribeById(
      id,
      (sub) => {
        if (!isMountedRef.current) return;
        setSubCategory(sub);
        subCategoryLoaded = true;

        // Subscribe to parent category once we have the sub-category
        if (sub?.category_id) {
          if (categoryUnsubRef.current) categoryUnsubRef.current();
          categoryUnsubRef.current = realtimeCategoriesAPI.subscribeById(
            sub.category_id,
            (cat) => {
              if (isMountedRef.current) {
                setCategory(cat);
              }
            },
            (error) => {
              if (isMountedRef.current) {
                console.error("Failed to load category:", error);
              }
            }
          );
        } else {
          setCategory(null);
        }

        checkComplete();
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load subcategory:", error);
        }
      }
    );

    // Subscribe to items
    itemsUnsubRef.current = realtimeInventoryItemsAPI.subscribeBySubCategory(
      id,
      (itms) => {
        if (!isMountedRef.current) return;
        setItems(itms);
        itemsLoaded = true;
        checkComplete();
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load items:", error);
        }
      }
    );

    return () => {
      subCatUnsubRef.current?.();
      categoryUnsubRef.current?.();
      itemsUnsubRef.current?.();
    };
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;

    const itemsToMigrate = items.filter(
      (item) => item.id && item.status === "out" && !item.recipient_name && !migratedRecipientItemIdsRef.current.has(item.id)
    );

    for (const item of itemsToMigrate) {
      migratedRecipientItemIdsRef.current.add(item.id!);
      void (async () => {
        try {
          const transactions = await inventoryTransactionsAPI.getByItem(item.id!);
          const removalTransaction = transactions
            .filter((transaction) => transaction.type === "removal" && transaction.recipient_name)
            .sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""))[0];

          if (removalTransaction?.recipient_name) {
            await inventoryItemsAPI.update(item.id!, {
              recipient_name: removalTransaction.recipient_name,
              site_name: removalTransaction.site_name,
              location: removalTransaction.location,
            });
          }
        } catch (error) {
          console.error(`Failed to migrate recipient for item ${item.id}:`, error);
        }
      })();
    }
  }, [items, isAdmin]);

  // Add items (serial or bulk)
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!storeName.trim()) throw new Error("Store name is required");

      if (addMode === "serial") {
        const sns = serialNumbers.filter((s) => s.trim());
        if (sns.length === 0) throw new Error("At least one serial number required");

        // Create one item per serial number
        for (const sn of sns) {
          const itemId = await inventoryItemsAPI.create({
            serial_number: sn,
            category_id: subCategory!.category_id,
            subcategory_id: id!,
            status: "in",
            owner: "Avira",
            store_name: storeName.trim(),
            supplier_name: supplierName.trim() || undefined,
            purchase_date: purchaseDate || undefined,
          });
          await inventoryTransactionsAPI.create({
            item_id: itemId as string,
            type: "addition",
            created_by: appUser?.fullName || appUser?.email || "Unknown User",
          });
        }
      } else {
        // Bulk: create items without serial numbers
        const qty = Number(bulkQuantity);
        if (!qty || qty < 1) throw new Error("Enter a valid quantity");

        for (let i = 0; i < qty; i++) {
          const itemId = await inventoryItemsAPI.create({
            serial_number: `${Date.now()}-${i + 1}`,
            name: `${subCategory?.name || "Item"} #${i + 1}`,
            category_id: subCategory!.category_id,
            subcategory_id: id!,
            status: "in",
            owner: "Avira",
            store_name: storeName.trim(),
            supplier_name: supplierName.trim() || undefined,
            purchase_date: purchaseDate || undefined,
          });
          await inventoryTransactionsAPI.create({
            item_id: itemId as string,
            type: "addition",
            created_by: appUser?.fullName || appUser?.email || "Unknown User",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategory-items", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(addMode === "serial" ? "Items added" : "Bulk items added");
      closeAddDialog();
    },
    onError: (err: any) => toast.error(err.message || "Failed to add items"),
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const parsed = issueSchema.parse({ recipient_name: recipient, notes: notes || undefined });
      await inventoryItemsAPI.update(issueItemId!, {
        status: "out",
        recipient_name: parsed.recipient_name,
      });
      await inventoryTransactionsAPI.create({
        item_id: issueItemId!,
        type: "removal",
        recipient_name: parsed.recipient_name,
        site_name: "", // Will be populated when needed
        created_by: appUser?.fullName || appUser?.email || "Unknown User",
        notes: parsed.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategory-items", id] });
      toast.success("Item issued");
      setIssueOpen(false);
      setIssueItemId(null);
      setRecipient("");
      setNotes("");
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error("Failed to issue item");
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const sn = editSerialNumber.trim();
      if (!sn) throw new Error("Serial number required");
      await inventoryItemsAPI.update(editItemId!, { serial_number: sn });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategory-items", id] });
      toast.success("Item updated");
      setEditOpen(false);
      setEditItemId(null);
      setEditSerialNumber("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update item"),
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      await inventoryItemsAPI.update(revertItemId!, { status: "in" });
      await inventoryTransactionsAPI.create({
        item_id: revertItemId!,
        type: "revert",
        created_by: appUser?.fullName || appUser?.email || "Unknown User",
        notes: revertNotes || "Item reverted to stock",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategory-items", id] });
      toast.success("Item reverted to stock");
      setRevertOpen(false);
      setRevertItemId(null);
      setRevertNotes("");
    },
    onError: (err: any) => {
      toast.error("Failed to revert item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => inventoryItemsAPI.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategory-items", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Item deleted");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const closeAddDialog = () => {
    setAddOpen(false);
    setAddMode("serial");
    setSerialNumbers([]);
    setBulkQuantity("");
    setStoreName("");
    setSupplierName("");
    setPurchaseDate("");
  };

  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set(items.map(i => i.supplier_name).filter(Boolean));
    return Array.from(suppliers).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const filterLower = filter.toLowerCase();

    return items.filter((i) => {
      const serialMatch = i.serial_number?.toLowerCase().includes(filterLower);
      const nameMatch = i.name?.toLowerCase().includes(filterLower);
      const searchMatches = serialMatch || nameMatch;

      const supplierMatches = supplierFilter === "all" || !supplierFilter || i.supplier_name === supplierFilter;

      return searchMatches && supplierMatches;
    });
  }, [items, filter, supplierFilter]);

  // Calculate statistics
  const totalItems = items.length;
  const itemStats = useMemo(() => {
    let inStockCount = 0;
    let issuedCount = 0;

    items.forEach((item) => {
      if (item.status === "in") inStockCount += 1;
      else if (item.status === "out") issuedCount += 1;
    });

    return { inStockCount, issuedCount };
  }, [items]);

  const openEdit = (item: any) => {
    setEditItemId(item.id);
    setEditSerialNumber(item.serial_number || "");
    setEditOpen(true);
  };

  // Function to fetch item details from Firestore
  const fetchItemDetailsFromFirestore = async (serialNumber: string) => {
    try {
      const item = items.find((i) => i.serial_number === serialNumber);
      if (item) {
        return {
          name: item.name,
          status: item.status,
          store_name: item.store_name,
          owner: item.owner,
        };
      }
      return null;
    } catch (err) {
      console.error("Error fetching item details:", err);
      return null;
    }
  };

  // Handle scanned items from FastBarcodeScanner
  const handleScannedItems = (scannedItems: ScannedItem[]) => {
    setSerialNumbers(scannedItems.map((item) => item.serialNumber));
  };

  const handleDeleteClick = (itemId: string) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only administrators can delete items");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this item?")) {
      return;
    }

    deleteMutation.mutate(itemId);
  };

  const exportCSV = () => {
    if (!filtered?.length) {
      toast.error("No items to export");
      return;
    }
    const headers = ["Serial Number", "Status", "Recipient", "Supplier", "Purchase", "Store Added", "Added"];
    const rows = filtered.map((i: any) => [
      i.serial_number || "",
      i.status === "in" ? "In Stock" : "Issued",
      i.id && recipientMap[i.id] ? recipientMap[i.id].name : "—",
      i.supplier_name || "—",
      i.purchase_date ? format(new Date(i.purchase_date), "MMM d, yyyy") : "—",
      i.store_name || "—",
      i.created_at ? format(new Date(i.created_at), "MMM d, yyyy") : "—",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subCategory?.name || "items"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/categories/${subCategory?.category_id || ""}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            {category && <span className="truncate">{category.name} /</span>}
            <span className="truncate">{subCategory?.name ?? "Sub Category"}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground truncate">{subCategory?.name ?? "Sub Category"}</h1>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
            {subCategory?.model_no && <span>Model: {subCategory.model_no}</span>}
            {subCategory?.supplier_name && <span>Supplier: {subCategory.supplier_name}</span>}
          </div>
          {subCategory?.description && (
            <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{subCategory.description}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={exportCSV} className="gap-2" title="Export as CSV">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Items
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card className="bg-blue-50 dark:bg-blue-950 animate-fade-in">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{totalItems}</p>
              <p className="text-xs text-muted-foreground mt-2">Total Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 animate-fade-in" style={{ animationDelay: "50ms" }}>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <p className="text-3xl font-bold text-success">{itemStats.inStockCount}</p>
              </div>
              <p className="text-xs text-muted-foreground">In Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <p className="text-3xl font-bold text-destructive">{itemStats.issuedCount}</p>
              </div>
              <p className="text-xs text-muted-foreground">Issued</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input
          placeholder="Search by serial number or name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        {filter && (
          <Button variant="ghost" size="sm" onClick={() => setFilter("")}>
            <X className="h-4 w-4" /> Clear
          </Button>
        )}

        {uniqueSuppliers.length > 0 && (
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {uniqueSuppliers.map((supplier) => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[6cm] min-w-[6cm] max-w-[6cm] whitespace-normal break-words">Recipient</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-sm font-semibold">
                      {item.serial_number || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.status === "in" ? "default" : "destructive"}
                        className="font-medium"
                      >
                        {item.status === "in" ? "✓ In Stock" : "↗ Issued"}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[6cm] min-w-[6cm] max-w-[6cm] whitespace-normal break-words text-sm text-muted-foreground">
                      {item.status === "out" ? item.recipient_name || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.supplier_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.purchase_date ? format(new Date(item.purchase_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.created_at ? format(new Date(item.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit serial number"
                          onClick={() => openEdit(item)}
                          className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {item.status === "in" && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Issue this item"
                            onClick={() => { setIssueItemId(item.id!); setIssueOpen(true); }}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <ArrowUpFromLine className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === "out" && isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Revert this item to stock"
                            onClick={() => { setRevertItemId(item.id!); setRevertOpen(true); }}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete this item"
                          onClick={() => handleDeleteClick(item.id!)}
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Items Found</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                {filter
                  ? `No items match your search for "${filter}"`
                  : "No items added to this category yet. Start by adding some items."}
              </p>
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Items
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Items Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && closeAddDialog()}>
        <DialogContent className="w-[95vw] max-w-md sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10 pb-4">
            <DialogTitle className="text-lg">Add Items to {subCategory?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-2">Choose how you want to add items to inventory</p>
          </DialogHeader>
          <div className="space-y-4 px-0">
            {/* Store Name Dropdown */}
            <div className="space-y-2">
              <Label className="font-semibold">Store Name *</Label>
              <Select value={storeName} onValueChange={setStoreName}>
                <SelectTrigger className="text-sm">
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

            {/* Supplier Name */}
            <div className="space-y-2">
              <Label className="font-semibold">Supplier Name</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Enter supplier name"
                maxLength={200}
                className="text-sm"
              />
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label className="font-semibold">Purchase Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Mode selector */}
            <div className="grid gap-2 grid-cols-2">
              <Button
                variant={addMode === "serial" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("serial")}
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" /> Serial Numbers
              </Button>
              <Button
                variant={addMode === "bulk" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("bulk")}
                className="gap-2"
              >
                <Package className="h-3.5 w-3.5" /> Bulk Items
              </Button>
            </div>

            {addMode === "serial" ? (
              <div className="space-y-3">
                <Label className="font-semibold">Serial Numbers *</Label>
                <FastBarcodeScanner
                  onScannedItems={handleScannedItems}
                  existingSerialNumbers={items.map((item) => item.serial_number || "")}
                  enableSound={true}
                  enableHighlight={true}
                  fetchItemDetails={fetchItemDetailsFromFirestore}
                />
                {serialNumbers.length > 0 && (
                  <p className="text-xs text-muted-foreground font-medium bg-green-50 dark:bg-green-950 p-2 rounded-lg">
                    ✓ {serialNumbers.length} item{serialNumbers.length !== 1 ? "s" : ""} ready to add
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Label className="font-semibold">Quantity *</Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(e.target.value)}
                  placeholder="Enter number of items"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
                  Items will be created without serial numbers
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 bg-white dark:bg-slate-950 pt-4 mt-4 border-t gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeAddDialog}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Edit Item Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Serial Number
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">Serial Number *</Label>
              <Input
                value={editSerialNumber}
                onChange={(e) => setEditSerialNumber(e.target.value)}
                placeholder="Enter new serial number"
                maxLength={200}
                className="text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && editMutation.mutate()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editSerialNumber.trim()}>
              {editMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Item Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                <ArrowUpFromLine className="h-5 w-5 text-destructive" />
              </div>
              Issue Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">Recipient Name *</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Who is receiving this?"
                maxLength={200}
                className="text-sm"
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
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
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

      {/* Revert Item Dialog */}
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              Revert Item to Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This will change the item status from "Issued" back to "In Stock".
              </p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Revert Reason</Label>
              <Input
                value={revertNotes}
                onChange={(e) => setRevertNotes(e.target.value)}
                placeholder="Why is this item being reverted? (e.g., Mistakenly issued)"
                maxLength={500}
                className="text-sm"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevertOpen(false)}>Cancel</Button>
            <Button
              onClick={() => revertMutation.mutate()}
              disabled={revertMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {revertMutation.isPending ? "Reverting..." : "Revert to Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
