import { memo, useCallback } from "react";
import { Challan } from "@/integrations/firebase/challanAPI";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Pencil, Trash2, ImageIcon, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ChallanTableRowProps {
  challan: Challan;
  onDownloadPDF: (challan: Challan) => void;
  onDelete: (challanId: string) => void;
  onViewSiteData?: (challan: Challan) => void;
}

// Memoized component to prevent re-renders when other table rows update
const ChallanTableRow = memo(function ChallanTableRow({
  challan,
  onDownloadPDF,
  onDelete,
  onViewSiteData,
}: ChallanTableRowProps) {
  const navigate = useNavigate();

  const handleEdit = useCallback(() => {
    navigate(
      challan.challanType === "internal"
        ? `/delivery-challans/${challan.id}?type=internal`
        : `/delivery-challans/${challan.id}`
    );
  }, [challan.id, challan.challanType, navigate]);

  const handleDownload = useCallback(() => {
    onDownloadPDF(challan);
  }, [challan, onDownloadPDF]);

  const handleDelete = useCallback(() => {
    onDelete(challan.id!);
  }, [challan.id, onDelete]);

  const handleViewSiteData = useCallback(() => {
    onViewSiteData?.(challan);
  }, [challan, onViewSiteData]);

  return (
    <TableRow className="hover:bg-muted/50 transition-colors duration-150">
      <TableCell className="font-mono font-medium text-sm">
        {challan.challanNo}
      </TableCell>
      <TableCell className="text-sm">
        {format(new Date(challan.date), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="text-sm">{challan.customerName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {challan.poNumber || "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="transition-colors">
          {challan.equipment?.length || 0} items
        </Badge>
      </TableCell>
      <TableCell>
        {challan.documentUrl ? (
          <div className="relative group">
            <ImageIcon className="h-5 w-5 text-green-600 cursor-pointer transition-colors group-hover:text-green-700" />
            <div className="absolute bottom-full left-0 hidden group-hover:block bg-white border rounded shadow-lg p-2 z-50 mb-2 animate-in fade-in duration-200">
              <img
                src={challan.documentUrl}
                alt="Document preview"
                loading="lazy"
                className="h-32 w-32 object-cover rounded"
              />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={challan.status === "completed" ? "default" : "secondary"}
          className="transition-colors"
        >
          {challan.status || "Draft"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-green-600 hover:bg-green-50 hover:text-green-700 transition-all duration-150"
            onClick={handleViewSiteData}
            title="View site entry data"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline"></span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150"
            onClick={handleEdit}
            title="Edit challan"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline"></span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 hover:text-orange-600 transition-all duration-150"
            onClick={handleDownload}
            title="Download PDF"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline"></span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-150"
            onClick={handleDelete}
            title="Delete challan"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline"></span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if challan data actually changed
  return (
    prevProps.challan.id === nextProps.challan.id &&
    prevProps.challan.updated_at === nextProps.challan.updated_at &&
    prevProps.challan.challanNo === nextProps.challan.challanNo &&
    prevProps.challan.customerName === nextProps.challan.customerName &&
    prevProps.challan.status === nextProps.challan.status &&
    prevProps.challan.documentUrl === nextProps.challan.documentUrl &&
    prevProps.challan.equipment?.length === nextProps.challan.equipment?.length
  );
});

export default ChallanTableRow;
