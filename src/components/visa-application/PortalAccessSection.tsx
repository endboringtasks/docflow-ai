import { useState } from "react";
import { format } from "date-fns";
import { Ban, Link2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface PortalAccessRecord {
  id: string;
  email: string;
  status: string;
  token_expires_at: string;
  is_submitted: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  last_accessed_at: string | null;
  application_applicant_id: string | null;
}

interface PortalAccessSectionProps {
  visaApplicationId: string;
  userId: string | undefined;
  applicantNames?: Record<string, string>;
}

type LinkState = "revoked" | "expired" | "submitted" | "active";

const getLinkState = (record: PortalAccessRecord): LinkState => {
  if (record.status === "revoked") return "revoked";
  if (new Date(record.token_expires_at) < new Date()) return "expired";
  if (record.is_submitted) return "submitted";
  return "active";
};

export function PortalAccessSection({ visaApplicationId, userId, applicantNames }: PortalAccessSectionProps) {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<PortalAccessRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["portal-access", visaApplicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_access")
        .select(
          "id, email, status, token_expires_at, is_submitted, revoked_at, revoked_reason, created_at, last_accessed_at, application_applicant_id",
        )
        .eq("visa_application_id", visaApplicationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PortalAccessRecord[];
    },
    enabled: !!visaApplicationId,
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("client_portal_access")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: userId ?? null,
          revoked_reason: reason.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-access", visaApplicationId] });
      toast.success("Portal access link revoked");
      setRevokeTarget(null);
      setRevokeReason("");
    },
    onError: (err) => {
      console.error("Failed to revoke portal access:", err);
      toast.error("Failed to revoke portal access link");
    },
  });

  const renderStatusBadge = (state: LinkState) => {
    switch (state) {
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "submitted":
        return <Badge variant="default">Submitted</Badge>;
      default:
        return <Badge variant="outline" className="border-green-500 text-green-600">Active</Badge>;
    }
  };

  if (!isLoading && records.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Portal Access Links</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const state = getLinkState(record);
            return (
              <div
                key={record.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{record.email}</span>
                    {renderStatusBadge(state)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(record.created_at), "PP")} · Expires{" "}
                    {format(new Date(record.token_expires_at), "PP")}
                  </p>
                  {state === "revoked" && record.revoked_at && (
                    <p className="text-xs text-muted-foreground">
                      Revoked {format(new Date(record.revoked_at), "PPp")}
                      {record.revoked_reason ? ` · ${record.revoked_reason}` : ""}
                    </p>
                  )}
                </div>
                {state === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setRevokeReason("");
                      setRevokeTarget(record);
                    }}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
            setRevokeReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke portal access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately disable the access link for{" "}
              <span className="font-medium">{revokeTarget?.email}</span>. The client will no longer
              be able to open the portal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="revoke-reason">Reason (optional)</Label>
            <Textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Why is this link being revoked?"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (revokeTarget) {
                  revokeMutation.mutate({ id: revokeTarget.id, reason: revokeReason });
                }
              }}
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
