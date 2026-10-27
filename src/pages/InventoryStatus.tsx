import { useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Category, InventoryItem, SubCategory } from "@/integrations/firebase/firestore";
import { realtimeCategoriesAPI, realtimeSubCategoriesAPI, realtimeInventoryItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { useFirestoreRealtimeData } from "@/hooks/useFirestoreRealtimeQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, FolderOpen, ChevronDown, ChevronRight, ArrowRight, Plus } from "lucide-react";

export default function InventoryStatus() {
  const { status } = useParams<{ status: "in" | "out" }>();
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const subscribeCategories = useCallback(
    (callback: (data: Category[]) => void, onError?: (error: Error) => void) =>
      realtimeCategoriesAPI.subscribeAll(callback, onError),
    []
  );

  const subscribeSubCategories = useCallback(
    (callback: (data: SubCategory[]) => void, onError?: (error: Error) => void) =>
      realtimeSubCategoriesAPI.subscribeAll(callback, onError),
    []
  );

  const subscribeItemsByStatus = useCallback(
    (callback: (data: InventoryItem[]) => void, onError?: (error: Error) => void) =>
      realtimeInventoryItemsAPI.subscribeByStatus(status!, callback, onError),
    [status]
  );

  const {
    data: allCategories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useFirestoreRealtimeData<Category[]>({
    queryKey: ["categories-live"],
    subscribeFn: subscribeCategories,
    initialData: [],
  });

  const {
    data: allSubCategories,
    isLoading: subCategoriesLoading,
    error: subCategoriesError,
  } = useFirestoreRealtimeData<SubCategory[]>({
    queryKey: ["subcategories-live"],
    subscribeFn: subscribeSubCategories,
    initialData: [],
  });

  const {
    data: itemsByStatus,
    isLoading: itemsLoading,
    error: itemsError,
  } = useFirestoreRealtimeData<InventoryItem[]>({
    queryKey: ["inventory-items-live", status],
    subscribeFn: subscribeItemsByStatus,
    initialData: [],
    enabled: !!status,
  });

  const isLoading = categoriesLoading || subCategoriesLoading || itemsLoading;
  const error = categoriesError || subCategoriesError || itemsError;

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((previousState) => {
      const nextState = new Set(previousState);

      if (nextState.has(categoryId)) {
        nextState.delete(categoryId);
      } else {
        nextState.add(categoryId);
      }

      return nextState;
    });
  };

  const categoryLookups = useMemo(() => {
    const subCategoriesByCategory = new Map<string, SubCategory[]>();
    const itemsByCategory = new Map<string, InventoryItem[]>();
    const itemsBySubCategory = new Map<string, InventoryItem[]>();

    allSubCategories.forEach((subCategory) => {
      if (!subCategory.category_id) return;
      const list = subCategoriesByCategory.get(subCategory.category_id) || [];
      list.push(subCategory);
      subCategoriesByCategory.set(subCategory.category_id, list);
    });

    itemsByStatus.forEach((item) => {
      if (item.subcategory_id) {
        const list = itemsBySubCategory.get(item.subcategory_id) || [];
        list.push(item);
        itemsBySubCategory.set(item.subcategory_id, list);
      } else if (item.category_id) {
        const list = itemsByCategory.get(item.category_id) || [];
        list.push(item);
        itemsByCategory.set(item.category_id, list);
      }
    });

    return { subCategoriesByCategory, itemsByCategory, itemsBySubCategory };
  }, [allSubCategories, itemsByStatus]);

  const allCategoriesWithItems = useMemo(() => {
    return allCategories
      .map((category) => {
        const subCategories = (categoryLookups.subCategoriesByCategory.get(category.id) || [])
          .map((subCategory) => ({
            ...subCategory,
            inventory_items: categoryLookups.itemsBySubCategory.get(subCategory.id) || [],
          }))
          .filter((subCategory) => subCategory.inventory_items.length > 0);

        const categoryItems = categoryLookups.itemsByCategory.get(category.id) || [];

        return {
          ...category,
          inventory_items: categoryItems,
          subcategories: subCategories,
        };
      })
      .filter((category) => category.inventory_items.length > 0 || category.subcategories.length > 0);
  }, [allCategories, categoryLookups]);

  const uniqueStores = useMemo(
    () => Array.from(
      new Set(
        allCategoriesWithItems.flatMap((category) => [
          ...(category.inventory_items?.map((item) => item.store_name).filter(Boolean) || []),
          ...(category.subcategories?.flatMap((subCategory) =>
            subCategory.inventory_items?.map((item) => item.store_name).filter(Boolean)
          ) || []),
        ])
      )
    ).sort() as string[],
    [allCategoriesWithItems]
  );

  const categories = useMemo(() => {
    if (!selectedStore) {
      return allCategoriesWithItems;
    }

    return allCategoriesWithItems
      .map((category) => ({
        ...category,
        inventory_items: category.inventory_items?.filter((item) => item.store_name === selectedStore),
        subcategories: category.subcategories
          ?.map((subCategory) => ({
            ...subCategory,
            inventory_items: subCategory.inventory_items?.filter((item) => item.store_name === selectedStore),
          }))
          .filter((subCategory) => subCategory.inventory_items?.length > 0),
      }))
      .filter((category) => category.inventory_items?.length > 0 || category.subcategories?.length > 0);
  }, [allCategoriesWithItems, selectedStore]);

  const totalItems = categories.reduce((sum, category) => {
    const directItems = category.inventory_items?.length || 0;
    const subItems = category.subcategories?.reduce(
      (subTotal, subCategory) => subTotal + (subCategory.inventory_items?.length || 0),
      0
    ) || 0;

    return sum + directItems + subItems;
  }, 0);

  const isInStock = status === "in";
  const title = isInStock ? "In Stock" : "Issued Out";
  const description = isInStock
    ? "Categories with items currently in inventory"
    : "Categories with items that have been issued";
  const uniqueCategories = categories.length;
  const statsCards = [
    { label: "Total Items", value: totalItems, color: "bg-blue-50 dark:bg-blue-950" },
    { label: "Categories", value: uniqueCategories, color: "bg-purple-50 dark:bg-purple-950" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4 px-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-9 w-9 sm:h-10 sm:w-10">
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground line-clamp-1">{title}</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 sm:py-6 text-xs sm:text-sm text-destructive">
            Failed to load live inventory status. Please try again.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={stat.label} className={`${stat.color} animate-fade-in`} style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground">{isLoading ? "--" : stat.value}</p>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && uniqueStores.length > 0 && (
        <div className="space-y-2">
          <span className="block text-xs sm:text-sm font-medium text-muted-foreground px-0">Filter by Store:</span>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button
              variant={selectedStore === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStore("")}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              All Stores
            </Button>
            {uniqueStores.map((store) => (
              <Button
                key={store}
                variant={selectedStore === store ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStore(store)}
                className="text-xs sm:text-sm h-8 sm:h-9 truncate max-w-xs"
              >
                {store}
              </Button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 sm:space-y-3">
          {[1, 2, 3].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="h-24 sm:h-28" />
            </Card>
          ))}
        </div>
      ) : categories.length > 0 ? (
        <div className="space-y-2 sm:space-y-3">
          {categories.map((category, index) => {
            const totalCategoryItems = (category.inventory_items?.length || 0) +
              (category.subcategories?.reduce(
                (sum, subCategory) => sum + (subCategory.inventory_items?.length || 0),
                0
              ) || 0);
            const isExpanded = expandedCategories.has(category.id || "");
            const hasSubcategories = Boolean(category.subcategories && category.subcategories.length > 0);

            return (
              <div key={category.id} className="space-y-1.5 sm:space-y-2 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <Card
                  className={`transition-all duration-200 ${hasSubcategories ? "cursor-pointer hover:border-primary/30 hover:shadow-md active:shadow-lg" : ""}`}
                  onClick={() => hasSubcategories && category.id && toggleCategory(category.id)}
                >
                  <CardHeader className="p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        {hasSubcategories ? (
                          <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-primary" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                          <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg flex-shrink-0 ${isInStock ? "bg-success/10" : "bg-destructive/10"}`}>
                            <FolderOpen className={`h-4 w-4 sm:h-5 sm:w-5 ${isInStock ? "text-success" : "text-destructive"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-sm sm:text-base">{category.name}</CardTitle>
                            {category.description && (
                              <p className="mt-0.5 sm:mt-1 line-clamp-1 text-xs text-muted-foreground">{category.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                        <Badge variant={isInStock ? "default" : "destructive"} className="whitespace-nowrap text-xs sm:text-sm">
                          {totalCategoryItems}
                        </Badge>
                        {!hasSubcategories && category.id && (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/categories/${category.id}`)} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {isExpanded && hasSubcategories && (
                  <div className="ml-2.5 sm:ml-4 space-y-1.5 sm:space-y-2 border-l-2 border-primary/30 pl-2.5 sm:pl-4">
                    {category.subcategories.map((subCategory) => (
                      <Card key={subCategory.id} className="bg-muted/40 transition-all duration-200 hover:shadow-sm">
                        <CardHeader className="p-3 sm:p-4 py-2 sm:py-3">
                          <div className="flex items-center justify-between gap-2 sm:gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                              <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded flex-shrink-0 ${isInStock ? "bg-success/10" : "bg-destructive/10"}`}>
                                <FolderOpen className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isInStock ? "text-success/70" : "text-destructive/70"}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <CardTitle className="truncate text-xs sm:text-sm">{subCategory.name}</CardTitle>
                                {subCategory.description && (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{subCategory.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                              <Badge variant="outline" className="whitespace-nowrap text-xs">
                                {subCategory.inventory_items?.length || 0}
                              </Badge>
                              {subCategory.id && (
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/subcategories/${subCategory.id}`)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="mb-3 sm:mb-4 rounded-full bg-muted p-3 sm:p-4">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-base sm:text-lg font-semibold text-foreground text-center">
              No {isInStock ? "items in stock" : "issued items"} found
            </h3>
            <p className="mb-6 max-w-xs text-center text-xs sm:text-sm text-muted-foreground">
              {selectedStore
                ? `No ${isInStock ? "items in stock" : "issued items"} in "${selectedStore}" store`
                : isInStock
                  ? "All your inventory has been issued out or no items have been added yet"
                  : "No items have been issued yet"}
            </p>
            {isInStock && (
              <Button onClick={() => navigate("/scan")} className="gap-2 text-xs sm:text-sm h-9 sm:h-10">
                <Plus className="h-4 w-4" /> Add Items
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
