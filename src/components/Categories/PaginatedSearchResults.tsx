import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category, SubCategory, InventoryItem } from "@/integrations/firebase/firestore";

interface SearchResult {
  type: "category" | "item";
  id: string;
  name?: string;
  serial_number?: string;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  categories?: Category;
  sub_categories?: SubCategory;
  inventory_items?: InventoryItem[];
  store_name?: string;
  status?: string;
  owner?: string;
  recipient_name?: string;
  notes?: string;
}

interface PaginatedSearchResultsProps {
  searchResults: SearchResult[];
  itemsPerPage?: number;
}

const RESULTS_PER_PAGE = 10;

export function PaginatedSearchResults({
  searchResults,
  itemsPerPage = RESULTS_PER_PAGE,
}: PaginatedSearchResultsProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return searchResults.slice(startIndex, endIndex);
  }, [searchResults, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(searchResults.length / itemsPerPage);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-2">
        {paginatedResults.map((result) => (
          <div
            key={result.id}
            className={`rounded-lg border p-3 sm:p-4 hover:bg-muted/50 transition-colors ${
              result.type === "category" ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 cursor-pointer" : ""
            }`}
            onClick={() => {
              if (result.type === "category") {
                navigate(`/categories/${result.id}`);
              }
            }}
          >
            <div className="space-y-2 sm:space-y-3">
              {result.type === "category" && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white flex-shrink-0">
                      <FolderOpen className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
                      <p className="font-semibold text-foreground text-sm sm:text-base truncate">{result.name}</p>
                    </div>
                  </div>
                  {result.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 ml-8">
                      {result.description}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 ml-8 border-t">
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">Sub-categories</p>
                      <p className="font-semibold text-foreground">{result.sub_categories?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">Items</p>
                      <p className="font-semibold text-foreground">{result.inventory_items?.length ?? 0}</p>
                    </div>
                  </div>
                </>
              )}

              {result.type === "item" && (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Serial Number</p>
                    <div className="font-mono text-xs sm:text-sm bg-primary/10 px-2 py-1 rounded border border-primary/20 inline-block">
                      {result.serial_number || "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
                      <p className="font-semibold text-foreground truncate">{result.categories?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Sub Category</p>
                      <p className="font-semibold text-foreground truncate">{result.sub_categories?.name || "—"}</p>
                    </div>
                  </div>

                  {result.store_name && (
                    <div className="text-xs sm:text-sm border-t pt-2 sm:pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Store Added</p>
                      <p className="font-semibold text-foreground">{result.store_name}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm border-t pt-2 sm:pt-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                      <p className={`font-semibold ${result.status === "in" ? "text-success" : "text-destructive"}`}>
                        {result.status === "in" ? "In Stock" : "Issued"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Owner</p>
                      <p className="text-foreground truncate">{result.owner || "—"}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-8 px-2 text-xs"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-8 px-2 text-xs"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
