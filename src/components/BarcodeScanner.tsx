import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, RotateCcw } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  active?: boolean;
}

const SCANNER_ID = "barcode-reader";

// ── All major 1D + 2D formats ──────────────────────────────
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.AZTEC,
];

type ScannerState = "idle" | "starting" | "scanning" | "error";

export function BarcodeScanner({ onScan, active = true }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [scanCount, setScanCount] = useState(0);

  // ── Stop & destroy ─────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current || !scannerRef.current) return;
    isStoppingRef.current = true;
    try {
      const state = scannerRef.current.getState();
      if (
        state === Html5QrcodeScannerState.SCANNING ||
        state === Html5QrcodeScannerState.PAUSED
      ) {
        await scannerRef.current.stop();
      }
      await scannerRef.current.clear();
    } catch (err: any) {
      // Silently ignore errors during cleanup (AbortError, etc.)
      if (err?.name !== "AbortError" && err?.code !== "aborted") {
        console.warn("Error stopping scanner:", err?.message);
      }
    }
    finally {
      scannerRef.current = null;
      isStoppingRef.current = false;
      if (isMountedRef.current) setScannerState("idle");
    }
  }, []);

  // ── Start ──────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setErrorMsg("");
    setScannerState("starting");
    lastScannedRef.current = "";

    await stopScanner();

    // Wait for DOM to be ready and React to render the state change
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    if (!isMountedRef.current) return;

    // Ensure the scanner element exists
    const scannerElement = document.getElementById(SCANNER_ID);
    if (!scannerElement) {
      if (isMountedRef.current) {
        setErrorMsg("Camera element not found. Please refresh the page.");
        setScannerState("error");
      }
      return;
    }

    try {
      const scanner = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 20,
          // Wide flat box — critical for 1D linear barcodes (EAN, Code128, UPC)
          qrbox: (w, h) => ({
            width: Math.min(Math.round(w * 0.88), 380),
            height: Math.min(Math.round(h * 0.30), 110),
          }),
          aspectRatio: 1.7777,
          disableFlip: false,
        },
        (decodedText) => {
          if (decodedText === lastScannedRef.current) return;
          lastScannedRef.current = decodedText;

          if (isMountedRef.current) {
            setScanCount((n) => n + 1);
            onScan(decodedText.trim());
          }

          if (cooldownRef.current) clearTimeout(cooldownRef.current);
          cooldownRef.current = setTimeout(() => {
            lastScannedRef.current = "";
          }, 1500);
        },
        () => { }
      );

      if (isMountedRef.current) setScannerState("scanning");
    } catch (err: any) {
      await stopScanner();
      if (!isMountedRef.current) return;

      const name = err?.name ?? "";
      const message = err?.message ?? "";
      let msg = "Could not start camera. Tap Retry to try again.";

      if (name === "NotAllowedError" || name === "PermissionDeniedError")
        msg = "Camera permission denied. Please allow it in browser settings.";
      else if (name === "NotFoundError")
        msg = "No camera found on this device.";
      else if (name === "NotReadableError" || name === "AbortError")
        msg = "Camera is in use by another app. Close it and tap Retry.";
      else if (name === "NotSupportedError" || message.includes("insecure"))
        msg = "Camera requires HTTPS or localhost.";
      else if (message.includes("NotFoundException"))
        msg = "No camera found. Please try another device.";

      console.error("Scanner init error:", { name, message, err });
      setErrorMsg(msg);
      setScannerState("error");
    }
  }, [onScan, stopScanner]);

  // ── React to active prop ───────────────────────────────────
  useEffect(() => {
    if (active) startScanner();
    else stopScanner();
  }, [active, startScanner, stopScanner]);

  // ── Unmount cleanup ────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      stopScanner();
    };
  }, []); // eslint-disable-line

  const isScanning = scannerState === "scanning";
  const isStarting = scannerState === "starting";

  return (
    <div className="flex flex-col items-center gap-3 w-full">

      {/* Viewfinder wrapper */}
      <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-sm bg-black">

        {/* Scanner div — always in DOM, never display:none */}
        <div
          id={SCANNER_ID}
          className="w-full"
          style={{
            minHeight: isScanning || isStarting ? 240 : 0,
            height: isScanning || isStarting ? "auto" : 0,
            visibility: isScanning ? "visible" : "hidden",
            overflow: "hidden",
          }}
        />

        {/* Corner guides overlay */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-primary" />
            <div className="absolute top-5 right-5 w-7 h-7 border-t-2 border-r-2 border-primary" />
            <div className="absolute bottom-5 left-5 w-7 h-7 border-b-2 border-l-2 border-primary" />
            <div className="absolute bottom-5 right-5 w-7 h-7 border-b-2 border-r-2 border-primary" />
            {/* Animated scan line */}
            <div
              className="absolute w-4/5 h-0.5 bg-primary/80"
              style={{ animation: "scanLine 1.8s ease-in-out infinite alternate" }}
            />
          </div>
        )}

        {/* Success flash */}
        {scanCount > 0 && (
          <div
            key={scanCount}
            className="pointer-events-none absolute inset-0 rounded-xl bg-green-400/25"
            style={{ animation: "flashFade 0.6s ease-out forwards" }}
          />
        )}

        {/* Starting overlay */}
        {isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 rounded-xl" style={{ minHeight: 240 }}>
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-white/70">Opening camera…</p>
          </div>
        )}

        {/* Idle / error prompt */}
        {(scannerState === "idle" || scannerState === "error") && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-4">
            <div className="rounded-full bg-muted p-5">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            {errorMsg ? (
              <p className="text-sm text-destructive text-center max-w-xs leading-snug">{errorMsg}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Tap <span className="font-medium text-foreground">Start Scanner</span> to open camera
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hint & Scan Count */}
      {isScanning && (
        <div className="w-full text-center space-y-2">
          <p className="text-xs text-muted-foreground px-2">
            Hold barcode <span className="font-medium text-foreground">flat &amp; steady</span> inside the frame · Good lighting helps
          </p>
          {scanCount > 0 && (
            <p className="text-xs text-green-600 font-medium">
              ✓ {scanCount} barcode{scanCount !== 1 ? 's' : ''} scanned
            </p>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 w-full">
        {isScanning ? (
          <>
            <Button variant="destructive" onClick={stopScanner} className="flex-1 gap-2">
              <CameraOff className="h-4 w-4" /> Stop Scanner
            </Button>
            <Button variant="outline" size="icon" onClick={startScanner} title="Restart">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button onClick={startScanner} disabled={isStarting} className="flex-1 gap-2">
            {isStarting
              ? <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              : <Camera className="h-4 w-4" />}
            {isStarting ? "Starting…" : scannerState === "error" ? "Retry Camera" : "Start Scanner"}
          </Button>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(-55px); opacity: 0.9; }
          100% { transform: translateY(55px);  opacity: 0.9; }
        }
        @keyframes flashFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
