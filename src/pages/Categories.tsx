import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesAPI, subCategoriesAPI, inventoryItemsAPI, Category, SubCategory, InventoryItem } from "@/integrations/firebase/firestore";
import { realtimeCategoriesAPI, realtimeSubCategoriesAPI, realtimeInventoryItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FolderOpen, Package, Trash2, Pencil, Search, X, Lock, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/config";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { CategoryCard } from "@/components/Categories/CategoryCard";
import { PaginatedSearchResults } from "@/components/Categories/PaginatedSearchResults";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().trim().max(500, "Description too long").optional(),
});

const subCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  model_no: z.string().trim().max(100, "Model number too long").optional(),
  supplier_name: z.string().trim().max(100, "Supplier name too long").optional(),
  description: z.string().trim().max(500, "Description too long").optional(),
});

type DialogMode = "category" | "subcategory";

export default function Categories() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("category");
  const [editId, setEditId] = useState<string | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Real-time subscriptions
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categoriesUnsubRef = useRef<(() => void) | null>(null);
  const subCategoriesUnsubRef = useRef<(() => void) | null>(null);
  const itemsUnsubRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let loadedCount = 0;
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === 3 && isMountedRef.current) setIsLoading(false);
    };

    // Subscribe to categories
    categoriesUnsubRef.current = realtimeCategoriesAPI.subscribeAll(
      (cats) => {
        if (isMountedRef.current) {
          setAllCategories(cats);
          checkComplete();
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load categories:", error);
          checkComplete();
        }
      }
    );

    // Subscribe to sub-categories
    subCategoriesUnsubRef.current = realtimeSubCategoriesAPI.subscribeAll(
      (subCats) => {
        if (isMountedRef.current) {
          setAllSubCategories(subCats);
          checkComplete();
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load subcategories:", error);
          checkComplete();
        }
      }
    );

    // Subscribe to inventory items
    itemsUnsubRef.current = realtimeInventoryItemsAPI.subscribeAll(
      (items) => {
        if (isMountedRef.current) {
          setAllItems(items);
          checkComplete();
        }
      },
      (error) => {
        if (isMountedRef.current) {
          console.error("Failed to load inventory items:", error);
          checkComplete();
        }
      }
    );

    return () => {
      // Cleanup subscriptions
      categoriesUnsubRef.current?.();
      subCategoriesUnsubRef.current?.();
      itemsUnsubRef.current?.();
    };
  }, []);

  // Compute categories with counts
  const categories = allCategories.map((cat) => ({
    ...cat,
    inventory_items: allItems.filter((item) => item.category_id === cat.id),
    sub_categories: allSubCategories.filter((sub) => sub.category_id === cat.id),
  }));

  const searchResults = searchQuery.trim() === "" ? [] : (() => {
    const query = searchQuery.toLowerCase();

    // Search categories by name and description
    const matchedCategories = (allCategories || []).filter((cat) => {
      const name = cat.name?.toLowerCase() || "";
      const desc = cat.description?.toLowerCase() || "";
      return name.includes(query) || desc.includes(query);
    }).map((cat) => ({
      type: "category" as const,
      id: cat.id,
      ...cat,
      _displayName: cat.name,
      inventory_items: allItems.filter((item) => item.category_id === cat.id),
      sub_categories: allSubCategories.filter((sub) => sub.category_id === cat.id),
    }));

    // Search items by serial number
    const matchedItems = (allItems || []).filter((item) => {
      const serial = item.serial_number?.toLowerCase() || "";
      return serial.includes(query);
    }).map((item) => {
      const category = allCategories.find((cat) => cat.id === item.category_id);
      const subCategory = item.subcategory_id
        ? allSubCategories.find((sub) => sub.id === item.subcategory_id)
        : null;
      return {
        type: "item" as const,
        ...item,
        categories: category,
        sub_categories: subCategory,
      };
    });

    return [...matchedCategories, ...matchedItems];
  })();
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialogMode === "category") {
        const parsed = categorySchema.parse({ name, description });
        if (editId) {
          await categoriesAPI.update(editId, {
            name: parsed.name,
            ...(parsed.description ? { description: parsed.description } : {}),
          });
          return { categoryId: editId, isUpdate: true };
        } else {
          const docId = await categoriesAPI.create({
            name: parsed.name,
            ...(parsed.description ? { description: parsed.description } : {}),
          });
          return { categoryId: docId, isUpdate: false };
        }
      } else {
        const parsed = subCategorySchema.parse({ name, model_no: modelNo, supplier_name: supplierName, description });
        if (editId) {
          await subCategoriesAPI.update(editId, {
            name: parsed.name,
            ...(parsed.description ? { description: parsed.description } : {}),
            ...(parsed.model_no ? { model_no: parsed.model_no } : {}),
            ...(parsed.supplier_name ? { supplier_name: parsed.supplier_name } : {}),
          });
        } else {
          await subCategoriesAPI.create({
            name: parsed.name,
            category_id: parentCategoryId!,
            ...(parsed.description ? { description: parsed.description } : {}),
            ...(parsed.model_no ? { model_no: parsed.model_no } : {}),
            ...(parsed.supplier_name ? { supplier_name: parsed.supplier_name } : {}),
          });
        }
        return { categoryId: null, isUpdate: false };
      }
    },
    onSuccess: async (result) => {
      // Handle icon upload for categories
      if (dialogMode === "category" && result?.categoryId && selectedIconFile) {
        try {
          const iconUrl = await uploadCategoryIcon(result.categoryId);
          if (iconUrl) {
            await categoriesAPI.update(result.categoryId, { iconUrl });
          }
        } catch (error) {
          console.error("Icon upload error:", error);
          toast.error("Category saved, but icon upload failed");
        }
      }

      // Invalidate the enriched categories query so counts are recalculated
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editId ? `${dialogMode} updated` : `${dialogMode} created`);
      closeDialog();
    },
    onError: (err: any) => {
      if (err.issues) toast.error(err.issues[0].message);
      else toast.error(`Failed to save ${dialogMode}: ${err.message || "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (params: { id: string; isSubCategory?: boolean }) => {
      if (!isAdmin) {
        throw new Error("Only admins can delete categories");
      }
      if (params.isSubCategory) {
        await subCategoriesAPI.delete(params.id);
      } else {
        await categoriesAPI.delete(params.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Deleted successfully");
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    },
    onError: (err: any) => toast.error(`Failed to delete: ${err.message || "Unknown error"}`),
  });

  const handleDeleteClick = (cat: any) => {
    if (!isAdmin) {
      toast.error("Only admins can delete categories");
      return;
    }
    setCategoryToDelete(cat);
    setDeleteConfirmOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogMode("category");
    setEditId(null);
    setParentCategoryId(null);
    setName("");
    setDescription("");
    setModelNo("");
    setSupplierName("");
    setSelectedIconFile(null);
    setIconPreview("");
  };

  const openEditCategory = (cat: any) => {
    setDialogMode("category");
    setEditId(cat.id);
    setName(cat.name);
    setDescription(cat.description || "");
    setIconPreview(cat.iconUrl || "");
    setSelectedIconFile(null);
    setDialogOpen(true);
  };

  const openAddSubCategory = (categoryId: string) => {
    setDialogMode("subcategory");
    setParentCategoryId(categoryId);
    setEditId(null);
    setName("");
    setDescription("");
    setModelNo("");
    setSupplierName("");
    setSelectedIconFile(null);
    setIconPreview("");
    setDialogOpen(true);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file for the icon");
      return;
    }

    setSelectedIconFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIconPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadCategoryIcon = async (categoryId: string): Promise<string | null> => {
    if (!selectedIconFile) return null;

    try {
      setUploadingIcon(true);
      const filePath = `categories/${categoryId}/icon_${Date.now()}_${selectedIconFile.name}`;

      const { data, error } = await supabase.storage
        .from("company-logos")
        .upload(filePath, selectedIconFile, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      setSelectedIconFile(null);
      setIconPreview("");
      return urlData.publicUrl;
    } catch (error: any) {
      toast.error("Failed to upload icon");
      throw error;
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleRemoveIcon = () => {
    setSelectedIconFile(null);
    setIconPreview("");
    toast.success("Icon removed");
  };

  // Calculate totals
  const totalSubCategories = categories?.reduce((sum, cat: any) => sum + (cat.sub_categories?.length ?? 0), 0) ?? 0;
  const totalItems = categories?.reduce((sum, cat: any) => sum + (cat.inventory_items?.length ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Manage product categories and sub categories</p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => setSearchOpen(true)} className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <span className="sm:hidden">Search</span>
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Category</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32 sm:h-40" />
            </Card>
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat: any) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              isAdmin={isAdmin}
              onEdit={openEditCategory}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 px-4">
            <FolderOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40 mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground">No categories yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="w-[95%] sm:w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg sm:text-xl">
              {dialogMode === "category"
                ? editId ? "Edit Category" : "New Category"
                : editId ? "Edit Sub Category" : "New Sub Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm">{dialogMode === "category" ? "Category Name" : "Sub Category Name"} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={dialogMode === "category" ? "e.g. Camera, Network Devices" : "e.g. 2MP Camera, 4MP Camera"}
                maxLength={100}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
            {dialogMode === "subcategory" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-xs sm:text-sm">Model No (optional)</Label>
                  <Input
                    id="model"
                    value={modelNo}
                    onChange={(e) => setModelNo(e.target.value)}
                    placeholder="e.g. DS-2CD1023G0"
                    maxLength={100}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier" className="text-xs sm:text-sm">Supplier Name (optional)</Label>
                  <Input
                    id="supplier"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Hikvision, Dahua"
                    maxLength={100}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-xs sm:text-sm">Description (optional)</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                maxLength={500}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
            {dialogMode === "category" && (
              <div className="space-y-2">
                <Label htmlFor="icon" className="text-xs sm:text-sm">Category Icon (optional)</Label>
                <div className="flex flex-col gap-2 sm:gap-3">
                  {iconPreview && (
                    <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/10">
                        <img
                          src={iconPreview}
                          alt="Icon preview"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            console.error("Failed to load icon preview");
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">Icon selected</p>
                        <p className="text-xs text-muted-foreground">Will be uploaded on save</p>
                      </div>
                      <button
                        onClick={handleRemoveIcon}
                        type="button"
                        className="text-red-600 hover:text-red-700 transition-colors flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      id="icon"
                      type="file"
                      accept="image/*"
                      onChange={handleIconUpload}
                      className="hidden"
                      disabled={uploadingIcon}
                    />
                    <label htmlFor="icon">
                      <Button
                        variant="outline"
                        className="w-full gap-2 cursor-pointer text-xs sm:text-sm h-9 sm:h-10"
                        asChild
                        disabled={uploadingIcon}
                      >
                        <span>
                          <Upload className="h-4 w-4" />
                          {iconPreview ? "Change Icon" : "Upload Icon"}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" onClick={closeDialog} className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto">
              {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="w-[95%] sm:w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg sm:text-xl">Delete Category?</DialogTitle>
          </DialogHeader>
          {categoryToDelete && (
            <div className="space-y-3 sm:space-y-4 py-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:p-4">
                <p className="font-semibold text-sm sm:text-base text-foreground">{categoryToDelete.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">This category contains:</p>
                <ul className="text-xs sm:text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                  <li>• {categoryToDelete.inventory_items?.length ?? 0} items</li>
                  <li>• {categoryToDelete.sub_categories?.length ?? 0} sub-categories</li>
                </ul>
              </div>

              {(categoryToDelete.inventory_items?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">
                    ⚠️ This category has {categoryToDelete.inventory_items?.length ?? 0} item(s) inside
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    All items and their transaction records will be permanently deleted along with this category.
                  </p>
                </div>
              )}

              <p className="text-xs sm:text-sm text-muted-foreground">
                Are you sure you want to delete this category and all its contents? This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial">
              Cancel
            </Button>
            {(categoryToDelete?.inventory_items?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  navigate(`/categories/${categoryToDelete.id}`);
                  setDeleteConfirmOpen(false);
                }}
                className="text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial"
              >
                View Items
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate({ id: categoryToDelete.id })}
              disabled={deleteMutation.isPending}
              className="text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-initial"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="w-[95%] sm:w-full max-w-2xl mx-auto max-h-[85vh] flex flex-col p-3 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg sm:text-xl">Search Categories & Items</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3 sm:mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by category name or serial number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-xl border-border bg-muted/30 pl-10 pr-10 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/30"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {searchQuery.trim() === "" ? (
            <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center flex-1">
              <Search className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40 mb-3 sm:mb-4" />
              <p className="text-xs sm:text-sm text-muted-foreground">Search by category name or item serial number</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center flex-1">
              <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40 mb-3 sm:mb-4" />
              <p className="text-xs sm:text-sm text-muted-foreground">No categories or items found for "{searchQuery}"</p>
            </div>
          ) : (
            <PaginatedSearchResults searchResults={searchResults} itemsPerPage={10} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
