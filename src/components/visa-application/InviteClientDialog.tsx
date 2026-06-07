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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Copy, CheckCircle2 } from "lucide-react";

interface InviteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visaApplicationId: string;
  clientId: string;
  clientEmail: string | null;
  companyId: string;
  applicationName: string;
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
  clientEmail,
  companyId,
  applicationName,
}: InviteClientDialogProps) {
  const [email, setEmail] = useState(clientEmail || "");
  const [expiryDate, setExpiryDate] = useState("");
  const [errors, setErrors] = useState<{ email?: string; expiryDate?: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; expiryDate?: string } = {};
    const trimmedEmail = email.trim();

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

      // Check if there's an existing access record for this visa application
      const { data: existing } = await supabase
        .from("client_portal_access")
        .select("id")
        .eq("visa_application_id", visaApplicationId)
        .eq("client_id", clientId)
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("client_portal_access")
          .update({
            email,
            access_token: token,
            token_expires_at: expiresAt.toISOString(),
            is_submitted: false,
            submitted_at: null,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from("client_portal_access")
          .insert({
            visa_application_id: visaApplicationId,
            client_id: clientId,
            company_id: companyId,
            email,
            access_token: token,
            token_expires_at: expiresAt.toISOString(),
          });

        if (error) throw error;
      }

      // Generate the link
      const portalLink = `${window.location.origin}/client-portal?token=${token}`;
      setGeneratedLink(portalLink);
      
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
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Client to Portal</DialogTitle>
          <DialogDescription>
            Generate an access link for the client to view and upload documents for "{applicationName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client-email">Client Email</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@email.com"
              disabled={!!generatedLink}
            />
          </div>

          {generatedLink ? (
            <div className="space-y-3">
              <Label>Access Link (expires in 30 days)</Label>
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
              The client will receive a link to access their portal where they can fill out forms and upload documents.
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
