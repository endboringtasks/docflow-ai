import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  History,
  FileText,
  Calendar,
  XCircle,
  Download,
  Eye,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { config } from "@/lib/config";
import { toast } from "sonner";

export interface DocumentHistoryEntry {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_at: string;
  archived_at: string;
  archived_reason: string;
  review_status_at_archive: string | null;
  review_comment_at_archive: string | null;
  reviewed_by_at_archive?: string | null;
  reviewer_name?: string | null;
}

interface DocumentHistorySectionProps {
  history: DocumentHistoryEntry[];
  onViewDocument?: (url: string, fileName: string) => void;
  companyId?: string;
  isClientPortal?: boolean;
  portalToken?: string;
}

export function DocumentHistorySection({
  history,
  onViewDocument,
  companyId,
  isClientPortal = false,
  portalToken,
}: DocumentHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!history || history.length === 0) {
    return null;
  }

  const handleViewDocument = async (entry: DocumentHistoryEntry) => {
    setLoadingId(entry.id);
    try {
      let signedUrl: string | null = null;

      if (isClientPortal && portalToken) {
        // Use client portal edge function to get signed URL
        const response = await fetch(
          `${config.supabaseUrl}/functions/v1/client-portal-get-file-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: portalToken,
              file_path: entry.file_path,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to get file URL");
        }
        signedUrl = result.url;
      } else if (entry.file_path.startsWith("drive://") && companyId) {
        // Google Drive file
        const fileId = entry.file_path.replace("drive://", "");
        const { data, error } = await supabase.functions.invoke(
          "get-drive-file-url",
          {
            body: { file_id: fileId, company_id: companyId },
          }
        );

        if (error) throw error;
        signedUrl = data?.file?.previewUrl || data?.file?.webViewLink;
      } else {
        // Supabase storage file
        const { data, error } = await supabase.storage
          .from("document-attachments")
          .createSignedUrl(entry.file_path, 3600);

        if (error) throw error;
        signedUrl = data.signedUrl;
      }

      if (signedUrl) {
        if (onViewDocument) {
          onViewDocument(signedUrl, entry.file_name);
        } else {
          window.open(signedUrl, "_blank");
        }
      }
    } catch (error) {
      console.error("Error getting file URL:", error);
      toast.error("Failed to load document");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDownload = async (entry: DocumentHistoryEntry) => {
    setLoadingId(entry.id);
    try {
      let signedUrl: string | null = null;

      if (isClientPortal && portalToken) {
        const response = await fetch(
          `${config.supabaseUrl}/functions/v1/client-portal-get-file-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: portalToken,
              file_path: entry.file_path,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to get file URL");
        }
        signedUrl = result.url;
      } else if (!entry.file_path.startsWith("drive://")) {
        const { data, error } = await supabase.storage
          .from("document-attachments")
          .createSignedUrl(entry.file_path, 3600);

        if (error) throw error;
        signedUrl = data.signedUrl;
      }

      if (signedUrl) {
        const link = document.createElement("a");
        link.href = signedUrl;
        link.download = entry.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download document");
    } finally {
      setLoadingId(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <History className="w-4 h-4" />
            <span>Previous Versions</span>
            <Badge variant="secondary" className="text-xs">
              {history.length}
            </Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-6 pr-2 pb-2 space-y-2"
          >
            {history.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
              >
                {/* Timeline connector */}
                {index < history.length - 1 && (
                  <div className="absolute left-[7px] top-8 bottom-0 w-0.5 bg-border" />
                )}
                
                <div className="flex gap-3">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-destructive/20 border-2 border-destructive mt-1" />
                  
                  {/* Content */}
                  <div className="flex-1 bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
                    {/* File info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate line-through text-muted-foreground">
                          {entry.file_name}
                        </span>
                        {entry.file_size && (
                          <span className="text-xs text-muted-foreground/70 flex-shrink-0">
                            ({formatFileSize(entry.file_size)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Uploaded {format(new Date(entry.uploaded_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="w-3 h-3" />
                        Rejected {format(new Date(entry.archived_at), "MMM d, yyyy 'at' h:mm a")}
                        {entry.reviewer_name && (
                          <span className="text-muted-foreground">by {entry.reviewer_name}</span>
                        )}
                      </span>
                    </div>

                    {/* Rejection reason */}
                    {entry.review_comment_at_archive && (
                      <div className="bg-destructive/10 rounded-md px-3 py-2 text-sm text-destructive">
                        "{entry.review_comment_at_archive}"
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleViewDocument(entry)}
                        disabled={loadingId === entry.id}
                      >
                        {loadingId === entry.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Eye className="w-3 h-3 mr-1" />
                        )}
                        View
                      </Button>
                      {!entry.file_path.startsWith("drive://") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleDownload(entry)}
                          disabled={loadingId === entry.id}
                        >
                          {loadingId === entry.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3 mr-1" />
                          )}
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
}
