import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export default function InvoiceTableSkeleton() {
  return (
    <>
      <div className="md:hidden space-y-3 px-4 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-28 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-20 animate-pulse" />
                </div>
                <div className="h-6 bg-muted rounded w-16 animate-pulse" />
              </div>
              <div className="space-y-3">
                <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                <div className="h-4 bg-muted rounded w-full animate-pulse" />
                <div className="h-3 bg-muted rounded w-20 animate-pulse" />
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-10 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SR #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>PO #</TableHead>
              <TableHead>Mill Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Invoice Amount</TableHead>
              <TableHead>PO Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-8 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-16 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-28 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-28 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <div className="h-8 bg-muted rounded w-14 animate-pulse" />
                    <div className="h-8 bg-muted rounded w-12 animate-pulse" />
                    <div className="h-8 bg-muted rounded w-14 animate-pulse" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
