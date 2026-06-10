import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface OwnedCompany {
  name: string;
}

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONFIRM_WORD = "DELETE";

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownedCompanies, setOwnedCompanies] = useState<OwnedCompany[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    setConfirmText("");
    setError(null);

    const fetchOwned = async () => {
      const { data: memberships } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("role", "owner");

      const ids = (memberships ?? []).map((m) => m.company_id);
      if (ids.length === 0) {
        setOwnedCompanies([]);
        return;
      }

      const { data: companies } = await supabase
        .from("companies")
        .select("name")
        .in("id", ids);

      setOwnedCompanies(companies ?? []);
    };

    fetchOwned();
  }, [open, user]);

  const canConfirm = confirmText.trim() === CONFIRM_WORD && !isDeleting;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setIsDeleting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("delete-my-account");

      if (fnError || (data && data.error)) {
        throw new Error(
          (data && data.error) || fnError?.message || "Failed to delete account",
        );
      }

      // Success — revoke session and redirect to logged-out state
      queryClient.clear();
      await signOut();
      window.location.replace("/auth?deleted=1");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn't delete your account. Please try again or contact support.",
      );
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isDeleting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete My Account
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This is irreversible</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Your profile and login will be <strong>permanently deleted</strong>. You will
                be signed out immediately and will no longer be able to access the platform.
              </p>
              {ownedCompanies.length > 0 && (
                <div>
                  <p>
                    The following workspace
                    {ownedCompanies.length > 1 ? "s you own will be permanently removed" : " you own will be permanently removed"},
                    including all clients, applications, and documents:
                  </p>
                  <ul className="list-disc pl-5 mt-1">
                    {ownedCompanies.map((c, i) => (
                      <li key={i} className="font-medium">
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs">
                Operational and audit logs are retained but stripped of your identifying
                details for compliance purposes.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              disabled={isDeleting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-1">
                <p>{error}</p>
                <p className="text-xs">
                  Your account is still active. You can retry, or contact support if the problem
                  persists.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canConfirm}>
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete My Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
