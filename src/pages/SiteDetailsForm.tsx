import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { siteDetailsAPI, SiteDetails, CameraConfig } from "@/integrations/firebase/siteDetailsAPI";
import { companyProfileAPI, CompanyProfile } from "@/integrations/firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Download, Upload, Camera, Loader2, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportSiteToExcel } from "@/lib/excelExport";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to format date as "13 march 2026"
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// Helper function to parse date from "13 march 2026" back to ISO format
const parseDateFromDisplay = (displayDate: string): string => {
  if (!displayDate) return new Date().toISOString().split("T")[0];
  try {
    const date = new Date(displayDate);
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

// Helper function to convert ISO date to readable display format
const isoToDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "";
  return formatDateForDisplay(new Date(isoDate).toISOString());
};


export default function SiteDetailsForm() {
  const { id, technicalProjectId } = useParams<{ id: string; technicalProjectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form states
  const [supervisorName, setSupervisorName] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [millName, setMillName] = useState("");
  const [millLocation, setMillLocation] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocContact, setPocContact] = useState("");
  const [gpuUserName, setGpuUserName] = useState("");
  const [gpuPassword, setGpuPassword] = useState("Sonicgpu786");
  const [anydeskId, setAnydeskId] = useState("");
  const [anydeskPassword, setAnydeskPassword] = useState("Sonicgpu786");
  const [anydeskId2, setAnydeskId2] = useState("");
  const [anydeskPassword2, setAnydeskPassword2] = useState("Sonicgpu786");
  const [tailscaleIp, setTailscaleIp] = useState("");
  const [remoteanydeskPassword, setRemoteanydeskPassword] = useState("Sonicgpu786");
  const [remoteanydeskAccountName, setRemoteanydeskAccountName] = useState("");
  const [rustdeskId, setRustdeskId] = useState("");
  const [rustdeskPassword, setRustdeskPassword] = useState("Sonicgpu786");
  const [rustdeskId2, setRustdeskId2] = useState("");
  const [rustdeskPassword2, setRustdeskPassword2] = useState("Sonicgpu786");
  const [pcNic, setPcNic] = useState("");
  const [subnet, setSubnet] = useState("");
  const [defaultGateway, setDefaultGateway] = useState("");
  const [liveIp, setLiveIp] = useState("");
  const [nvrIp, setNvrIp] = useState("");
  const [nvrIp2, setNvrIp2] = useState("");
  const [nvrUsername, setNvrUsername] = useState("admin");
  const [nvrPassword, setNvrPassword] = useState("Sonicnvr786");
  const [cameraUsername, setCameraUsername] = useState("admin");
  const [cameraPassword, setCameraPassword] = useState("Sonicnvr786");
  const [cameras, setCameras] = useState<CameraConfig[]>([
    { id: "0", name: "Camera 1", ip: "" },
  ]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [hardwareCompleted, setHardwareCompleted] = useState(false);
  const [dataCopy, setDataCopy] = useState(false);
  const [patch1Date, setPatch1Date] = useState("");
  const [patch2Date, setPatch2Date] = useState("");
  const [completionCertificate, setCompletionCertificate] = useState(false);
  const [roiCreated, setRoiCreated] = useState(false);
  const [savedSite, setSavedSite] = useState<SiteDetails | null>(null);
  const [existingSite, setExistingSite] = useState<SiteDetails | null>(null);
  const [completionFormImageUrl, setCompletionFormImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);



  // Load site details if editing with real-time updates
  useEffect(() => {
    if (!id) {
      setExistingSite(null);
      return;
    }

    // Subscribe to real-time updates for the specific site
    unsubscribeRef.current = siteDetailsAPI.subscribeById(id, (site) => {
      if (isMountedRef.current) {
        setExistingSite(site);
      }
    });

    // Cleanup subscription on unmount or when id changes
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [id]);


  useEffect(() => {
    if (existingSite) {
      setSupervisorName(existingSite.supervisorName || "");
      setTechnicianName(existingSite.technicianName || "");
      setDateInput(existingSite.date || new Date().toISOString().split("T")[0]);
      setMillName(existingSite.millName || "");
      setMillLocation(existingSite.millLocation || "");
      setUnitNo(existingSite.unitNo || "");
      setPocName(existingSite.pocName || "");
      setPocContact(existingSite.pocContact || "");
      setGpuUserName(existingSite.gpuUserName || "");
      setGpuPassword(existingSite.gpuPassword || "sonicgpu786");
      setAnydeskId(existingSite.anydeskId || "");
      setAnydeskPassword(existingSite.anydeskPassword || "sonicgpu786");
      setAnydeskId2(existingSite.anydeskId2 || "");
      setAnydeskPassword2(existingSite.anydeskPassword2 || "sonicgpu786");
      setTailscaleIp(existingSite.tailscaleIp || "");
      setRemoteanydeskPassword(existingSite.remoteanydeskPassword || "");
      setRemoteanydeskAccountName(existingSite.remoteanydeskAccountName || "");
      setRustdeskId(existingSite.rustdeskId || "");
      setRustdeskPassword(existingSite.rustdeskPassword || "");
      setRustdeskId2(existingSite.rustdeskId2 || "");
      setRustdeskPassword2(existingSite.rustdeskPassword2 || "");
      setPcNic(existingSite.pcNic || "");
      setSubnet(existingSite.subnet || "");
      setDefaultGateway(existingSite.defaultGateway || "");
      setLiveIp(existingSite.liveIp || "");
      setNvrIp(existingSite.nvrIp || "");
      setNvrIp2(existingSite.nvrIp2 || "");
      setNvrUsername(existingSite.nvrUsername || "admin");
      setNvrPassword(existingSite.nvrPassword || "sonicnvr786");
      setCameraUsername(existingSite.cameraUsername || "admin");
      setCameraPassword(existingSite.cameraPassword || "sonicnvr786");
      setCameras(existingSite.cameras || []);
      setAdditionalDetails(existingSite.additionalDetails || "");
      setHardwareCompleted(existingSite.hardwareCompleted || false);
      setDataCopy(existingSite.dataCopy || false);
      
      setPatch1Date(existingSite.patch1Date || "");
      setPatch2Date(existingSite.patch2Date || "");
      setCompletionCertificate(existingSite.completionCertificate || false);
      setRoiCreated(existingSite.roiCreated || false);
      setCompletionFormImageUrl(existingSite.completionFormImageUrl || null);
    }
  }, [existingSite]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!millName.trim()) {
        toast.error("Mill Name is required");
        throw new Error("Mill Name required");
      }

      const siteData: SiteDetails = {
        supervisorName: supervisorName || undefined,
        technicianName: technicianName || undefined,
        date: dateInput,
        millName: millName || undefined,
        millLocation: millLocation || undefined,
        unitNo: unitNo || undefined,
        pocName: pocName || undefined,
        pocContact: pocContact || undefined,
        gpuUserName: gpuUserName || undefined,
        gpuPassword: gpuPassword || undefined,
        anydeskId: anydeskId || undefined,
        anydeskPassword: anydeskPassword || undefined,
        anydeskId2: anydeskId2 || undefined,
        anydeskPassword2: anydeskPassword2 || undefined,
        tailscaleIp: tailscaleIp || undefined,
        remoteanydeskPassword: remoteanydeskPassword || undefined,
        remoteanydeskAccountName: remoteanydeskAccountName || undefined,
        rustdeskId: rustdeskId || undefined,
        rustdeskPassword: rustdeskPassword || undefined,
        rustdeskId2: rustdeskId2 || undefined,
        rustdeskPassword2: rustdeskPassword2 || undefined,
        pcNic: pcNic || undefined,
        subnet: subnet || undefined,
        defaultGateway: defaultGateway || undefined,
        liveIp: liveIp || undefined,
        nvrIp: nvrIp || undefined,
        nvrIp2: nvrIp2 || undefined,
        nvrUsername: nvrUsername || undefined,
        nvrPassword: nvrPassword || undefined,
        cameraUsername: cameraUsername || undefined,
        cameraPassword: cameraPassword || undefined,
        cameras: cameras.filter((c) => c.name),
        additionalDetails: additionalDetails || undefined,
        hardwareCompleted,
        dataCopy,
        patch1Date: patch1Date || undefined,
        patch2Date: patch2Date || undefined,
        completionCertificate,
        roiCreated,
        completionFormImageUrl: completionFormImageUrl || undefined,
        technical_project_id: technicalProjectId || undefined,
      };

      let result;
      if (id) {
        await siteDetailsAPI.update(id, siteData);
        result = { ...siteData, id };
      } else {
        result = await siteDetailsAPI.create(siteData);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setSavedSite(result);
      toast.success(id ? "Site details updated" : "Site details created");
      // Navigate back after successful save
      setTimeout(() => {
        if (technicalProjectId) {
          navigate(`/technical-projects/${technicalProjectId}`);
        } else {
          navigate("/sites");
        }
      }, 500);
    },
    onError: (err: any) => {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save site details");
    },
  });

  const addCamera = () => {
    const newNumber = cameras.length + 1;
    setCameras((prev) => [
      ...prev,
      { id: Date.now().toString(), name: `Camera ${newNumber}`, username: "", password: "" },
    ]);
  };

  const removeCamera = (index: number) => {
    setCameras((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCamera = (index: number, field: keyof CameraConfig, value: string) => {
    setCameras((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const updateCameraName = (index: number, name: string) => {
    setCameras((prev) =>
      prev.map((c, i) => {
        if (i === index) {
          return { ...c, name };
        }
        return c;
      })
    );
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const filePath = `completion-form_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      setCompletionFormImageUrl(urlData.publicUrl);
      toast.success("Image uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const removeCompletionImage = () => {
    setCompletionFormImageUrl(null);
  };

  const handleDownloadCompletionForm = () => {
    if (!completionFormImageUrl) return;

    const link = document.createElement("a");
    link.href = completionFormImageUrl;
    link.download = `completion-form-${new Date().toISOString().split("T")[0]}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloading completion form...");
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => {
          if (technicalProjectId) {
            navigate(`/technical-projects/${technicalProjectId}`);
          } else {
            navigate("/sites");
          }
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {id ? "Edit Site Details" : "New Site Details"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage site information and credentials
          </p>
        </div>
      </div>

      {/* Supervisor and Technician Information - At Top */}
      <Card>
        <CardHeader>
          <CardTitle>Personnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supervisor-name">Supervisor Name</Label>
              <Input
                id="supervisor-name"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="Enter supervisor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technician-name">Technician Name</Label>
              <Input
                id="technician-name"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Enter technician name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site Information */}
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mill-name">Mill Name *</Label>
              <Input
                id="mill-name"
                value={millName}
                onChange={(e) => setMillName(e.target.value)}
                placeholder="Enter mill name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-no">Unit No</Label>
              <Input
                id="unit-no"
                value={unitNo}
                onChange={(e) => setUnitNo(e.target.value)}
                placeholder="Enter unit number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mill-location">Mill Location</Label>
              <Input
                id="mill-location"
                value={millLocation}
                onChange={(e) => setMillLocation(e.target.value)}
                placeholder="Enter mill location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-name">POC Name</Label>
              <Input
                id="poc-name"
                value={pocName}
                onChange={(e) => setPocName(e.target.value)}
                placeholder="Enter POC name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-contact">POC Contact</Label>
              <Input
                id="poc-contact"
                value={pocContact}
                onChange={(e) => setPocContact(e.target.value)}
                placeholder="Enter POC contact"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPU Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>GPU Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gpu-user">GPU User Name</Label>
              <Input
                id="gpu-user"
                value={gpuUserName}
                onChange={(e) => setGpuUserName(e.target.value)}
                placeholder="Enter GPU username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gpu-pass">GPU Password</Label>
              <Input
                id="gpu-pass"
                type="text"
                value={gpuPassword}
                onChange={(e) => setGpuPassword(e.target.value)}
                placeholder="sonicgpu786"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remote AnyDesk Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Remote Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="anydesk-id">AnyDesk ID 1</Label>
                <Input
                  id="anydesk-id"
                  value={anydeskId}
                  onChange={(e) => setAnydeskId(e.target.value)}
                  placeholder="Enter AnyDesk ID 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anydesk-pass">AnyDesk Password 1</Label>
                <Input
                  id="anydesk-pass"
                  type="text"
                  value={anydeskPassword}
                  onChange={(e) => setAnydeskPassword(e.target.value)}
                  placeholder="sonicgpu786"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anydesk-id2">AnyDesk ID 2</Label>
                <Input
                  id="anydesk-id2"
                  value={anydeskId2}
                  onChange={(e) => setAnydeskId2(e.target.value)}
                  placeholder="Enter AnyDesk ID 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anydesk-pass2">AnyDesk Password 2</Label>
                <Input
                  id="anydesk-pass2"
                  type="text"
                  value={anydeskPassword2}
                  onChange={(e) => setAnydeskPassword2(e.target.value)}
                  placeholder="sonicgpu786"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="rustdesk-id">RustDesk ID 1</Label>
                <Input
                  id="rustdesk-id"
                  value={rustdeskId}
                  onChange={(e) => setRustdeskId(e.target.value)}
                  placeholder="Enter RustDesk ID 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rustdesk-password">RustDesk Password 1</Label>
                <Input
                  id="rustdesk-password"
                  type="text"
                  value={rustdeskPassword}
                  onChange={(e) => setRustdeskPassword(e.target.value)}
                  placeholder="Enter RustDesk password 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rustdesk-id2">RustDesk ID 2</Label>
                <Input
                  id="rustdesk-id2"
                  value={rustdeskId2}
                  onChange={(e) => setRustdeskId2(e.target.value)}
                  placeholder="Enter RustDesk ID 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rustdesk-password2">RustDesk Password 2</Label>
                <Input
                  id="rustdesk-password2"
                  type="text"
                  value={rustdeskPassword2}
                  onChange={(e) => setRustdeskPassword2(e.target.value)}
                  placeholder="Enter RustDesk password 2"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tailscale-ip">Tail Scale IP</Label>
                <Input
                  id="tailscale-ip"
                  value={tailscaleIp}
                  onChange={(e) => setTailscaleIp(e.target.value)}
                  placeholder="Enter Tail Scale IP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-anydesk-pass">Password</Label>
                <Input
                  id="remote-anydesk-pass"
                  type="text"
                  value={remoteanydeskPassword}
                  onChange={(e) => setRemoteanydeskPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-anydesk-account">Account Name</Label>
                <Input
                  id="remote-anydesk-account"
                  value={remoteanydeskAccountName}
                  onChange={(e) => setRemoteanydeskAccountName(e.target.value)}
                  placeholder="Enter account name"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Network Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="pc-nic">PC IP</Label>
              <Input
                id="pc-nic"
                value={pcNic}
                onChange={(e) => setPcNic(e.target.value)}
                placeholder="Enter PC IP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subnet">Subnet</Label>
              <Input
                id="subnet"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="Enter subnet mask"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateway">Default Gateway</Label>
              <Input
                id="gateway"
                value={defaultGateway}
                onChange={(e) => setDefaultGateway(e.target.value)}
                placeholder="Enter default gateway"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="live-ip">Live IP</Label>
              <Input
                id="live-ip"
                value={liveIp}
                onChange={(e) => setLiveIp(e.target.value)}
                placeholder="Enter Live IP"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NVR Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>NVR Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="nvr-ip">NVR IP-1</Label>
              <Input
                id="nvr-ip"
                value={nvrIp}
                onChange={(e) => setNvrIp(e.target.value)}
                placeholder="Enter NVR IP-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nvr-ip2">NVR IP-2</Label>
              <Input
                id="nvr-ip2"
                value={nvrIp2}
                onChange={(e) => setNvrIp2(e.target.value)}
                placeholder="Enter NVR IP-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nvr-user">Username</Label>
              <Input
                id="nvr-user"
                value={nvrUsername}
                onChange={(e) => setNvrUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nvr-pass">Password</Label>
              <Input
                id="nvr-pass"
                type="text"
                value={nvrPassword}
                onChange={(e) => setNvrPassword(e.target.value)}
                placeholder="sonicnvr786"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camera Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Camera Configuration</CardTitle>
          <Button onClick={addCamera} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Camera
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global camera credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="camera-user">Camera Username (for all cameras)</Label>
              <Input
                id="camera-user"
                value={cameraUsername}
                onChange={(e) => setCameraUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camera-pass">Camera Password (for all cameras)</Label>
              <Input
                id="camera-pass"
                type="text"
                value={cameraPassword}
                onChange={(e) => setCameraPassword(e.target.value)}
                placeholder="sonicnvr786"
              />
            </div>
          </div>

          {/* Individual cameras */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cameras.map((camera, index) => (
              <div key={camera.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">Camera Name</Label>
                    <Input
                      value={camera.name}
                      onChange={(e) => updateCameraName(index, e.target.value)}
                      placeholder={`Camera ${index + 1}`}
                      className="font-medium"
                    />
                  </div>
                  {cameras.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCamera(index)}
                      className="text-red-600 mt-6 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    value={camera.ip || ""}
                    onChange={(e) => updateCamera(index, "ip", e.target.value)}
                    placeholder={`Camera ${index + 1} IP address`}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Addition */}
      <Card>
        <CardHeader>
          <CardTitle>Addition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addition">Additional Notes</Label>
            <textarea
              id="addition"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Add any additional information..."
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Completion Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={hardwareCompleted}
                onCheckedChange={(checked) => setHardwareCompleted(checked === true)}
              />
              <span className="text-sm font-medium">Hardware Completed</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={dataCopy}
                onCheckedChange={(checked) => setDataCopy(checked === true)}
              />
              <span className="text-sm font-medium">Data Copy</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={completionCertificate}
                onCheckedChange={(checked) => setCompletionCertificate(checked === true)}
              />
              <span className="text-sm font-medium">Completion Certificate</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={roiCreated}
                onCheckedChange={(checked) => setRoiCreated(checked === true)}
              />
              <span className="text-sm font-medium">ROI Created</span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="patch-1-date">Patch 1 Date</Label>
              <Input
                id="patch-1-date"
                type="date"
                value={patch1Date}
                onChange={(e) => setPatch1Date(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patch-2-date">Patch 2 Date</Label>
              <Input
                id="patch-2-date"
                type="date"
                value={patch2Date}
                onChange={(e) => setPatch2Date(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Form - Image Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {completionFormImageUrl && (
            <div className="space-y-3">
              <div className="relative inline-block">
                <img
                  src={completionFormImageUrl}
                  alt="Completion Form"
                  className="h-48 w-auto rounded-lg border-2 border-border object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeCompletionImage}
                  className="absolute -top-2 -right-2 bg-destructive text-white hover:bg-destructive/90"
                  disabled={uploadingImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCompletionForm}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <label className="cursor-pointer flex-1">
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
                disabled={uploadingImage}
                ref={fileInputRef}
              />
              <Button variant="outline" size="sm" asChild disabled={uploadingImage} className="w-full">
                <span className="gap-2">
                  {uploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Image
                    </>
                  )}
                </span>
              </Button>
            </label>
            <label className="cursor-pointer flex-1">
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
                disabled={uploadingImage}
                ref={cameraInputRef}
              />
              <Button variant="outline" size="sm" asChild disabled={uploadingImage} className="w-full">
                <span className="gap-2">
                  <Camera className="h-4 w-4" />
                  Take Photo
                </span>
              </Button>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG or GIF · Max 5 MB</p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/sites")}
        >
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !millName}
        >
          {saveMutation.isPending ? "Saving..." : id ? "Update Site" : "Create Site"}
        </Button>
      </div>

      {/* Completion Form Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Completion Form Preview</DialogTitle>
          </DialogHeader>
          <div className="max-h-[600px] overflow-auto">
            {completionFormImageUrl && (
              <img
                src={completionFormImageUrl}
                alt="Completion Form Preview"
                className="w-full rounded-lg border border-border"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleDownloadCompletionForm}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
