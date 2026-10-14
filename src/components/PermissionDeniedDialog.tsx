import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PermissionDeniedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

const PermissionDeniedDialog = memo(function PermissionDeniedDialog({
  open,
  onOpenChange,
  message = "You do not have permission to perform this action. Only administrators can do this.",
}: PermissionDeniedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Permission Denied</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex gap-3 justify-end pt-4">
            <Button onClick={() => onOpenChange(false)}>OK</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default PermissionDeniedDialog;
