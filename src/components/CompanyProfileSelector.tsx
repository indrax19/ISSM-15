import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

interface CompanyProfile {
  id: string;
  company_name?: string;
  email?: string;
  phone?: string;
}

interface CompanyProfileSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (profileId: string) => void;
}

export function CompanyProfileSelector({
  open,
  onOpenChange,
  onSelect,
}: CompanyProfileSelectorProps) {
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const allProfiles = await companyProfileAPI.getAll();
      setProfiles(allProfiles);
      if (allProfiles.length > 0) {
        setSelectedId(allProfiles[0].id);
      }
    } catch (error) {
      console.error("Failed to load company profiles:", error);
      toast.error("Failed to load company profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedId) {
      onSelect(selectedId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Select Company Profile
          </DialogTitle>
          <DialogDescription>
            Choose which company profile to use for the PDF report
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-8 text-center text-gray-600">
            <p>No company profiles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedId(profile.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedId === profile.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold text-gray-900">
                  {profile.company_name || "Company"}
                </div>
                {profile.email && (
                  <div className="text-sm text-gray-600 mt-1">{profile.email}</div>
                )}
                {profile.phone && (
                  <div className="text-sm text-gray-600">{profile.phone}</div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedId || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
