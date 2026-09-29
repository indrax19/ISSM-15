import { Copy, ExternalLink, Shield } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ClickableAnydeskIdProps {
  anydeskId?: string;
  className?: string;
  showIcon?: boolean;
}

export default function ClickableAnydeskId({
  anydeskId,
  className = "font-mono text-slate-900",
  showIcon = false,
}: ClickableAnydeskIdProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!anydeskId) {
    return <span className={className}>—</span>;
  }

  // ✅ Clean ID (only numbers)
  const cleanId = anydeskId.replace(/\D/g, "");

  const handleOpenApp = () => {
    navigator.clipboard.writeText(cleanId).catch(() => {});

    // Open AnyDesk app only
    const anydeskUrl = `anydesk://${cleanId}`;
    window.location.href = anydeskUrl;

    toast.success(`Opening AnyDesk (ID: ${cleanId})`);
    setIsOpen(false);
  };

  const handleCopyId = () => {
    navigator.clipboard
      .writeText(cleanId)
      .then(() => toast.success(`Copied: ${cleanId}`))
      .catch(() => toast.error("Failed to copy"));

    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={`${className} cursor-pointer rounded px-2 py-1 transition-colors hover:bg-blue-100 hover:text-blue-700 active:bg-blue-200`}
            title={`AnyDesk ID: ${cleanId}`}
            type="button"
          >
            {cleanId}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={handleOpenApp}>
            <ExternalLink className="h-4 w-4 mr-2" />
            <span>Open in AnyDesk App</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleCopyId}>
            <Copy className="h-4 w-4 mr-2" />
            <span>Copy ID</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showIcon && <Shield className="h-4 w-4 text-blue-600" />}
    </div>
  );
}