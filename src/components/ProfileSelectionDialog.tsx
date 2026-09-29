import { memo, useCallback } from "react";
import { CompanyProfile } from "@/integrations/firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "./LoadingSpinner";

interface ProfileSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: CompanyProfile[];
  selectedProfileId: string | null;
  onProfileSelect: (profileId: string) => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  isConfirming?: boolean;
  confirmLabel?: string;
  description?: string;
  associatedProfileName?: string;
}

const ProfileSelectionDialog = memo(function ProfileSelectionDialog({
  open,
  onOpenChange,
  profiles,
  selectedProfileId,
  onProfileSelect,
  onConfirm,
  isLoading = false,
  isConfirming = false,
  confirmLabel = "Download PDF",
  description = "Choose which company profile to use for this delivery challan PDF:",
  associatedProfileName,
}: ProfileSelectionDialogProps) {
  const handleConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      if (!isConfirming) {
        onOpenChange(newOpen);
      }
    },
    [isConfirming, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Company Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {description}
          </p>

          {associatedProfileName && (
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">Associated Profile:</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">{associatedProfileName}</p>
            </div>
          )}

          {isLoading ? (
            <div className="py-8">
              <LoadingSpinner text="Loading profiles..." />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No company profiles found. Please create one in Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profiles.map((profile) => (
                <Button
                  key={profile.id}
                  variant={selectedProfileId === profile.id ? "default" : "outline"}
                  className="w-full justify-start transition-colors"
                  onClick={() => onProfileSelect(profile.id || "")}
                  disabled={isConfirming}
                >
                  <div className="flex items-center gap-3 w-full">
                    {profile.logo_url && (
                      <img
                        src={profile.logo_url}
                        alt={profile.company_name}
                        className="h-8 w-8 rounded object-contain bg-muted p-1"
                        loading="lazy"
                      />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-sm">{profile.company_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isConfirming || isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming || isLoading || profiles.length === 0}
              className="relative"
            >
              {isConfirming ? (
                <>
                  <span className="invisible">{confirmLabel}</span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  </div>
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default ProfileSelectionDialog;
