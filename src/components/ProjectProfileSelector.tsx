import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CompanyProfile {
  id: string;
  company_name?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
}

interface ProjectProfileSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (profileId: string) => void;
}

export function ProjectProfileSelector({
  open,
  onOpenChange,
  onSelect,
}: ProjectProfileSelectorProps) {
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Company Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-gray-600">
            Choose which company profile to use for the PDF report
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No company profiles found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {profiles.map((profile, index) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedId(profile.id)}
                  className={`w-full text-left p-3 rounded transition-colors flex items-start gap-3 ${
                    selectedId === profile.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  {profile.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt={profile.company_name}
                      className={`h-6 w-6 rounded object-contain flex-shrink-0 mt-0.5 ${
                        selectedId === profile.id ? "bg-white p-1" : "bg-white p-1"
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      {profile.company_name || "Company"}
                    </p>
                    {profile.email && (
                      <p className={`text-xs ${selectedId === profile.id ? "text-blue-100" : "text-gray-600"}`}>
                        {profile.email}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
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
