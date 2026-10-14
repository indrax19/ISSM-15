// Helper
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { knowledgeBaseAPI, type KnowledgeBaseDocument } from "@/integrations/firebase/knowledgeBaseAPI";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function KnowledgeBaseDocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [doc, setDoc] = useState<KnowledgeBaseDocument | null>(
    location.state?.document || null
  );
  const [isLoading, setIsLoading] = useState(!(location.state?.document));
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!doc && id) {
      loadDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, doc]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      const result = await knowledgeBaseAPI.getById(id!);
      if (result) {
        setDoc(result);
      } else {
        toast.error("Document not found");
        navigate("/knowledge-base");
      }
    } catch (error) {
      console.error("Failed to load document:", error);
      toast.error("Failed to load document");
      navigate("/knowledge-base");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;
    try {
      setIsDownloading(true);

      if (doc.sourceType === "link" || doc.fileType === "link") {
        window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
        toast.success("Link opened in new tab");
        return;
      }

      // Get file extension from original filename
      const fileExtension = doc.fileName.split(".").pop() || "";
      const downloadName = fileExtension ? doc.title + "." + fileExtension : doc.title;

      const link = window.document.createElement("a");
      link.href = doc.fileUrl;
      link.download = downloadName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      toast.success("Document downloaded");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to open document");
    } finally {
      setIsDownloading(false);
    }
  };

  const isLink = doc?.sourceType === "link" || doc?.fileType === "link";
  const isImage = doc?.fileType.startsWith("image/");
  const isPdf = doc?.fileType === "application/pdf";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/knowledge-base")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Knowledge Base
        </Button>
        {doc && (
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isLink ? "Opening..." : "Downloading..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {isLink ? "Open Link" : "Download"}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Document View */}
      {!isLoading && doc && (
        <div className="space-y-6">
          {/* Document Info */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{doc.title}</h1>
              </div>

              {doc.description && (
                <div>
                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-6 text-xs text-muted-foreground pt-3 border-t">
                <div>
                  <span className="font-medium">Uploaded by:</span> {doc.uploadedByName || "Admin"}
                </div>
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {doc.created_at ? format(new Date(doc.created_at), "MMM d, yyyy") : "—"}
                </div>
                <div>
                  <span className="font-medium">Source:</span> {isLink ? "External link" : doc.fileName}
                </div>
                <div>
                  <span className="font-medium">Size:</span>{" "}
                  {isLink ? "—" : formatFileSize(doc.fileSize)}
                </div>
                <div>
                  <span className="font-medium">Views:</span> {doc.downloads || 0}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Preview/Content */}
          <Card className="overflow-hidden">
            <CardContent className="p-0 min-h-[600px] flex items-center justify-center bg-muted/30">
              {isImage ? (
                <img
                  src={doc.fileUrl}
                  alt={doc.title}
                  className="max-w-full max-h-[800px] object-contain"
                />
              ) : isPdf ? (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(doc.fileUrl)}&embedded=true`}
                  className="w-full h-[800px] border-0"
                  title={doc.title}
                  allow="fullscreen"
                />
              ) : (
                <div className="text-center py-20">
                  <p className="text-muted-foreground mb-4">
                    This file type cannot be previewed in the browser
                  </p>
                  <Button onClick={handleDownload} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download to view
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && !doc && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Document not found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
