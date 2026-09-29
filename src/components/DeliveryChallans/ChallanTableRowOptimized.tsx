import { memo, useMemo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Download, Pencil, Trash2, Eye, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Challan } from "@/integrations/firebase/challanAPI";

interface ChallanTableRowOptimizedProps {
  challan: Challan;
  onDownloadPDF: (challan: Challan) => void;
  onDelete: (challanId: string) => void;
  onDuplicate: (challan: Challan) => void;
  onViewSiteData: (challan: Challan) => void;
}

export const ChallanTableRowOptimized = memo(function ChallanTableRowOptimized({
  challan,
  onDownloadPDF,
  onDelete,
  onDuplicate,
  onViewSiteData,
}: ChallanTableRowOptimizedProps) {
  const navigate = useNavigate();

  // Memoize formatted date
  const formattedDate = useMemo(
    () => format(new Date(challan.date), "MMM d, yyyy"),
    [challan.date]
  );

  const handleEdit = () => {
    navigate(
      challan.challanType === "internal"
        ? `/delivery-challans/${challan.id}?type=internal`
        : `/delivery-challans/${challan.id}`
    );
  };

  return (
    <TableRow>
      <TableCell className="font-mono font-semibold">{challan.challanNo}</TableCell>
      <TableCell className="text-sm">{formattedDate}</TableCell>
      <TableCell className="text-sm">{challan.customerName}</TableCell>
      <TableCell className="text-sm">{challan.unitNo || "—"}</TableCell>
      <TableCell className="text-sm">{challan.poNumber || "—"}</TableCell>
      <TableCell className="text-sm text-center">{challan.equipment?.length || 0}</TableCell>
      <TableCell className="text-center">
        {challan.documentUrl ? (
          <ImageIcon className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="grid grid-cols-3 gap-1 w-fit justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onViewSiteData(challan)}
            title="View site data"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleEdit}
            title="Edit challan"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onDownloadPDF(challan)}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onDuplicate(challan)}
            title="Duplicate challan"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete(challan.id!)}
            title="Delete challan"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

ChallanTableRowOptimized.displayName = "ChallanTableRowOptimized";
