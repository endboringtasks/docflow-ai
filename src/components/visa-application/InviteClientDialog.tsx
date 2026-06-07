import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Loader2, Mail, Copy, CheckCircle2, CalendarIcon } from "lucide-react";
import { format, startOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

interface InviteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visaApplicationId: string;
  clientId: string;
  clientEmail: string | null;
  companyId: string;
  applicationName: string;
}

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

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
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(addDays(new Date(), 30));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; expiresAt?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; expiresAt?: string } = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.issues[0].message;
    }

    if (!expiresAt) {
      newErrors.expiresAt = "Expiration date is required";
    } else if (startOfDay(expiresAt) < startOfDay(new Date())) {
      newErrors.expiresAt = "Expiration date must be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateAccessLink = async () => {
    if (!validate() || !expiresAt) {
      return;
    }

    setIsGenerating(true);
    try {
      // Generate a secure random token
      const token = crypto.randomUUID() + "-" + crypto.randomUUID();

      // Use the end of the selected day as the expiry moment
      const expiry = new Date(expiresAt);
      expiry.setHours(23, 59, 59, 999);

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
            email: email.trim(),
            access_token: token,
            token_expires_at: expiry.toISOString(),
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
            email: email.trim(),
            access_token: token,
            token_expires_at: expiry.toISOString(),
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
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Client Portal Link</DialogTitle>
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="client@email.com"
              disabled={!!generatedLink}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {!generatedLink && (
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expiration Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="expires-at"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expiresAt && "text-muted-foreground"
                    )}
                    aria-invalid={!!errors.expiresAt}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiresAt ? format(expiresAt, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresAt}
                    onSelect={(date) => {
                      setExpiresAt(date);
                      if (errors.expiresAt) setErrors((prev) => ({ ...prev, expiresAt: undefined }));
                    }}
                    disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.expiresAt && (
                <p className="text-sm text-destructive">{errors.expiresAt}</p>
              )}
            </div>
          )}

          {generatedLink ? (
            <div className="space-y-3">
              <Label>
                Access Link (expires {expiresAt ? format(expiresAt, "PPP") : ""})
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
