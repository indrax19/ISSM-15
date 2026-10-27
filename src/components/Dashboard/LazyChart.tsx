import { Suspense, lazy, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LazyChartProps {
  title: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyChart({ title, children, fallback }: LazyChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <Suspense fallback={fallback || <div className="h-[200px] bg-muted/50 rounded animate-pulse" />}>
          {children}
        </Suspense>
      </CardContent>
    </Card>
  );
}
