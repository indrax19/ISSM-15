import { useState, useCallback } from "react";
import { Challan } from "@/integrations/firebase/challanAPI";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Eye, Loader2 } from "lucide-react";
import { downloadSiteDataPDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";

interface SiteDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challan: Challan | null;
}

export default function SiteDataDialog({ open, onOpenChange, challan }: SiteDataDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    if (!challan) return;

    setIsDownloading(true);
    try {
      await downloadSiteDataPDF(challan);
      toast.success("Site data PDF downloaded successfully");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  }, [challan, onOpenChange]);

  if (!challan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Site Entry Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Challan Reference */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Challan:</span> {challan.challanNo} • {" "}
              <span className="font-semibold">Date:</span> {new Date(challan.date).toLocaleDateString()}
            </p>
          </Card>

          {/* Site Information */}
          <div>
            <h3 className="font-semibold text-base mb-3 text-gray-900">Site Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 font-semibold">Customer/Site Name</p>
                  <p className="text-sm text-gray-900">{challan.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-semibold">Site Location</p>
                  <p className="text-sm text-gray-900">{challan.siteLocation || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-semibold">Unit No</p>
                  <p className="text-sm text-gray-900">{challan.unitNo || "Not provided"}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 font-semibold">PO Number</p>
                  <p className="text-sm text-gray-900">{challan.poNumber || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-semibold">Delivery Date</p>
                  <p className="text-sm text-gray-900">{new Date(challan.deliveryDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Point of Contact */}
          <div>
            <h3 className="font-semibold text-base mb-3 text-gray-900">Point of Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 font-semibold">POC Name</p>
                  <p className="text-sm text-gray-900">{challan.pocName || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-semibold">POC Number</p>
                  <p className="text-sm text-gray-900">{challan.pocNumber || "Not provided"}</p>
                </div>
              </div>
              <div>
                <div>
                  <p className="text-xs text-gray-600 font-semibold">Delivered From</p>
                  <p className="text-sm text-gray-900">{challan.deliveredFrom || "Not provided"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Equipment Summary */}
          <div>
            <h3 className="font-semibold text-base mb-3 text-gray-900">Equipment Delivered</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {challan.equipment && challan.equipment.length > 0 ? (
                challan.equipment.map((eq, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{eq.name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                      <p>
                        <span className="font-semibold">Qty:</span> {eq.quantity}
                      </p>
                      <p>
                        <span className="font-semibold">Category:</span> {eq.category_id ? "Yes" : "—"}
                      </p>
                      {eq.serialNumbers && eq.serialNumbers.length > 0 && (
                        <p className="col-span-2">
                          <span className="font-semibold">Serial Numbers:</span> {eq.serialNumbers.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No equipment recorded</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
