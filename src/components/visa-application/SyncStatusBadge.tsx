import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SyncStatus =
  | "pending"
  | "processing"
  | "synced"
  | "failed"
  | "waiting_for_drive"
  | "not_applicable"
  | null
  | undefined;

interface SyncStatusBadgeProps {
  status: SyncStatus;
  error?: string | null;
  className?: string;
}

/**
 * Internal-only badge showing whether a file has been copied to Google Drive.
 * Hidden when Drive sync is not applicable (e.g., Drive not connected).
 */
export function SyncStatusBadge({ status, error, className }: SyncStatusBadgeProps) {
  if (!status || status === "not_applicable") return null;

  if (status === "synced") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400",
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Synced
      </Badge>
    );
  }

  if (status === "failed") {
    const badge = (
      <Badge variant="destructive" className={cn("gap-1", className)}>
        <AlertTriangle className="h-3 w-3" />
        Failed
      </Badge>
    );

    if (!error) return badge;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">Drive sync failed: {error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // pending / processing / waiting_for_drive
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}
