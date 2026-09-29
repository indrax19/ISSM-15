import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { Loader2, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SiteDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId?: string;
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
};

export default function SiteDetailsModal({ open, onOpenChange, siteId }: SiteDetailsModalProps) {
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !siteId) {
      setSite(null);
      return;
    }

    const fetchSite = async () => {
      setIsLoading(true);
      try {
        const siteData = await siteDetailsAPI.getById(siteId);
        setSite(siteData);
      } catch (error) {
        console.error("Failed to load site details:", error);
        toast.error("Failed to load site details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSite();
  }, [open, siteId]);

  const handleCopy = (text: string, label: string, field: string) => {
    if (!text) return;
    copyToClipboard(text, label);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, label, field }: { text: string; label: string; field: string }) => {
    if (!text) return null;
    return (
      <button
        onClick={() => handleCopy(text, label, field)}
        className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors inline-flex items-center"
        title="Copy to clipboard"
      >
        {copiedField === field ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4 text-gray-500" />
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Site Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : !site ? (
          <div className="py-8 text-center text-gray-600">
            No site details found
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {site.millName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Mill Name</p>
                    <p className="text-sm text-gray-900 mt-1">{site.millName}</p>
                  </div>
                )}
                {site.siteName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Site Name</p>
                    <p className="text-sm text-gray-900 mt-1">{site.siteName}</p>
                  </div>
                )}
                {site.millLocation && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Location</p>
                    <p className="text-sm text-gray-900 mt-1">{site.millLocation}</p>
                  </div>
                )}
                {site.unitNo && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Unit No</p>
                    <p className="text-sm text-gray-900 mt-1">{site.unitNo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {site.supervisorName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Supervisor Name</p>
                    <p className="text-sm text-gray-900 mt-1">{site.supervisorName}</p>
                  </div>
                )}
                {site.technicianName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Technician Name</p>
                    <p className="text-sm text-gray-900 mt-1">{site.technicianName}</p>
                  </div>
                )}
                {site.pocName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">POC Name</p>
                    <p className="text-sm text-gray-900 mt-1">{site.pocName}</p>
                  </div>
                )}
                {site.pocContact && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">POC Contact</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.pocContact}</p>
                      <CopyButton text={site.pocContact} label="POC Contact" field="pocContact" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Network Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Network Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {site.tailscaleIp && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Tailscale IP</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.tailscaleIp}</p>
                      <CopyButton text={site.tailscaleIp} label="Tailscale IP" field="tailscaleIp" />
                    </div>
                  </div>
                )}
                {site.liveIp && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Live IP</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.liveIp}</p>
                      <CopyButton text={site.liveIp} label="Live IP" field="liveIp" />
                    </div>
                  </div>
                )}
                {site.pcNic && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">PC NIC</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.pcNic}</p>
                      <CopyButton text={site.pcNic} label="PC NIC" field="pcNic" />
                    </div>
                  </div>
                )}
                {site.subnet && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Subnet</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.subnet}</p>
                      <CopyButton text={site.subnet} label="Subnet" field="subnet" />
                    </div>
                  </div>
                )}
                {site.defaultGateway && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Default Gateway</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.defaultGateway}</p>
                      <CopyButton text={site.defaultGateway} label="Default Gateway" field="defaultGateway" />
                    </div>
                  </div>
                )}
                {site.dns && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">DNS</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.dns}</p>
                      <CopyButton text={site.dns} label="DNS" field="dns" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* NVR Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">NVR Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {site.nvrIp && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">NVR IP-1</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.nvrIp}</p>
                      <CopyButton text={site.nvrIp} label="NVR IP-1" field="nvrIp" />
                    </div>
                  </div>
                )}
                {site.nvrIp2 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">NVR IP-2</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.nvrIp2}</p>
                      <CopyButton text={site.nvrIp2} label="NVR IP-2" field="nvrIp2" />
                    </div>
                  </div>
                )}
                {site.nvrUsername && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">NVR Username</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.nvrUsername}</p>
                      <CopyButton text={site.nvrUsername} label="NVR Username" field="nvrUsername" />
                    </div>
                  </div>
                )}
                {site.nvrPassword && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">NVR Password</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.nvrPassword} label="NVR Password" field="nvrPassword" />
                    </div>
                  </div>
                )}
                {site.cameraUsername && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Camera Username</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.cameraUsername}</p>
                      <CopyButton text={site.cameraUsername} label="Camera Username" field="cameraUsername" />
                    </div>
                  </div>
                )}
                {site.cameraPassword && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Camera Password</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.cameraPassword} label="Camera Password" field="cameraPassword" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Remote Access Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Remote Access Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {site.anydeskId && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">AnyDesk ID (Primary)</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.anydeskId}</p>
                      <CopyButton text={site.anydeskId} label="AnyDesk ID" field="anydeskId" />
                    </div>
                  </div>
                )}
                {site.anydeskPassword && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">AnyDesk Password</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.anydeskPassword} label="AnyDesk Password" field="anydeskPassword" />
                    </div>
                  </div>
                )}
                {site.anydeskId2 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">AnyDesk ID (Secondary)</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.anydeskId2}</p>
                      <CopyButton text={site.anydeskId2} label="AnyDesk ID (Secondary)" field="anydeskId2" />
                    </div>
                  </div>
                )}
                {site.anydeskPassword2 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">AnyDesk Password (Secondary)</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.anydeskPassword2} label="AnyDesk Password (Secondary)" field="anydeskPassword2" />
                    </div>
                  </div>
                )}
                {site.rustdeskId && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">RustDesk ID (Primary)</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.rustdeskId}</p>
                      <CopyButton text={site.rustdeskId} label="RustDesk ID" field="rustdeskId" />
                    </div>
                  </div>
                )}
                {site.rustdeskPassword && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">RustDesk Password</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.rustdeskPassword} label="RustDesk Password" field="rustdeskPassword" />
                    </div>
                  </div>
                )}
                {site.rustdeskId2 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">RustDesk ID (Secondary)</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.rustdeskId2}</p>
                      <CopyButton text={site.rustdeskId2} label="RustDesk ID (Secondary)" field="rustdeskId2" />
                    </div>
                  </div>
                )}
                {site.rustdeskPassword2 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">RustDesk Password (Secondary)</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.rustdeskPassword2} label="RustDesk Password (Secondary)" field="rustdeskPassword2" />
                    </div>
                  </div>
                )}
                {site.remoteanydeskAccountName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Remote AnyDesk Account</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.remoteanydeskAccountName}</p>
                      <CopyButton text={site.remoteanydeskAccountName} label="Remote AnyDesk Account" field="remoteanydeskAccountName" />
                    </div>
                  </div>
                )}
                {site.remoteanydeskPassword && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Remote AnyDesk Password</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                      <CopyButton text={site.remoteanydeskPassword} label="Remote AnyDesk Password" field="remoteanydeskPassword" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GPU Information */}
            {site.gpuUserName && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-900">GPU Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">GPU Username</p>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900 mt-1">{site.gpuUserName}</p>
                      <CopyButton text={site.gpuUserName} label="GPU Username" field="gpuUserName" />
                    </div>
                  </div>
                  {site.gpuPassword && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-600">GPU Password</p>
                      <div className="flex items-center">
                        <p className="text-sm text-gray-900 mt-1 font-mono">••••••••</p>
                        <CopyButton text={site.gpuPassword} label="GPU Password" field="gpuPassword" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cameras */}
            {site.cameras && site.cameras.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-900">Cameras</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {site.cameras.map((camera, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-600">{camera.name}</p>
                      {camera.ip && (
                        <div className="flex items-center mt-2">
                          <p className="text-sm text-gray-900">{camera.ip}</p>
                          <CopyButton text={camera.ip} label={`${camera.name} IP`} field={`camera-${index}`} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-900">Status Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {site.hardwareCompleted !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Hardware Completed</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {site.hardwareCompleted ? (
                        <Badge className="bg-green-100 text-green-800">Yes</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">No</Badge>
                      )}
                    </p>
                  </div>
                )}
                {site.dataCopy !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Data Copy</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {site.dataCopy ? (
                        <Badge className="bg-green-100 text-green-800">Yes</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">No</Badge>
                      )}
                    </p>
                  </div>
                )}
                {site.roiCreated !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">ROI Created</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {site.roiCreated ? (
                        <Badge className="bg-green-100 text-green-800">Yes</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">No</Badge>
                      )}
                    </p>
                  </div>
                )}
                {site.completionCertificate !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Completion Certificate</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {site.completionCertificate ? (
                        <Badge className="bg-green-100 text-green-800">Yes</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">No</Badge>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details */}
            {site.additionalDetails && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-900">Additional Details</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{site.additionalDetails}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
