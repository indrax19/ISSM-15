import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { X, Beaker, Volume2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FastBarcodeScannerProps {
  onScannedItems: (items: ScannedItem[]) => void;
  existingSerialNumbers?: string[];
  enableSound?: boolean;
  enableHighlight?: boolean;
  fetchItemDetails?: (serialNumber: string) => Promise<any>;
}

export interface ScannedItem {
  serialNumber: string;
  timestamp: number;
  itemDetails?: any;
  isLoading?: boolean;
}

export function FastBarcodeScanner({
  onScannedItems,
  existingSerialNumbers = [],
  enableSound = true,
  enableHighlight = true,
  fetchItemDetails,
}: FastBarcodeScannerProps) {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [lastScannedIndex, setLastScannedIndex] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const duplicateWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context for beeping
  useEffect(() => {
    if (enableSound && !audioRef.current) {
      // Create audio element for beep sound
      const audio = new Audio();
      // Use a data URL for a simple beep sound
      audio.src = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==";
      audioRef.current = audio;
    }
  }, [enableSound]);

  // Cleanup duplicate warning timeout on unmount
  useEffect(() => {
    return () => {
      if (duplicateWarningTimeoutRef.current) {
        clearTimeout(duplicateWarningTimeoutRef.current);
      }
    };
  }, []);

  // Notify parent of scanned items changes
  useEffect(() => {
    onScannedItems(scannedItems);
  }, [scannedItems, onScannedItems]);

  const playBeep = useCallback(() => {
    if (enableSound && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Silently ignore audio play errors
        });
      } catch (e) {
        // Silently ignore audio errors
      }
    }
  }, [enableSound]);

  const addScannedItem = useCallback(
    async (serialNumber: string) => {
      const trimmed = serialNumber.trim();

      if (!trimmed) return;

      // Check for duplicates
      const isDuplicate =
        scannedItems.some((item) => item.serialNumber === trimmed) ||
        existingSerialNumbers.includes(trimmed);

      if (isDuplicate) {
        setShowDuplicateWarning(true);
        if (duplicateWarningTimeoutRef.current) {
          clearTimeout(duplicateWarningTimeoutRef.current);
        }
        duplicateWarningTimeoutRef.current = setTimeout(() => setShowDuplicateWarning(false), 2000);
        return;
      }

      playBeep();

      // Create new item
      const newItem: ScannedItem = {
        serialNumber: trimmed,
        timestamp: Date.now(),
        isLoading: !!fetchItemDetails,
      };

      setScannedItems((prev) => {
        const updated = [...prev, newItem];
        setLastScannedIndex(updated.length - 1);
        return updated;
      });

      // Fetch item details if function provided
      if (fetchItemDetails) {
        try {
          const details = await fetchItemDetails(trimmed);
          setScannedItems((prev) =>
            prev.map((item) =>
              item.serialNumber === trimmed
                ? { ...item, itemDetails: details, isLoading: false }
                : item
            )
          );
        } catch (err) {
          setScannedItems((prev) =>
            prev.map((item) =>
              item.serialNumber === trimmed
                ? { ...item, isLoading: false }
                : item
            )
          );
        }
      }

      // Clear input
      setManualInput("");
      inputRef.current?.focus();
    },
    [scannedItems, existingSerialNumbers, fetchItemDetails, playBeep]
  );

  const handleManualInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addScannedItem(manualInput);
    }
  };

  const removeItem = (index: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleScan = (code: string) => {
    addScannedItem(code);
    setScannerOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Manual Input Field */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Manual Entry or USB Scanner</label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={handleManualInput}
            placeholder="Type/scan serial number and press Enter"
            className="text-sm"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            className="gap-2"
            title="Open barcode camera scanner"
          >
            📷
          </Button>
        </div>
      </div>

      {/* Duplicate Warning */}
      {showDuplicateWarning && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-200">
            This serial number is already in the list or exists in inventory
          </p>
        </div>
      )}

      {/* Scanned Items List */}
      {scannedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Scanned Items ({scannedItems.length})
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setScannedItems([]);
              }}
              className="text-xs text-muted-foreground"
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scannedItems.map((item, index) => (
              <div
                key={`${item.serialNumber}-${item.timestamp}`}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  enableHighlight && lastScannedIndex === index
                    ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 ring-2 ring-green-300 dark:ring-green-700"
                    : "bg-muted/50 border-border hover:bg-muted"
                }`}
              >
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="font-mono font-semibold text-sm break-all">
                    {item.serialNumber}
                  </div>
                  {item.isLoading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Loading details...
                    </p>
                  )}
                  {item.itemDetails && (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {item.itemDetails.name && (
                        <p className="line-clamp-1">
                          <span className="font-medium">Name:</span>{" "}
                          {item.itemDetails.name}
                        </p>
                      )}
                      {item.itemDetails.status && (
                        <p>
                          <span className="font-medium">Status:</span>{" "}
                          <Badge variant="outline" className="ml-1 text-xs">
                            {item.itemDetails.status}
                          </Badge>
                        </p>
                      )}
                      {item.itemDetails.store_name && (
                        <p>
                          <span className="font-medium">Store:</span>{" "}
                          {item.itemDetails.store_name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 flex-shrink-0"
                  title="Remove this item"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded-lg">
            {enableHighlight && lastScannedIndex !== null && (
              <div className="flex items-center gap-1 mb-1">
                <Beaker className="h-3 w-3" /> Last scanned item highlighted in green
              </div>
            )}
            {enableSound && (
              <div className="flex items-center gap-1">
                <Volume2 className="h-3 w-3" /> Audio feedback enabled
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scanner Dialog */}
      {scannerOpen && (
        <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Scan Barcode</DialogTitle>
            </DialogHeader>
            <BarcodeScanner onScan={handleScan} active={scannerOpen} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
