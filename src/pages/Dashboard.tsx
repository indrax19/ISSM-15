import { useCallback, useMemo, lazy, Suspense, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Category,
  InventoryItem,
  inventoryTransactionsAPI,
} from "@/integrations/firebase/firestore";
import { realtimeCategoriesAPI, realtimeInventoryItemsAPI } from "@/integrations/firebase/realtimeAPI";
import { useFirestoreRealtimeData } from "@/hooks/useFirestoreRealtimeQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Package, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { CHART_COLORS } from "@/lib/colors";
import { format } from "date-fns";
import { ItemStatusChart, ItemsByCategoryChart, TransactionTrendChart } from "@/components/Dashboard/Charts";

export default function Dashboard() {
  const navigate = useNavigate();
  const subscribeCategories = useCallback(
    (callback: (data: Category[]) => void, onError?: (error: Error) => void) =>
      realtimeCategoriesAPI.subscribeAll(callback, onError),
    []
  );

  const subscribeItems = useCallback(
    (callback: (data: InventoryItem[]) => void, onError?: (error: Error) => void) =>
      realtimeInventoryItemsAPI.subscribeAll(callback, onError),
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
    data: items,
    isLoading: itemsLoading,
    error: itemsError,
  } = useFirestoreRealtimeData<InventoryItem[]>({
    queryKey: ["inventory-items-live"],
    subscribeFn: subscribeItems,
    initialData: [],
  });

  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useQuery({
    queryKey: ["dashboard-transactions"],
    queryFn: () => inventoryTransactionsAPI.getRecent(50),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isLoading = categoriesLoading || itemsLoading || transactionsLoading;
  const error = categoriesError || itemsError || transactionsError;

  const itemStats = useMemo(() => {
    let inStock = 0;
    let out = 0;

    items.forEach((item) => {
      if (item.status === "in") inStock += 1;
      else if (item.status === "out") out += 1;
    });

    return { total: items.length, inStock, out };
  }, [items]);

  const itemCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();

    items.forEach((item) => {
      if (!item.category_id) return;
      counts.set(item.category_id, (counts.get(item.category_id) || 0) + 1);
    });

    return counts;
  }, [items]);

  const categoriesWithItems = useMemo(
    () => categories
      .map((category) => ({
        name: category.name,
        items: itemCountByCategory.get(category.id) || 0,
      }))
      .filter((category) => category.items > 0),
    [categories, itemCountByCategory]
  );

  const transactionsTrend = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return format(date, "MMM dd");
    });

    const trend = last7Days.map((day) => ({
      date: day,
      additions: 0,
      removals: 0,
    }));
    const trendIndex = new Map(last7Days.map((day, index) => [day, index]));

    // Only process transactions from the last 8 days
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    transactions.forEach((transaction) => {
      if (!transaction.created_at) {
        return;
      }

      const transactionDateObj = new Date(transaction.created_at);
      if (transactionDateObj < eightDaysAgo) {
        return; // Skip old transactions
      }

      const transactionDate = format(transactionDateObj, "MMM dd");
      const index = trendIndex.get(transactionDate);

      if (index === undefined) {
        return;
      }

      if (transaction.type === "addition") {
        trend[index].additions += 1;
      } else {
        trend[index].removals += 1;
      }
    });

    return trend;
  }, [transactions]);

  const stats = [
    { label: "Categories", value: categories.length, icon: FolderOpen, color: "text-primary" },
    { label: "Total Items", value: itemStats.total, icon: Package, color: "text-foreground" },
    { label: "In Stock", value: itemStats.inStock, icon: ArrowDownToLine, color: "text-success" },
    { label: "Issued Out", value: itemStats.out, icon: ArrowUpFromLine, color: "text-destructive" },
  ];

  const statusData = [
    { name: "In Stock", value: itemStats.inStock, fill: CHART_COLORS.success },
    { name: "Issued Out", value: itemStats.out, fill: CHART_COLORS.error },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="pr-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Dashboard</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Overview of your inventory</p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 sm:py-6 text-xs sm:text-sm text-destructive">
            Failed to load live inventory data. Please try again.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const isClickable = stat.label === "In Stock" || stat.label === "Issued Out";
          const handleClick = isClickable
            ? () => navigate(`/inventory/${stat.label === "In Stock" ? "in" : "out"}`)
            : undefined;

          return (
            <Card
              key={stat.label}
              className={`${isClickable ? "cursor-pointer transition-shadow hover:shadow-md active:scale-95" : ""}`}
              onClick={handleClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate pr-2">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${stat.color}`} />
              </CardHeader>
              <CardContent className="pb-2 sm:pb-4">
                <div className="text-2xl sm:text-3xl font-bold">{isLoading ? "--" : stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Item Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-2">
            <Suspense fallback={<div className="h-[200px] bg-muted/50 rounded animate-pulse w-full" />}>
              <ItemStatusChart data={statusData} />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Items by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-2 overflow-x-auto">
            <Suspense fallback={<div className="h-[200px] bg-muted/50 rounded animate-pulse w-full" />}>
              <ItemsByCategoryChart data={categoriesWithItems} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base">Transaction Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="p-2 overflow-x-auto">
          <Suspense fallback={<div className="h-[200px] bg-muted/50 rounded animate-pulse w-full" />}>
            <TransactionTrendChart data={transactionsTrend} />
          </Suspense>
        </CardContent>
      </Card>

    </div>
  );
}
