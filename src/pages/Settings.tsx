import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Save,
  Upload,
  Building2,
  ArrowLeft,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { companyProfileAPI, CompanyProfile, BankAccount } from "@/integrations/firebase/firestore";

const emptyBankAccount = (): BankAccount => ({ id: crypto.randomUUID(), bankName: "", accountTitle: "", accountNo: "", iban: "", branch: "" });

const BANK_ACCOUNT_FIELDS: { key: Exclude<keyof BankAccount, "id">; label: string }[] = [
  { key: "bankName", label: "Bank" },
  { key: "accountTitle", label: "Account Title" },
  { key: "accountNo", label: "Account No." },
  { key: "iban", label: "IBAN" },
  { key: "branch", label: "Branch" },
];
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  // List view state
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Edit/Create form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [ntn, setNtn] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const data = await companyProfileAPI.getAll();
      if (isMountedRef.current) {
        setProfiles((data || []) as CompanyProfile[]);
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Failed to load profiles:", error);
        toast.error("Failed to load company profiles");
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingProfiles(false);
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setCompanyName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setWebsite("");
    setNtn("");
    setLogoUrl(null);
    setSignatureUrl(null);
    setBankAccounts([]);
    setEditingId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (profile: CompanyProfile) => {
    setEditingId(profile.id || null);
    setCompanyName(profile.company_name || "");
    setAddress(profile.address || "");
    setPhone(profile.phone || "");
    setEmail(profile.email || "");
    setWebsite(profile.website || "");
    setNtn(profile.ntn || "");
    setLogoUrl(profile.logo_url || null);
    setSignatureUrl(profile.signature_url || null);
    setBankAccounts(profile.bankAccounts || []);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this company profile?")) {
      return;
    }

    if (!isMountedRef.current) return;
    setDeleting(id);

    try {
      await companyProfileAPI.delete(id);
      if (isMountedRef.current) {
        setProfiles(profiles.filter((p) => p.id !== id));
        toast.success("Profile deleted successfully!");
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        console.error("Delete error:", error);
        toast.error(error.message || "Failed to delete profile");
      }
    } finally {
      if (isMountedRef.current) {
        setDeleting(null);
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    if (!isMountedRef.current) return;
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const filePath = `logo_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      if (isMountedRef.current) {
        setLogoUrl(urlData.publicUrl);
        toast.success("Logo uploaded successfully!");
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    if (!isMountedRef.current) return;
    setUploadingSignature(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const filePath = `signature_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      if (isMountedRef.current) {
        setSignatureUrl(urlData.publicUrl);
        toast.success("Signature uploaded successfully!");
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload signature");
    } finally {
      if (isMountedRef.current) {
        setUploadingSignature(false);
      }
    }
  };

  const handleRemoveSignature = () => {
    setSignatureUrl(null);
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!isMountedRef.current) return;
    setSaving(true);

    try {
      const profileData: Partial<CompanyProfile> = {
        company_name: companyName.trim(),
        address: address.trim() || undefined,
        logo_url: logoUrl || undefined,
        signature_url: signatureUrl || undefined,
        phone: phone.trim(),
        email: email.trim(),
        website: website.trim() || undefined,
        ntn: ntn.trim() || undefined,
        bankAccounts: bankAccounts
          .filter((account) => account.bankName.trim() || account.accountNo.trim())
          .map((account) => ({ ...account, bankName: account.bankName.trim(), accountTitle: account.accountTitle.trim(), accountNo: account.accountNo.trim(), iban: account.iban.trim(), branch: account.branch.trim() })),
      };

      if (editingId) {
        await companyProfileAPI.update(editingId, profileData);
        if (isMountedRef.current) {
          setProfiles(
            profiles.map((p) =>
              p.id === editingId ? { ...p, ...profileData } as CompanyProfile : p
            )
          );
          toast.success("Profile updated successfully!");
        }
      } else {
        const newProfile = await companyProfileAPI.create(
          profileData as CompanyProfile
        );
        if (isMountedRef.current) {
          setProfiles([...profiles, newProfile as CompanyProfile]);
          toast.success("Profile created successfully!");
        }
      }

      if (isMountedRef.current) {
        setShowForm(false);
        resetForm();
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save profile");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} disabled>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const isBusy = saving || uploading || loadingProfiles;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage company profiles for delivery challans
          </p>
        </div>
      </div>

      {!showForm ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                Company Profiles
              </CardTitle>
              <CardDescription>
                {profiles.length} profile{profiles.length !== 1 ? "s" : ""} saved
              </CardDescription>
            </div>
            <Button onClick={handleAddNew} disabled={isBusy} className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Profile
            </Button>
          </CardHeader>
          <CardContent>
            {loadingProfiles ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No company profiles yet. Create one to get started.
                </p>
                <Button onClick={handleAddNew} variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Profile
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {profile.logo_url && (
                        <img
                          src={profile.logo_url}
                          alt={profile.company_name}
                          className="h-12 w-12 rounded border object-contain bg-muted p-1 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate">
                          {profile.company_name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(profile)}
                        disabled={isBusy}
                        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(profile.id!)}
                        disabled={isBusy || deleting === profile.id}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        {deleting === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg">
                {editingId ? "Edit Profile" : "New Profile"}
              </CardTitle>
              <CardDescription>
                {editingId
                  ? "Update company profile information"
                  : "Create a new company profile"}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              disabled={isBusy}
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label>Company Logo</Label>
              {logoUrl && (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      className="h-20 w-20 rounded-lg border-2 border-border object-contain p-2 bg-muted"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={isBusy}
                  />
                  <Button variant="outline" size="sm" asChild disabled={isBusy}>
                    <span>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          {logoUrl ? "Change Logo" : "Upload Logo"}
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG or GIF · Max 5 MB</p>
            </div>

            {/* Company Name, Address, Phone */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="Your company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  placeholder="Company address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  placeholder="+92 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isBusy}
                />
              </div>
            </div>

            {/* Email & Website */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website (optional)</Label>
                <Input
                  id="website"
                  placeholder="https://www.company.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={isBusy}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ntn">NTN # (optional)</Label>
              <Input
                id="ntn"
                placeholder="A033994"
                value={ntn}
                onChange={(e) => setNtn(e.target.value)}
                disabled={isBusy}
              />
            </div>

            {/* Bank Accounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Bank Accounts (optional)</Label>
                <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => setBankAccounts([...bankAccounts, emptyBankAccount()])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Bank Account
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Choose one account per invoice. Only the selected account appears on that invoice and its PDF.</p>
              {bankAccounts.map((account, index) => (
                <div key={account.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Bank Account {index + 1}</p>
                    <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setBankAccounts(bankAccounts.filter((item) => item.id !== account.id))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {BANK_ACCOUNT_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`bank-${account.id}-${key}`}>{label}</Label>
                        <Input
                          id={`bank-${account.id}-${key}`}
                          value={account[key]}
                          disabled={isBusy}
                          onChange={(e) => setBankAccounts(bankAccounts.map((item) => item.id === account.id ? { ...item, [key]: e.target.value } : item))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Digital Signature */}
            <div className="space-y-3">
              <Label>Digital Signature (optional)</Label>
              <p className="text-xs text-muted-foreground">Upload a digital signature image to display on PDF documents</p>
              {signatureUrl && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={signatureUrl}
                      alt="Digital Signature"
                      className="h-16 rounded border-2 border-border object-contain p-2 bg-muted"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveSignature}
                    disabled={isBusy}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSignatureUpload}
                    disabled={isBusy}
                  />
                  <Button variant="outline" size="sm" asChild disabled={isBusy}>
                    <span>
                      {uploadingSignature ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          {signatureUrl ? "Change Signature" : "Upload Signature"}
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG or GIF · Max 5 MB</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleCancel} disabled={isBusy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isBusy} className="gap-2 min-w-[140px]">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingId ? "Update Profile" : "Create Profile"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
