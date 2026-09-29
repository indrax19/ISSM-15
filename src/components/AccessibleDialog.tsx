import React from "react";
import { Dialog, DialogContent, DialogTitle, VisuallyHidden } from "@/components/ui/dialog";

interface AccessibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  hideTitle?: boolean;
  contentClassName?: string;
}

/**
 * AccessibleDialog ensures that all dialogs have an accessible title
 * for screen readers, either visible or hidden.
 */
export function AccessibleDialog({
  open,
  onOpenChange,
  title,
  children,
  hideTitle = false,
  contentClassName,
}: AccessibleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        {hideTitle ? (
          <VisuallyHidden>
            <DialogTitle>{title}</DialogTitle>
          </VisuallyHidden>
        ) : (
          <DialogTitle>{title}</DialogTitle>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
