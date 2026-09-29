import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Package, Pencil, Trash2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Category, SubCategory, InventoryItem } from "@/integrations/firebase/firestore";

interface CategoryCardProps {
  category: Category & {
    inventory_items: InventoryItem[];
    sub_categories: SubCategory[];
  };
  isAdmin: boolean;
  onEdit: (cat: any) => void;
  onDelete: (cat: any) => void;
}

export const CategoryCard = memo(function CategoryCard({
  category: cat,
  isAdmin,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const navigate = useNavigate();
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);

  return (
    <Card
      className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 active:shadow-md active:translate-y-0 group relative overflow-hidden"
      onClick={() => navigate(`/categories/${cat.id}`)}
      onMouseEnter={() => setHoveredCategoryId(cat.id)}
      onMouseLeave={() => setHoveredCategoryId(null)}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <CardHeader className="flex flex-row items-start justify-between pb-2 sm:pb-3 p-3 sm:p-4 relative z-10">
        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Icon with dynamic color */}
          <div
            className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg flex-shrink-0 transition-all duration-300 overflow-hidden ${
              hoveredCategoryId === cat.id
                ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white scale-110"
                : "bg-primary/10 text-primary"
            }`}
          >
            {cat.iconUrl ? (
              <img
                src={cat.iconUrl}
                alt={cat.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <FolderOpen
                className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${
                  hoveredCategoryId === cat.id ? "scale-110" : "scale-100"
                }`}
              />
            )}
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm sm:text-base truncate transition-colors duration-300 group-hover:text-primary">
              {cat.name}
            </CardTitle>
            {cat.description && (
              <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2 group-hover:text-muted-foreground/80 transition-colors duration-300">
                {cat.description}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex gap-1 flex-shrink-0 ml-1 sm:ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-700 active:scale-95 transition-all duration-150"
            onClick={() => onEdit(cat)}
            title="Edit category"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 sm:h-8 sm:w-8 active:scale-95 transition-all duration-150 ${
              isAdmin
                ? "text-red-600 hover:bg-red-100 hover:text-red-700"
                : "text-muted-foreground cursor-not-allowed opacity-50"
            }`}
            onClick={() => onDelete(cat)}
            disabled={!isAdmin}
            title={isAdmin ? "Delete category" : "Only admins can delete categories"}
          >
            {isAdmin ? <Trash2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 border-t pt-2 sm:pt-3 p-3 sm:p-4 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2 transition-colors duration-300 group-hover:text-primary">
            <FolderOpen
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-all duration-300 ${
                hoveredCategoryId === cat.id ? "text-blue-600 scale-110" : "text-foreground"
              }`}
            />
            <span className="font-medium text-foreground">
              {cat.sub_categories?.length ?? 0}{" "}
              <span className="hidden sm:inline">sub-categories</span>
              <span className="sm:hidden">subs</span>
            </span>
          </div>
          <div className="flex items-center gap-2 transition-colors duration-300 group-hover:text-primary">
            <Package
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 transition-all duration-300 ${
                hoveredCategoryId === cat.id ? "text-amber-600 scale-110" : "text-foreground"
              }`}
            />
            <span className="font-medium text-foreground">
              {cat.inventory_items?.filter((item) => item.status === "in").length ?? 0} available items
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CategoryCard.displayName = "CategoryCard";
