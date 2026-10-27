import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ClickableRustdeskIdProps {
  rustdeskId?: string;
  className?: string;
  showIcon?: boolean;
}

export default function ClickableRustdeskId({
  rustdeskId,
  className = "font-mono text-slate-900",
  showIcon = false,
}: ClickableRustdeskIdProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!rustdeskId) {
    return <span className={className}>—</span>;
  }

  // ✅ Clean ID globally (fix)
  const cleanId = rustdeskId.replace(/\D/g, '');

  const handleOpenApp = () => {
    navigator.clipboard.writeText(cleanId);

    // ✅ This auto-fills + connects in RustDesk
    const rustdeskUrl = `rustdesk://connect?remote_id=${cleanId}`;
    window.location.href = rustdeskUrl;

    toast.success(`Opening RustDesk (ID: ${cleanId})`);
    setIsOpen(false);
  };

  const handleCopyId = () => {
    navigator.clipboard
      .writeText(cleanId)
      .then(() => {
        toast.success(`Copied: ${cleanId}`);
      })
      .catch(() => {
        toast.error("Failed to copy");
      });

    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={`${className} cursor-pointer rounded px-2 py-1 transition-colors hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200`}
            title={`RustDesk ID: ${cleanId}`}
            type="button"
          >
            {showIcon && <ExternalLink className="inline h-4 w-4 mr-1" />}
            {cleanId}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={handleOpenApp}>
            <ExternalLink className="h-4 w-4 mr-2" />
            <span>Open in RustDesk App</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleCopyId}>
            <Copy className="h-4 w-4 mr-2" />
            <span>Copy ID to Clipboard</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}