import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export default function ChallanTableSkeleton() {
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
        <Table className="min-w-[1072px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Challan No</TableHead>
              <TableHead className="w-32">Date</TableHead>
              <TableHead className="w-48">Customer / Site</TableHead>
              <TableHead className="w-20">Unit</TableHead>
              <TableHead className="w-36">Unit PO Number</TableHead>
              <TableHead className="w-32">Equipment Count</TableHead>
              <TableHead className="w-24">Document</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-16 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded-full w-16 animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <div className="h-8 bg-muted rounded w-16 animate-pulse" />
                    <div className="h-8 bg-muted rounded w-14 animate-pulse" />
                    <div className="h-8 bg-muted rounded w-16 animate-pulse" />
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
