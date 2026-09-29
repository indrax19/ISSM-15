import { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Eye, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Challan } from "@/integrations/firebase/challanAPI";

interface ChallanMobileCardProps {
  challan: Challan;
  onDownloadPDF: (challan: Challan) => void;
  onDelete: (challanId: string) => void;
  onDuplicate: (challan: Challan) => void;
  onViewSiteData: (challan: Challan) => void;
}

export const ChallanMobileCard = memo(function ChallanMobileCard({
  challan,
  onDownloadPDF,
  onDelete,
  onDuplicate,
  onViewSiteData,
}: ChallanMobileCardProps) {
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
    <Card className="border shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold truncate">{challan.challanNo}</p>
            <p className="text-xs text-muted-foreground mt-1">{formattedDate}</p>
          </div>
          <Badge variant={challan.status === "completed" ? "default" : "secondary"} className="shrink-0">
            {challan.status || "Draft"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Customer / Site</p>
            <p className="font-medium break-words">{challan.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unit</p>
            <p className="font-medium break-words">{challan.unitNo || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unit PO Number</p>
            <p className="font-medium break-words">{challan.poNumber || "—"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Equipment</p>
              <p className="font-medium">{challan.equipment?.length || 0} items</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Document</p>
              <div className="flex items-center gap-2 font-medium">
                {challan.documentUrl ? (
                  <>
                    <ImageIcon className="h-4 w-4 text-green-600" />
                    Uploaded
                  </>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onViewSiteData(challan)}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Site Data</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1"
            onClick={handleEdit}
          >
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1"
            onClick={() => onDownloadPDF(challan)}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1"
            onClick={() => onDuplicate(challan)}
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Duplicate</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete(challan.id!)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

ChallanMobileCard.displayName = "ChallanMobileCard";
