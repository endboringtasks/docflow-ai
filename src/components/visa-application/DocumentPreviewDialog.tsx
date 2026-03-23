import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Loader2,
  FileText,
  Maximize2,
  Minimize2,
  ExternalLink,
  History,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DocumentHistorySection, DocumentHistoryEntry } from "./DocumentHistorySection";

export type ReviewStatus = "pending_client" | "in_review" | "approved" | "rejected";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    name: string;
    filePath: string | null;
    reviewStatus: ReviewStatus;
    reviewComment: string | null;
    storageObjectPath?: string | null;
  } | null;
  onReviewUpdate: (docId: string, status: ReviewStatus, comment: string) => Promise<void>;
  onRequestNewDocument: (docId: string, comment: string) => Promise<void>;
  companyId?: string;
  documentHistory?: DocumentHistoryEntry[];
}

const isImageFile = (filePath: string): boolean => {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
  const lowerPath = filePath.toLowerCase();
  return imageExtensions.some((ext) => lowerPath.endsWith(ext));
};

const isPdfFile = (filePath: string): boolean => {
  return filePath.toLowerCase().endsWith(".pdf");
};

const isDriveFile = (filePath: string): boolean => {
  return filePath.startsWith("drive://");
};

const getDriveFileId = (filePath: string): string => {
  return filePath.replace("drive://", "");
};

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  onReviewUpdate,
  onRequestNewDocument,
  companyId,
  documentHistory = [],
}: DocumentPreviewDialogProps) {
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [driveFileInfo, setDriveFileInfo] = useState<{
    name: string;
    mimeType: string;
    webViewLink?: string;
  } | null>(null);
  const [historyPreview, setHistoryPreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [historyZoom, setHistoryZoom] = useState(1);
  const [historyRotation, setHistoryRotation] = useState(0);

  // Load the preview URL when dialog opens
  useEffect(() => {
    if (open && document?.filePath) {
      loadPreview();
      setComment(document.reviewComment || "");
      setZoom(1);
      setRotation(0);
      setDriveFileInfo(null);
      setActiveTab("current");
      setHistoryPreview(null);
      setHistoryZoom(1);
      setHistoryRotation(0);
    } else {
      setPreviewUrl(null);
      setDriveFileInfo(null);
      setActiveTab("current");
      setHistoryPreview(null);
    }
  }, [open, document?.filePath]);

  const loadPreview = async () => {
    if (!document?.filePath) return;

    setLoading(true);
    try {
      // Priority: use storage_object_path for direct signed URL (no edge function)
      if (document.storageObjectPath) {
        const { data, error } = await supabase.storage
          .from("document-attachments")
          .createSignedUrl(document.storageObjectPath, 3600);

        if (!error && data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
          setLoading(false);
          return;
        }
        // Fall through to Drive logic if storage URL fails
      }

      // Check if this is a Google Drive file
      if (isDriveFile(document.filePath)) {
        if (!companyId) {
          throw new Error("Company ID required for Drive files");
        }
        
        const fileId = getDriveFileId(document.filePath);
        const { data, error } = await supabase.functions.invoke("get-drive-file-url", {
          body: { file_id: fileId, company_id: companyId },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed to get file URL");

        setDriveFileInfo({
          name: data.file.name,
          mimeType: data.file.mimeType,
          webViewLink: data.file.webViewLink,
        });

        if (data.file.previewUrl) {
          setPreviewUrl(data.file.previewUrl);
        } else if (data.file.webViewLink) {
          setPreviewUrl(null);
        }
      } else {
        // Supabase storage file (legacy path without storage_object_path)
        const { data, error } = await supabase.storage
          .from("document-attachments")
          .createSignedUrl(document.filePath, 3600);

        if (error) throw error;
        setPreviewUrl(data.signedUrl);
      }
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Failed to load document preview");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document?.filePath || !previewUrl) return;

    const link = window.document.createElement("a");
    link.href = previewUrl;
    link.download = document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleReview = async (status: ReviewStatus) => {
    if (!document) return;

    setIsSubmitting(true);
    try {
      await onReviewUpdate(document.id, status, comment);
      toast.success(
        status === "approved"
          ? "Document approved"
          : status === "rejected"
          ? "Document rejected"
          : status === "in_review"
          ? "Marked as ready to review"
          : "Marked as pending client"
      );
      if (status !== "pending_client") {
        onOpenChange(false);
      }
    } catch (error) {
      toast.error("Failed to update review status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestNew = async () => {
    if (!document || !comment.trim()) {
      toast.error("Please add a comment explaining what document is needed");
      return;
    }

    setIsSubmitting(true);
    try {
      await onRequestNewDocument(document.id, comment);
      toast.success("Request sent to client");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to send request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ReviewStatus) => {
    const config = {
      pending_client: { variant: "secondary" as const, label: "Pending Client", icon: AlertCircle },
      in_review: { variant: "outline" as const, label: "Ready to Review", icon: AlertCircle },
      approved: { variant: "default" as const, label: "Approved", icon: CheckCircle2 },
      rejected: { variant: "destructive" as const, label: "Rejected", icon: XCircle },
    };
    const { variant, label, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  if (!document) return null;

  const filePath = document.filePath;
  const isDrive = filePath && isDriveFile(filePath);
  const canPreview = filePath && (
    isDrive 
      ? (driveFileInfo?.mimeType?.startsWith("image/") || driveFileInfo?.mimeType === "application/pdf" || previewUrl)
      : (isImageFile(filePath) || isPdfFile(filePath))
  );
  const isImage = isDrive 
    ? driveFileInfo?.mimeType?.startsWith("image/")
    : (filePath && isImageFile(filePath));
  const isPdf = isDrive 
    ? driveFileInfo?.mimeType === "application/pdf"
    : (filePath && isPdfFile(filePath));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-5xl max-h-[90vh] flex flex-col",
        isFullscreen && "max-w-[100vw] max-h-[100vh] w-screen h-screen rounded-none"
      )}>
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg">{document.name}</DialogTitle>
            {getStatusBadge(document.reviewStatus)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs for Current Document / History */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "history")} className="flex-1 min-h-0 flex flex-col">
          {documentHistory.length > 0 && (
            <TabsList className="flex-shrink-0 w-fit">
              <TabsTrigger value="current" className="gap-2">
                <FileText className="w-4 h-4" />
                Current Document
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                History
                <Badge variant="secondary" className="text-xs ml-1">
                  {documentHistory.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          )}
          
          <TabsContent value="current" className="flex-1 min-h-0 flex flex-col gap-4 mt-4 data-[state=inactive]:hidden">
            {/* Preview Area */}
            <div className="flex-1 min-h-0 flex flex-col gap-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-secondary/30 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !document.filePath ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-secondary/30 rounded-lg p-8">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No file uploaded yet</p>
            </div>
          ) : !canPreview && !isDrive ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-secondary/30 rounded-lg p-8">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
              <Button onClick={handleDownload} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download to View
              </Button>
            </div>
          ) : isDrive && !previewUrl && driveFileInfo?.webViewLink ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-secondary/30 rounded-lg p-8">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {driveFileInfo.name || document.name}
              </p>
              <Button 
                onClick={() => window.open(driveFileInfo.webViewLink, '_blank')} 
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Google Drive
              </Button>
            </div>
          ) : (
            <>
              {/* Zoom Controls */}
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
                    disabled={zoom <= 0.25}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  {isImage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRotation((rotation + 90) % 360)}
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isDrive && driveFileInfo?.webViewLink && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => window.open(driveFileInfo.webViewLink, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Drive
                    </Button>
                  )}
                  {!isDrive && (
                    <Button variant="ghost" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 min-h-0 overflow-auto bg-secondary/30 rounded-lg flex items-center justify-center p-4">
                {isImage ? (
                  <img
                    src={previewUrl || ""}
                    alt={document.name}
                    className="max-w-full max-h-full object-contain transition-transform"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                ) : isPdf ? (
                  <iframe
                    src={previewUrl || ""}
                    className="w-full h-full min-h-[500px] rounded"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
                    title={document.name}
                  />
                ) : null}
              </div>
            </>
          )}

          {/* Comment Section */}
          {document.reviewComment && !showCommentInput && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <MessageSquare className="w-4 h-4" />
                Review Comment
              </div>
              <p className="text-sm text-muted-foreground">{document.reviewComment}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Add Comment</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add feedback for the client..."
              className="min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentInput(!showCommentInput)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {showCommentInput ? "Hide Comment" : "Add Comment"}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestNew}
                disabled={isSubmitting || !comment.trim()}
                title={!comment.trim() ? "Add a comment first" : undefined}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2" />
                )}
                Request Different Doc
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReview("in_review")}
                disabled={isSubmitting}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2" />
                )}
                Ready to Review
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReview("rejected")}
                disabled={isSubmitting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Reject
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleReview("approved")}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
          </div>
            </div>
          </TabsContent>
          
          {/* History Tab */}
          <TabsContent value="history" className="flex-1 min-h-0 overflow-auto mt-4 data-[state=inactive]:hidden">
            {historyPreview ? (
              // Show inline preview of historical document
              <div className="flex flex-col h-full gap-4 p-4">
                {/* Back button and file name */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHistoryPreview(null);
                      setHistoryZoom(1);
                      setHistoryRotation(0);
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to History
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Viewing: {historyPreview.name}
                  </span>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHistoryZoom(Math.max(0.25, historyZoom - 0.25))}
                      disabled={historyZoom <= 0.25}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium w-16 text-center">{Math.round(historyZoom * 100)}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHistoryZoom(Math.min(3, historyZoom + 0.25))}
                      disabled={historyZoom >= 3}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    {historyPreview.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setHistoryRotation((historyRotation + 90) % 360)}
                      >
                        <RotateCw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 min-h-0 overflow-auto bg-secondary/30 rounded-lg flex items-center justify-center p-4">
                  {historyPreview.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                    <img
                      src={historyPreview.url}
                      alt={historyPreview.name}
                      className="max-w-full max-h-full object-contain transition-transform"
                      style={{
                        transform: `scale(${historyZoom}) rotate(${historyRotation}deg)`,
                      }}
                    />
                  ) : historyPreview.name.match(/\.pdf$/i) ? (
                    <iframe
                      src={historyPreview.url}
                      className="w-full h-full min-h-[500px] rounded"
                      style={{ transform: `scale(${historyZoom})`, transformOrigin: "top left" }}
                      title={historyPreview.name}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8">
                      <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                      <Button
                        onClick={() => window.open(historyPreview.url, "_blank")}
                        variant="outline"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in New Tab
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Show history list
              <div className="p-4">
                <DocumentHistorySection
                  history={documentHistory}
                  companyId={companyId}
                  inline={true}
                  onViewDocument={(url, name) => setHistoryPreview({ url, name })}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
