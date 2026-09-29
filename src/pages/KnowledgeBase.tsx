import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { knowledgeBaseAPI, type KnowledgeBaseDocument } from "@/integrations/firebase/knowledgeBaseAPI";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, File, Loader2, BookOpen, Eye, Search, X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

function getFileLabel(fileType: string): { label: string; className: string } {
  if (fileType === "link") return { label: "LINK", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (fileType.includes("pdf")) return { label: "PDF", className: "bg-red-50 text-red-700 border-red-200" };
  if (fileType.includes("word") || fileType.includes("document")) return { label: "DOC", className: "bg-blue-50 text-blue-700 border-blue-200" };
  if (fileType.includes("sheet") || fileType.includes("spreadsheet")) return { label: "XLS", className: "bg-green-50 text-green-700 border-green-200" };
  if (fileType.includes("image")) return { label: "IMG", className: "bg-purple-50 text-purple-700 border-purple-200" };
  return { label: "FILE", className: "bg-muted text-muted-foreground" };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}


export default function KnowledgeBase() {
  const { isAdmin, appUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentType, setAttachmentType] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Real-time subscription
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Debounce search — only refilter after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setIsLoading(true);
    unsubscribeRef.current = knowledgeBaseAPI.subscribeAll(
      (docs) => {
        setDocuments(docs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load documents:", error);
        setIsLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await knowledgeBaseAPI.delete(id);
    },
    onSuccess: () => {
      toast.success("Document deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete document");
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      attachmentType: "file" | "link";
      file?: File;
      linkUrl?: string;
    }) => {
      if (!data.title.trim()) throw new Error("Document title is required");

      if (data.attachmentType === "link") {
        if (!data.linkUrl?.trim()) throw new Error("Link is required");

        const normalizedUrl = new URL(data.linkUrl.trim()).toString();
        const parsedUrl = new URL(normalizedUrl);
        const sourceName = parsedUrl.hostname.replace(/^www\./, "") || "External link";

        await knowledgeBaseAPI.create({
          title: data.title.trim(),
          description: data.description.trim(),
          fileName: sourceName,
          fileUrl: normalizedUrl,
          fileSize: 0,
          fileType: "link",
          sourceType: "link",
          uploadedBy: appUser?.id,
          uploadedByName: appUser?.fullName || appUser?.email || "User",
        });

        return true;
      }

      if (!data.file) throw new Error("Please select a file");

      const timestamp = Date.now();
      const fileName = `${timestamp}_${data.file.name}`;
      const filePath = `knowledge_base/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, data.file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      await knowledgeBaseAPI.create({
        title: data.title.trim(),
        description: data.description.trim(),
        fileName: data.file.name,
        fileUrl: urlData.publicUrl,
        fileSize: data.file.size,
        fileType: data.file.type,
        sourceType: "file",
        uploadedBy: appUser?.id,
        uploadedByName: appUser?.fullName || appUser?.email || "User",
      });
      return true;
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload document");
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setAttachmentType("file");
    setLinkUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDocTitle("");
    setDocDescription("");
    setShowUploadForm(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB");
      return;
    }
    setAttachmentType("file");
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!hasPermission("knowledge-base-upload")) {
      toast.error("You don't have permission to upload documents");
      return;
    }

    if (attachmentType === "link") {
      if (!linkUrl.trim()) {
        toast.error("Please enter a link");
        return;
      }

      try {
        new URL(linkUrl.trim());
      } catch {
        toast.error("Please enter a valid link");
        return;
      }

      uploadDocMutation.mutate({
        title: docTitle,
        description: docDescription,
        attachmentType,
        linkUrl,
      });
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    uploadDocMutation.mutate({
      title: docTitle,
      description: docDescription,
      attachmentType,
      file: selectedFile,
    });
  };

  const handleViewDocument = async (doc: KnowledgeBaseDocument) => {
    try {
      await knowledgeBaseAPI.incrementDownloadCount(doc.id!);
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to open document");
    }
  };

  const handleDownloadDocument = async (doc: KnowledgeBaseDocument) => {
    try {
      if (doc.sourceType === "link" || doc.fileType === "link") {
        window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
        toast.success("Link opened in new tab");
        return;
      }

      // Get file extension from original filename
      const fileExtension = doc.fileName.split(".").pop() || "";
      const downloadName = fileExtension ? `${doc.title}.${fileExtension}` : doc.title;

      const link = window.document.createElement("a");
      link.href = doc.fileUrl;
      link.download = downloadName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      toast.success("Document downloaded");
    } catch {
      toast.error("Failed to open document");
    }
  };

  const handleDeleteDocument = (id: string) => {
    if (!hasPermission("knowledge-base-delete")) {
      toast.error("You don't have permission to delete documents");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    deleteDocMutation.mutate(id);
  };


  // Memoised filter — only recomputes when docs or search changes
  const filteredDocs = useMemo(() => {
    if (!debouncedSearch) return documents;
    const s = debouncedSearch.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.description?.toLowerCase().includes(s) ||
        d.fileName.toLowerCase().includes(s)
    );
  }, [documents, debouncedSearch]);

  const isUploading = uploadDocMutation.isPending;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Upload and manage documents
          </p>
        </div>
        </div>
        {hasPermission("knowledge-base-upload") && (
          <Button
            onClick={() => setShowUploadForm((prev) => !prev)}
            className="gap-2 shrink-0"
            variant={showUploadForm ? "outline" : "default"}
          >
            {showUploadForm ? (
              <><X className="h-4 w-4" />Cancel</>
            ) : (
              <><Upload className="h-4 w-4" />Upload Document</>
            )}
          </Button>
        )}
      </div>


      {showUploadForm && (
        <Card className="border-l-4 border-l-primary border-t-0 border-r-0 border-b-0 rounded-lg shadow-none animate-in slide-in-from-top-2 duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Upload className="h-4 w-4" />
              Upload new document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="doc-title" className="text-xs text-muted-foreground">Document title *</Label>
                <Input
                  id="doc-title"
                  placeholder="e.g., Company Policy, Training Guide"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-description" className="text-xs text-muted-foreground">Description (optional)</Label>
                <Input
                  id="doc-description"
                  placeholder="Brief description of the document"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Attachment type</Label>
              <RadioGroup
                value={attachmentType}
                onValueChange={(value) => setAttachmentType(value === "link" ? "link" : "file")}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="file" />
                  <div>
                    <p className="text-sm font-medium">File</p>
                    <p className="text-xs text-muted-foreground">Upload PDF, Word, Excel, or image</p>
                  </div>
                </Label>
                <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="link" />
                  <div>
                    <p className="text-sm font-medium">Link</p>
                    <p className="text-xs text-muted-foreground">Save an external website or file URL</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {attachmentType === "link" ? (
              <div className="space-y-1.5">
                <Label htmlFor="doc-link" className="text-xs text-muted-foreground">Link *</Label>
                <Input
                  id="doc-link"
                  type="url"
                  placeholder="https://example.com/document"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            ) : (
              <div>
                {selectedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-700 truncate">{selectedFile.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-red-500 hover:text-red-600 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/30 transition-all"
                  >
                    <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Click to upload a document</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">PDF, Word, Excel, Images · Max 50MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!docTitle.trim() || (attachmentType === "file" ? !selectedFile : !linkUrl.trim()) || isUploading}
              className="w-full gap-2"
            >
              {isUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><Upload className="h-4 w-4" />Save document</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="shrink-0 px-4 py-2 rounded-lg border text-sm text-muted-foreground bg-muted/40">
          <span className="font-medium text-foreground">{debouncedSearch ? filteredDocs.length : documents.length}</span>{" "}{debouncedSearch ? "results" : "documents"}
        </div>
      </div>

      {/* Documents Table */}
      <div>
        {isLoading ? (
          <Card className="shadow-none">
            <CardContent className="p-0">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 border-b last:border-b-0 items-center animate-pulse">
                  <div className="col-span-1"><div className="w-10 h-10 rounded-lg bg-muted" /></div>
                  <div className="col-span-4 space-y-2"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2" /></div>
                  <div className="col-span-3"><div className="h-4 bg-muted rounded w-2/3" /></div>
                  <div className="col-span-2"><div className="h-3 bg-muted rounded w-1/2" /></div>
                  <div className="col-span-2 flex gap-1.5 justify-end"><div className="h-8 w-16 bg-muted rounded" /><div className="h-8 w-8 bg-muted rounded" /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : filteredDocs.length > 0 ? (
          <Card className="overflow-hidden shadow-none">
            <CardContent className="p-0">
              {/* Header Row */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-2.5 bg-muted/40 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-1"></div>
                <div className="col-span-4">Title</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2">Uploaded by</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Rows */}
              {filteredDocs.map((doc) => {
                const isImage = doc.fileType.startsWith("image/");
                const { label, className } = getFileLabel(doc.fileType);

                return (
                  <div
                    key={doc.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-3.5 items-center border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    {/* Thumb */}
                    <div className="col-span-1">
                      <div className={`w-10 h-10 rounded-lg border text-xs font-semibold flex items-center justify-center overflow-hidden ${className}`}>
                        {isImage ? (
                          <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : label}
                      </div>
                    </div>

                    <div className="col-span-4">
                      <button
                        type="button"
                        onClick={() => handleViewDocument(doc)}
                        className="text-left group"
                      >
                        <p className="text-sm font-medium text-foreground leading-tight group-hover:text-primary">{doc.title}</p>
                      </button>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.sourceType === "link" || doc.fileType === "link" ? "Link" : formatFileSize(doc.fileSize)} · {doc.created_at ? format(new Date(doc.created_at), "MMM d, yyyy") : "—"}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="col-span-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {doc.description || <span className="text-muted-foreground/40">—</span>}
                      </p>
                    </div>

                    {/* Uploaded by */}
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground truncate">{doc.uploadedByName || "—"}</p>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex gap-1.5 justify-end items-center">
                      <Button onClick={() => handleViewDocument(doc)} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                        <Eye className="h-3.5 w-3.5" />
                        Open
                      </Button>
                      <Button onClick={() => handleDownloadDocument(doc)} variant="outline" size="sm" className="h-8 w-8 p-0" title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {hasPermission("knowledge-base-delete") && (
                        <Button
                          onClick={() => handleDeleteDocument(doc.id!)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <File className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {debouncedSearch ? "No matching documents" : "No documents yet"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {debouncedSearch ? "Try a different search term" : "Upload your first document to get started"}
              </p>
              {!debouncedSearch && (
                <Button size="sm" className="gap-2" onClick={() => setShowUploadForm(true)}>
                  <Upload className="h-4 w-4" />Upload Document
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
