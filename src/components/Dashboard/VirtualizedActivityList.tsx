import { useMemo } from "react";
import { format } from "date-fns";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { InventoryTransaction, InventoryItem, Category } from "@/integrations/firebase/firestore";

interface ActivityItem {
  id: string;
  type: "addition" | "removal" | "revert";
  item?: InventoryItem | null;
  category?: Category | null;
  recipient_name?: string;
  created_at?: string;
}

interface VirtualizedActivityListProps {
  transactions: ActivityItem[];
  itemsPerPage?: number;
}

export function VirtualizedActivityList({
  transactions,
  itemsPerPage = 20,
}: VirtualizedActivityListProps) {
  const displayedTransactions = useMemo(() => transactions.slice(0, itemsPerPage), [transactions, itemsPerPage]);

  return (
    <div className="max-h-96 space-y-2 sm:space-y-3 overflow-y-auto pr-2">
      {displayedTransactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between gap-2 rounded-lg border p-2 sm:p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full flex-shrink-0 ${
                transaction.type === "addition"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {transaction.type === "addition" ? (
                <ArrowDownToLine className="h-3 w-3 sm:h-4 sm:w-4" />
              ) : (
                <ArrowUpFromLine className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">
                {transaction.item?.name || transaction.item?.serial_number || "Item removed"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {transaction.category?.name || "Uncategorized"}
                {transaction.recipient_name && ` → ${transaction.recipient_name}`}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {transaction.created_at ? format(new Date(transaction.created_at), "MMM d") : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
