import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Category, SubCategory } from "@/integrations/firebase/firestore";
import { realtimeCategoriesAPI, realtimeSubCategoriesAPI } from "@/integrations/firebase/realtimeAPI";
import { useFirestoreRealtimeData } from "@/hooks/useFirestoreRealtimeQuery";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HierarchicalCategorySelectProps {
  selectedCategoryId: string;
  selectedSubcategoryId: string;
  onSelectCategory: (categoryId: string, subcategoryId?: string) => void;
  autoFocus?: boolean;
}

export function HierarchicalCategorySelect({
  selectedCategoryId,
  selectedSubcategoryId,
  onSelectCategory,
  autoFocus = false,
}: HierarchicalCategorySelectProps) {
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [subCategorySearch, setSubCategorySearch] = useState("");

  useEffect(() => {
    if (autoFocus && categoryButtonRef.current) {
      categoryButtonRef.current.focus();
    }
  }, [autoFocus]);

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

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useFirestoreRealtimeData<Category[]>({
    queryKey: ["categories-live"],
    subscribeFn: subscribeCategories,
    initialData: [],
  });

  const {
    data: subCategories,
    isLoading: subCategoriesLoading,
    error: subCategoriesError,
  } = useFirestoreRealtimeData<SubCategory[]>({
    queryKey: ["subcategories-live"],
    subscribeFn: subscribeSubCategories,
    initialData: [],
  });

  const subCategoriesMap = useMemo(() => {
    return subCategories.reduce<Record<string, SubCategory[]>>((acc, subCategory) => {
      if (!acc[subCategory.category_id]) {
        acc[subCategory.category_id] = [];
      }

      acc[subCategory.category_id].push(subCategory);
      return acc;
    }, {});
  }, [subCategories]);

  const formatCategoryDisplay = (category: Category) => {
    const parts = [];
    if (category.model_number) parts.push(category.model_number);
    parts.push(category.name);
    if (category.supplier_name) parts.push(category.supplier_name);
    return parts.join(" - ");
  };

  const formatSubcategoryDisplay = (subcategory: SubCategory) => {
    const parts = [];
    if (subcategory.model_no) parts.push(subcategory.model_no);
    parts.push(subcategory.name);
    if (subcategory.supplier_name) parts.push(subcategory.supplier_name);
    return parts.join(" - ");
  };

  const currentSubcategories = selectedCategoryId ? (subCategoriesMap[selectedCategoryId] || []) : [];
  const filteredCategories = categories.filter((category) =>
    formatCategoryDisplay(category).toLowerCase().includes(categorySearch.toLowerCase())
  );
  const filteredSubCategories = currentSubcategories.filter((subCategory) =>
    formatSubcategoryDisplay(subCategory).toLowerCase().includes(subCategorySearch.toLowerCase())
  );
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedSubCategory = currentSubcategories.find((subCategory) => subCategory.id === selectedSubcategoryId);
  const isLoading = categoriesLoading || subCategoriesLoading;
  const error = categoriesError || subCategoriesError;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load categories. Please try again.
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          <Label>Category</Label>
          <Button variant="outline" className="w-full justify-start" disabled>
            Loading categories...
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 text-center">
          No categories found. Create one first.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="category-select">Category *</Label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  ref={categoryButtonRef}
                  id="category-select"
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryOpen}
                  className="w-full justify-between"
                >
                  {selectedCategory ? formatCategoryDisplay(selectedCategory) : "Select a category..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search categories..." value={categorySearch} onValueChange={setCategorySearch} />
                  <CommandList className="max-h-[200px] sm:max-h-[250px] md:max-h-[300px] lg:max-h-[350px]">
                    <CommandGroup>
                      {filteredCategories.length === 0 ? (
                        <CommandEmpty>No category found.</CommandEmpty>
                      ) : (
                        filteredCategories.map((category) => (
                          <CommandItem
                            key={category.id}
                            value={formatCategoryDisplay(category)}
                            onSelect={() => {
                              onSelectCategory(category.id === selectedCategoryId ? "" : category.id!, undefined);
                              setCategoryOpen(false);
                              setCategorySearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedCategoryId === category.id ? "opacity-100" : "opacity-0")} />
                            {formatCategoryDisplay(category)}
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedCategoryId && currentSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subcategory-select">Sub Category</Label>
              <Popover open={subCategoryOpen} onOpenChange={setSubCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="subcategory-select"
                    variant="outline"
                    role="combobox"
                    aria-expanded={subCategoryOpen}
                    className="w-full justify-between"
                  >
                    {selectedSubCategory ? formatSubcategoryDisplay(selectedSubCategory) : "Select a sub category..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search subcategories..." value={subCategorySearch} onValueChange={setSubCategorySearch} />
                    <CommandList className="max-h-[200px] sm:max-h-[250px] md:max-h-[300px] lg:max-h-[350px]">
                      <CommandGroup>
                        {filteredSubCategories.length === 0 ? (
                          <CommandEmpty>No subcategory found.</CommandEmpty>
                        ) : (
                          filteredSubCategories.map((subcategory) => (
                            <CommandItem
                              key={subcategory.id}
                              value={formatSubcategoryDisplay(subcategory)}
                              onSelect={() => {
                                onSelectCategory(selectedCategoryId, subcategory.id === selectedSubcategoryId ? "" : subcategory.id!);
                                setSubCategoryOpen(false);
                                setSubCategorySearch("");
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedSubcategoryId === subcategory.id ? "opacity-100" : "opacity-0")} />
                              {formatSubcategoryDisplay(subcategory)}
                            </CommandItem>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </>
      )}
    </div>
  );
}
