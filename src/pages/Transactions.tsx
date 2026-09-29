import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { inventoryTransactionsAPI } from "@/integrations/firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function Transactions() {
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, pageSize, selectedRecipient, pageCursors[page]],
    queryFn: () => inventoryTransactionsAPI.getPageWithRelated(page, pageSize, selectedRecipient, pageCursors[page]),
    placeholderData: (previousData) => previousData,
  });
  const transactions = data?.transactions ?? [];
  const totalTransactions = data?.total ?? 0;

  // ✅ Get unique recipients
  const recipients = useMemo(() => {
    const unique = new Set(transactions.map((t: any) => t.recipient_name).filter(Boolean));
    if (selectedRecipient !== "all") unique.add(selectedRecipient);
    return Array.from(unique);
  }, [transactions, selectedRecipient]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalTransactions / pageSize));
  const paginatedTransactions = transactions;

  useEffect(() => {
    setPage(1);
    setPageCursors({});
  }, [selectedRecipient, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
            Transaction Log
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Audit trail of all inventory movements
          </p>
        </div>

        {/* Recipient Filter */}
        <div className="w-full md:w-auto">
          <select
            className="w-full md:w-auto border rounded-md px-3 py-2 text-xs sm:text-sm bg-background"
            value={selectedRecipient}
            onChange={(e) => setSelectedRecipient(e.target.value)}
            aria-label="Filter by recipient"
          >
            <option value="all">All Recipients</option>
            {recipients.map((r: string) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden sm:block">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 sm:p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : totalTransactions > 0 ? (
            <div className="min-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Type</TableHead>
                    <TableHead className="text-xs sm:text-sm">Serial</TableHead>
                    <TableHead className="hidden md:table-cell text-xs sm:text-sm">Category</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Recipient</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Modified By</TableHead>
                    <TableHead className="hidden xl:table-cell text-xs sm:text-sm max-w-[200px]">Notes</TableHead>
                    <TableHead className="text-xs sm:text-sm">Date & Time</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedTransactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge
                          variant={
                            t.type === "addition" ? "default" : t.type === "revert" ? "secondary" : "destructive"
                          }
                          className="gap-1 text-xs"
                        >
                          {t.type === "addition" ? (
                            <ArrowDownToLine className="h-3 w-3" />
                          ) : t.type === "revert" ? (
                            <RefreshCw className="h-3 w-3" />
                          ) : (
                            <ArrowUpFromLine className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline">
                            {t.type === "addition" ? "Added" : t.type === "revert" ? "Reverted" : "Issued"}
                          </span>
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs sm:text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">
                            {t.inventory_items?.name ||
                              t.inventory_items?.serial_number}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {t.inventory_items?.serial_number}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                        {t.categories?.name || "—"}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                        {t.recipient_name || "—"}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm font-medium">
                        {t.created_by || "—"}
                      </TableCell>

                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {t.notes || "—"}
                      </TableCell>

                      <TableCell className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {format(
                          new Date(t.created_at),
                          "MMM d, yyyy"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 sm:py-12 text-center text-xs sm:text-sm text-muted-foreground">
              No transactions found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Loading...
          </div>
        ) : totalTransactions > 0 ? (
          paginatedTransactions.map((t: any) => (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant={
                      t.type === "addition" ? "default" : t.type === "revert" ? "secondary" : "destructive"
                    }
                    className="gap-1 text-xs flex-shrink-0"
                  >
                    {t.type === "addition" ? (
                      <ArrowDownToLine className="h-3 w-3" />
                    ) : t.type === "revert" ? (
                      <RefreshCw className="h-3 w-3" />
                    ) : (
                      <ArrowUpFromLine className="h-3 w-3" />
                    )}
                    {t.type === "addition" ? "Added" : t.type === "revert" ? "Reverted" : "Issued"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(t.created_at), "MMM d, yyyy")}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground font-medium">Item</p>
                    <p className="font-medium truncate">
                      {t.inventory_items?.name ||
                        t.inventory_items?.serial_number}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs truncate">
                      {t.inventory_items?.serial_number}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground font-medium">Category</p>
                      <p className="truncate">{t.categories?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Recipient</p>
                      <p className="truncate">{t.recipient_name || "—"}</p>
                    </div>
                  </div>

                  {t.created_by && (
                    <div>
                      <p className="text-muted-foreground font-medium">Modified By</p>
                      <p className="truncate">{t.created_by}</p>
                    </div>
                  )}

                  {t.notes && (
                    <div>
                      <p className="text-muted-foreground font-medium">Notes</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No transactions found
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {totalTransactions === 0
            ? "No transactions"
            : `Showing ${(page - 1) * (pageSize === "all" ? totalTransactions : pageSize) + 1}-${Math.min(page * (pageSize === "all" ? totalTransactions : pageSize), totalTransactions)} of ${totalTransactions}`}
        </p>
        <div className="flex items-center gap-3">
          <label htmlFor="transaction-page-size" className="whitespace-nowrap text-xs text-muted-foreground">Rows per page</label>
          <select
            id="transaction-page-size"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(event.target.value === "all" ? "all" : Number(event.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-md border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setPage((current) => current - 1)} disabled={page === 1}>Previous</button>
              <span className="px-2 text-xs text-muted-foreground">{page} / {totalPages}</span>
              <button type="button" className="rounded-md border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50" onClick={() => {
                const lastCreatedAt = transactions[transactions.length - 1]?.created_at;
                if (lastCreatedAt) setPageCursors((current) => ({ ...current, [page + 1]: lastCreatedAt }));
                setPage((current) => current + 1);
              }} disabled={page === totalPages}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
