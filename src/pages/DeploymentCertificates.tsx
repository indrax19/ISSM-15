import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deploymentCertificateAPI, DeploymentCertificate, companyProfileAPI, CompanyProfile } from "@/integrations/firebase/firestore";
import { siteDetailsAPI, SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Download, Trash2, Edit2, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { downloadDeploymentCertificatePDF } from "@/lib/pdfGenerator";
import ProfileSelectionDialog from "@/components/ProfileSelectionDialog";

export default function DeploymentCertificates() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [certificates, setCertificates] = useState<DeploymentCertificate[]>([]);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<DeploymentCertificate>>({});
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<CompanyProfile[]>([]);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<DeploymentCertificate | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isConfirmingDownload, setIsConfirmingDownload] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Load site, certificates, and company profiles
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (siteId) {
          const siteData = await siteDetailsAPI.getById(siteId);
          setSite(siteData);

          const certs = await deploymentCertificateAPI.getBySiteId(siteId);
          setCertificates(certs);
        }

        // Load company profiles
        const profiles = await companyProfileAPI.getAll();
        setAllProfiles(profiles);
        if (profiles.length > 0) {
          setCompanyProfile(profiles[0]);
          setSelectedProfileId(profiles[0].id || "");
        }
      } catch (error: any) {
        console.error("Error loading data:", error);
        toast.error("Failed to load certificates");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [siteId]);

  const deleteMutation = useMutation({
    mutationFn: async (certId: string) => {
      await deploymentCertificateAPI.delete(certId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates", siteId] });
      setCertificates((prev) => prev.filter((c) => c.id !== editingId));
      toast.success("Certificate deleted");
      setEditingId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete certificate");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No certificate selected");
      await deploymentCertificateAPI.update(editingId, editData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates", siteId] });
      setCertificates((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, ...editData } : c))
      );
      toast.success("Certificate updated");
      setEditingId(null);
      setEditData({});
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update certificate");
    },
  });

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const profiles = await companyProfileAPI.getAll();
      setAllProfiles(profiles);
      if (profiles.length > 0) {
        // Always set to first profile when loading for download
        setSelectedProfileId(profiles[0].id || "");
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast.error("Failed to load company profiles");
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const handleDownloadPDF = useCallback((cert: DeploymentCertificate) => {
    setSelectedCertificate(cert);
    // Pre-select the certificate's company profile if available
    setSelectedProfileId(cert.companyProfileId || "");
    setShowProfileDialog(true);
    loadProfiles();
  }, [loadProfiles]);

  const handleConfirmDownload = useCallback(async () => {
    if (!selectedCertificate || !selectedProfileId) return;

    try {
      setIsConfirmingDownload(true);

      // Auto-save any pending changes before generating PDF
      if (editingId && editData && Object.keys(editData).length > 0) {
        await deploymentCertificateAPI.update(editingId, editData);
        setCertificates((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...editData } : c))
        );
        setEditingId(null);
        setEditData({});
        toast.success("Changes saved");
      }

      await downloadDeploymentCertificatePDF(
        selectedCertificate.company_name,
        selectedCertificate.site_address,
        selectedCertificate.mill_name || "",
        selectedCertificate.client_name,
        selectedCertificate.client_designation,
        selectedCertificate.client_date,
        selectedCertificate.deployment_date || selectedCertificate.client_date,
        selectedCertificate.issm_name,
        selectedCertificate.issm_designation,
        selectedCertificate.issm_date,
        selectedCertificate.company_stamp_url,
        undefined,
        selectedProfileId,
        selectedCertificate.certificate_type || "digital-eye"
      );

      setShowProfileDialog(false);
      setSelectedCertificate(null);
      setSelectedProfileId("");
    } catch (error: any) {
      toast.error(error.message || "Failed to download PDF");
    } finally {
      setIsConfirmingDownload(false);
    }
  }, [selectedCertificate, selectedProfileId, editingId, editData]);

  const startEdit = (cert: DeploymentCertificate) => {
    setEditingId(cert.id || null);
    setEditData({
      client_name: cert.client_name,
      client_designation: cert.client_designation,
      client_date: cert.client_date,
      deployment_date: cert.deployment_date || cert.client_date,
      issm_name: cert.issm_name,
      issm_designation: cert.issm_designation,
      issm_date: cert.issm_date,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  if (loading) {
    return <div className="p-8 text-center">Loading certificates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/technical-projects/${site?.technical_project_id || ""}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Deployment Certificates
          </h1>
          <p className="text-muted-foreground text-sm">
            {site?.millName || "Site"} - {site?.millLocation || "Location"}
          </p>
          {companyProfile && (
            <p className="text-xs text-muted-foreground mt-1">
              Company: {companyProfile.company_name}
            </p>
          )}
        </div>
        <Button onClick={() => navigate(-1)} variant="outline">
          Back
        </Button>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>No certificates yet. Create one from the site details page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{cert.company_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Location: {cert.site_address}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(cert.created_at || "").toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingId === cert.id ? (
                  <div className="space-y-4 border-t pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-client-name">Client Name</Label>
                        <Input
                          id="edit-client-name"
                          value={editData.client_name || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, client_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-client-designation">Client Designation</Label>
                        <Input
                          id="edit-client-designation"
                          value={editData.client_designation || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, client_designation: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-deployment-date">Deployment Date</Label>
                        <Input
                          id="edit-deployment-date"
                          type="date"
                          value={editData.deployment_date || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, deployment_date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-issm-name">ISSM Name</Label>
                        <Input
                          id="edit-issm-name"
                          value={editData.issm_name || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, issm_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-issm-designation">ISSM Designation</Label>
                        <Input
                          id="edit-issm-designation"
                          value={editData.issm_designation || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, issm_designation: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-client-date">Client Date</Label>
                        <Input
                          id="edit-client-date"
                          type="date"
                          value={editData.client_date || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, client_date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-issm-date">ISSM Date</Label>
                        <Input
                          id="edit-issm-date"
                          type="date"
                          value={editData.issm_date || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, issm_date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={cancelEdit}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        className="flex-1"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">Client</p>
                        <p className="text-muted-foreground">{cert.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cert.client_designation}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(cert.client_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Deployment: {new Date(cert.deployment_date || cert.client_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">ISSM</p>
                        <p className="text-muted-foreground">{cert.issm_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cert.issm_designation}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(cert.issm_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 border-t pt-4">
                      <Button
                        variant="outline"
                        onClick={() => handleDownloadPDF(cert)}
                        className="flex-1 gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => startEdit(cert)}
                        className="flex-1 gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deleteMutation.mutate(cert.id || "")}
                        disabled={deleteMutation.isPending}
                        className="flex-1 gap-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProfileSelectionDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        profiles={allProfiles}
        selectedProfileId={selectedProfileId}
        onProfileSelect={setSelectedProfileId}
        onConfirm={handleConfirmDownload}
        isLoading={loadingProfiles}
        isConfirming={isConfirmingDownload}
        confirmLabel="Download PDF"
        description="Choose which company profile to use for this deployment certificate:"
        associatedProfileName={selectedCertificate?.companyProfileName}
      />
    </div>
  );
}
