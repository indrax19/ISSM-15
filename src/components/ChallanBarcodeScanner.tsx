import { useState, useCallback, useRef } from "react";
import { inventoryItemsAPI, subCategoriesAPI } from "@/integrations/firebase/firestore";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ScannedResult {
  serialNumber: string;
  name: string;
  category_id: string;
  subcategory_id: string;
  categoryName: string;
  subcategoryName: string;
  owner: string;
  store_name: string;
  itemId: string; // Inventory item ID for later issuance
}

interface ChallanBarcodeScannerProps {
  onScanComplete: (result: ScannedResult) => void;
  onClose: () => void;
}

export function ChallanBarcodeScanner({
  onScanComplete,
  onClose,
}: ChallanBarcodeScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const scanHandledRef = useRef(false);
  const [lastScannedResult, setLastScannedResult] = useState<ScannedResult | null>(
    null
  );
  const [lastError, setLastError] = useState<string | null>(null);


  const handleScan = useCallback(
    async (barcode: string) => {
      const trimmedBarcode = barcode.trim();
      if (!trimmedBarcode || isProcessing || scanHandledRef.current) {
        return;
      }

      scanHandledRef.current = true;
      setScanLocked(true);
      setIsProcessing(true);
      setLastError(null);
      setLastScannedResult(null);

      try {
        // Step 1: Look up the item in inventory by serial number
        const inventoryItem = await inventoryItemsAPI.getBySerialNumber(trimmedBarcode);

        if (!inventoryItem || inventoryItem.status !== "in") {
          setLastError("Not in inventory");
          toast.error("Not in inventory");
          return;
        }

        // Step 2: Get category and subcategory names
        let categoryName = "";
        let subcategoryName = "";

        if (inventoryItem.subcategory_id) {
          const subCategory = await subCategoriesAPI.getById(
            inventoryItem.subcategory_id
          );
          if (subCategory) {
            subcategoryName = subCategory.name || "";
            categoryName = subCategory.name || ""; // We'll use subcategory name as equipment details
          }
        }

        // Step 3: Prepare the scanned result
        const result: ScannedResult = {
          serialNumber: inventoryItem.serial_number || trimmedBarcode,
          name: inventoryItem.name || "",
          category_id: inventoryItem.category_id || "",
          subcategory_id: inventoryItem.subcategory_id || "",
          categoryName: categoryName,
          subcategoryName: subcategoryName,
          owner: inventoryItem.owner || "Avira",
          store_name: inventoryItem.store_name || "",
          itemId: inventoryItem.id || "",
        };

        setLastScannedResult(result);

        // Step 4: Callback to parent component to auto-fill equipment
        // Note: Item will be issued when the challan form is saved
        onScanComplete(result);
        toast.success(`Item verified in inventory: ${trimmedBarcode}`);
      } catch (err: any) {
        const errorMessage = err?.message || "Failed to process scan";
        setLastError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onScanComplete]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3 sticky top-0 bg-background border-b">
          <CardTitle>Scan Barcode - Auto Add to Challan</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              <strong>How it works:</strong> Scan a product barcode. The system will:
              <ol className="mt-2 ml-4 space-y-1 list-decimal text-xs">
                <li>Check if the product exists in inventory</li>
                <li>Auto-fill equipment details</li>
                <li>Issue the item when you save the delivery challan</li>
              </ol>
            </p>
          </div>

          {/* Scanner */}
          <div>
            <BarcodeScanner onScan={handleScan} active={!scanLocked && !isProcessing} />
          </div>

          {/* Last Scanned Result - Success */}
          {lastScannedResult && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-700 dark:text-green-200">
                    Product found in inventory!
                  </p>
                  <div className="mt-2 space-y-2 text-xs text-green-600 dark:text-green-300">
                    <p>
                      <strong>Serial:</strong>{" "}
                      <span className="font-mono">{lastScannedResult.serialNumber}</span>
                    </p>
                    {lastScannedResult.name && (
                      <p>
                        <strong>Name:</strong> {lastScannedResult.name}
                      </p>
                    )}
                    {lastScannedResult.subcategoryName && (
                      <p>
                        <strong>Details:</strong> {lastScannedResult.subcategoryName}
                      </p>
                    )}
                    {lastScannedResult.store_name && (
                      <p>
                        <strong>Store:</strong> {lastScannedResult.store_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLastScannedResult(null);
                  setLastError(null);
                }}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          )}

          {/* Last Scanned Result - Error */}
          {lastError && !lastScannedResult && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-200">
                    {lastError}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    This serial number is not available in inventory. Please check and try
                    again.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLastError(null);
                  scanHandledRef.current = false;
                  setScanLocked(false);
                }}
                className="text-xs"
              >
                Scan Again
              </Button>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                <p className="text-sm text-amber-700 dark:text-amber-200">
                  Processing scan...
                </p>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing}
            >
              Close Scanner
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
