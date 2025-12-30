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
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  } | null;
  onReviewUpdate: (docId: string, status: ReviewStatus, comment: string) => Promise<void>;
  onRequestNewDocument: (docId: string, comment: string) => Promise<void>;
}

const isImageFile = (filePath: string): boolean => {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
  const lowerPath = filePath.toLowerCase();
  return imageExtensions.some((ext) => lowerPath.endsWith(ext));
};

const isPdfFile = (filePath: string): boolean => {
  return filePath.toLowerCase().endsWith(".pdf");
};

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  onReviewUpdate,
  onRequestNewDocument,
}: DocumentPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load the preview URL when dialog opens
  useEffect(() => {
    if (open && document?.filePath) {
      loadPreview();
      setComment(document.reviewComment || "");
      setZoom(1);
      setRotation(0);
    } else {
      setPreviewUrl(null);
    }
  }, [open, document?.filePath]);

  const loadPreview = async () => {
    if (!document?.filePath) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("document-attachments")
        .createSignedUrl(document.filePath, 3600);

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
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

  const canPreview = document.filePath && (isImageFile(document.filePath) || isPdfFile(document.filePath));

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
          ) : !canPreview ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-secondary/30 rounded-lg p-8">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
              <Button onClick={handleDownload} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download to View
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
                  {isImageFile(document.filePath!) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRotation((rotation + 90) % 360)}
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>

              {/* Preview Content */}
              <div className="flex-1 min-h-0 overflow-auto bg-secondary/30 rounded-lg flex items-center justify-center p-4">
                {isImageFile(document.filePath!) ? (
                  <img
                    src={previewUrl || ""}
                    alt={document.name}
                    className="max-w-full max-h-full object-contain transition-transform"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                ) : isPdfFile(document.filePath!) ? (
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

          {showCommentInput && (
            <div className="space-y-2">
              <Label>Add Comment</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add feedback for the client..."
                className="min-h-[80px]"
              />
            </div>
          )}

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
      </DialogContent>
    </Dialog>
  );
}
