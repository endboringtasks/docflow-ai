import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Copy, CheckCircle2 } from "lucide-react";

export interface InviteApplicant {
  id: string;
  displayName: string;
  applicantType: string | null;
  email: string | null;
}

interface InviteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visaApplicationId: string;
  clientId: string;
  companyId: string;
  applicationName: string;
  applicants: InviteApplicant[];
}

// Local date (YYYY-MM-DD) for use as the min attribute and validation baseline
const getTodayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
};

export function InviteClientDialog({
  open,
  onOpenChange,
  visaApplicationId,
  clientId,
  companyId,
  applicationName,
  applicants,
}: InviteClientDialogProps) {
  const [applicantId, setApplicantId] = useState("");
  const [email, setEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [errors, setErrors] = useState<{ applicant?: string; email?: string; expiryDate?: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleApplicantChange = (value: string) => {
    setApplicantId(value);
    setErrors((prev) => ({ ...prev, applicant: undefined }));
    const selected = applicants.find((a) => a.id === value);
    if (selected?.email) {
      setEmail(selected.email);
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const validate = () => {
    const newErrors: { applicant?: string; email?: string; expiryDate?: string } = {};
    const trimmedEmail = email.trim();

    if (!applicantId) {
      newErrors.applicant = "Please select an applicant";
    }

    if (!trimmedEmail) {
      newErrors.email = "Client email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!expiryDate) {
      newErrors.expiryDate = "Expiration date is required";
    } else if (expiryDate < getTodayString()) {
      newErrors.expiryDate = "Expiration date must be today or a future date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateAccessLink = async () => {
    if (!validate()) {
      return;
    }

    setIsGenerating(true);
    try {
      // Generate a secure random token
      const token = crypto.randomUUID() + "-" + crypto.randomUUID();

      // Expire at the end of the chosen day (local time)
      const expiresAt = new Date(`${expiryDate}T23:59:59`);

      // Block creating a new link if this applicant already has an active one
      const { data: activeLinks, error: checkError } = await supabase
        .from("client_portal_access")
        .select("id")
        .eq("visa_application_id", visaApplicationId)
        .eq("application_applicant_id", applicantId)
        .eq("status", "active")
        .gt("token_expires_at", new Date().toISOString());

      if (checkError) throw checkError;

      if (activeLinks && activeLinks.length > 0) {
        toast.error(
          "An active link already exists for this applicant. Revoke it before creating a new one.",
        );
        setIsGenerating(false);
        return;
      }

      // Always create a new record so each applicant has an independent link
      const { error } = await supabase
        .from("client_portal_access")
        .insert({
          visa_application_id: visaApplicationId,
          client_id: clientId,
          application_applicant_id: applicantId,
          company_id: companyId,
          email,
          access_token: token,
          token_expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      // Generate the link
      const portalLink = `${window.location.origin}/client-portal?token=${token}`;
      setGeneratedLink(portalLink);
      setGeneratedExpiry(expiresAt.toISOString());

      toast.success("Access link generated successfully");
    } catch (err) {
      console.error("Failed to generate link:", err);
      toast.error("Failed to generate access link");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setGeneratedExpiry(null);
    setApplicantId("");
    setEmail("");
    setExpiryDate("");
    setErrors({});
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Client to Portal</DialogTitle>
          <DialogDescription>
            Generate an access link for an applicant to view and upload documents for "{applicationName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!generatedLink && (
            <div className="space-y-2">
              <Label htmlFor="applicant">
                Applicant <span className="text-destructive">*</span>
              </Label>
              <Select value={applicantId} onValueChange={handleApplicantChange}>
                <SelectTrigger id="applicant" aria-invalid={!!errors.applicant}>
                  <SelectValue placeholder="Select an applicant" />
                </SelectTrigger>
                <SelectContent>
                  {applicants.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}
                      {a.applicantType ? ` — ${a.applicantType}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.applicant && (
                <p className="text-sm font-medium text-destructive">{errors.applicant}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="client-email">
              Client Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="client@email.com"
              disabled={!!generatedLink}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-sm font-medium text-destructive">{errors.email}</p>
            )}
          </div>

          {!generatedLink && (
            <div className="space-y-2">
              <Label htmlFor="expiry-date">
                Expiration Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expiry-date"
                type="date"
                min={getTodayString()}
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: undefined }));
                }}
                aria-invalid={!!errors.expiryDate}
              />
              {errors.expiryDate && (
                <p className="text-sm font-medium text-destructive">{errors.expiryDate}</p>
              )}
            </div>
          )}

          {generatedLink ? (
            <div className="space-y-3">
              <Label>
                Access Link
                {generatedExpiry &&
                  ` (expires ${new Date(generatedExpiry).toLocaleDateString()})`}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Send this link to your client. They can use it to access their portal and submit documents.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The applicant will receive a link to access their portal where they can fill out forms and upload documents.
            </p>
          )}
        </div>

        <DialogFooter>
          {generatedLink ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={generateAccessLink} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
