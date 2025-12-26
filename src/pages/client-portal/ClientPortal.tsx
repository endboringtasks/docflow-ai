import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  FileText, 
  Upload, 
  CheckCircle2, 
  Circle,
  Send,
  Save,
  AlertCircle,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";
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

interface PortalAccess {
  id: string;
  matter_id: string;
  client_id: string;
  company_id: string;
  email: string;
  is_submitted: boolean;
  submitted_at: string | null;
  token_expires_at: string;
}

interface Matter {
  id: string;
  matter_name: string;
  visa_subclass: string | null;
  status: string;
}

interface Client {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  client_type: string;
}

interface DocumentItem {
  id: string;
  document_name: string;
  is_completed: boolean;
  file_path: string | null;
}

interface FormData {
  personal_info: {
    full_name: string;
    date_of_birth: string;
    nationality: string;
    passport_number: string;
    passport_expiry: string;
  };
  contact_info: {
    phone: string;
    email: string;
    address: string;
  };
  additional_notes: string;
}

const defaultFormData: FormData = {
  personal_info: {
    full_name: "",
    date_of_birth: "",
    nationality: "",
    passport_number: "",
    passport_expiry: "",
  },
  contact_info: {
    phone: "",
    email: "",
    address: "",
  },
  additional_notes: "",
};

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalAccess, setPortalAccess] = useState<PortalAccess | null>(null);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load portal data
  useEffect(() => {
    if (!token) {
      setError("Invalid access link. Please use the link sent to your email.");
      setLoading(false);
      return;
    }

    loadPortalData();
  }, [token]);

  const loadPortalData = async () => {
    try {
      // Validate token using secure RPC function
      const { data: accessData, error: accessError } = await supabase
        .rpc("validate_portal_access_token", { p_token: token });

      if (accessError || !accessData || accessData.length === 0) {
        setError("Invalid or expired access link. Please contact your agent for a new link.");
        setLoading(false);
        return;
      }

      const portalData = accessData[0];
      setPortalAccess(portalData);

      // Update last accessed using secure RPC
      await supabase.rpc("update_portal_access_timestamp", { p_token: token });

      // Load matter details using secure RPC
      const { data: matterData } = await supabase
        .rpc("get_portal_matter_details", { p_token: token });

      if (matterData && matterData.length > 0) {
        setMatter({
          id: matterData[0].matter_id,
          matter_name: matterData[0].matter_name,
          visa_subclass: matterData[0].visa_subclass,
          status: matterData[0].status,
        });
      }

      // Load client details using secure RPC
      const { data: clientData } = await supabase
        .rpc("get_portal_client_details", { p_token: token });

      if (clientData && clientData.length > 0) {
        setClient(clientData[0]);
      }

      // Load document checklist using secure RPC
      const { data: docsData } = await supabase
        .rpc("get_portal_documents", { p_token: token });

      if (docsData) setDocuments(docsData);

      // Load saved form data
      const { data: formDataResult } = await supabase
        .from("client_form_data")
        .select("form_data")
        .eq("matter_id", portalData.matter_id)
        .eq("client_id", portalData.client_id)
        .maybeSingle();

      if (formDataResult?.form_data && typeof formDataResult.form_data === 'object') {
        const savedData = formDataResult.form_data as Record<string, unknown>;
        if (savedData.personal_info && savedData.contact_info) {
          setFormData(savedData as unknown as FormData);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading portal data:", err);
      setError("Failed to load portal data. Please try again later.");
      setLoading(false);
    }
  };

  // Auto-save with debounce
  const saveFormData = useCallback(async (data: FormData) => {
    if (!portalAccess || portalAccess.is_submitted) return;
    
    setIsSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("client_form_data")
        .select("id")
        .eq("matter_id", portalAccess.matter_id)
        .eq("client_id", portalAccess.client_id)
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from("client_form_data")
          .update({ form_data: JSON.parse(JSON.stringify(data)) })
          .eq("id", existing.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("client_form_data")
          .insert([{
            matter_id: portalAccess.matter_id,
            client_id: portalAccess.client_id,
            company_id: portalAccess.company_id,
            form_data: JSON.parse(JSON.stringify(data)),
          }]);
        error = result.error;
      }

      if (error) throw error;
      setLastSaved(new Date());
    } catch (err) {
      console.error("Auto-save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [portalAccess]);

  // Debounced auto-save
  useEffect(() => {
    if (!portalAccess || portalAccess.is_submitted) return;
    
    const timer = setTimeout(() => {
      saveFormData(formData);
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, saveFormData, portalAccess]);

  const updateFormField = (section: keyof FormData, field: string, value: string) => {
    setFormData(prev => {
      if (section === "additional_notes") {
        return { ...prev, additional_notes: value };
      }
      return {
        ...prev,
        [section]: {
          ...(prev[section] as Record<string, string>),
          [field]: value,
        },
      };
    });
  };

  const handleFileUpload = async (docId: string, file: File) => {
    if (!portalAccess) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${docId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { error: updateError } = await supabase
        .from("document_checklist")
        .update({ file_path: filePath, is_completed: true })
        .eq("id", docId);
      
      if (updateError) throw updateError;

      // Refresh documents
      const { data: docsData } = await supabase
        .from("document_checklist")
        .select("id, document_name, is_completed, file_path")
        .eq("matter_id", portalAccess.matter_id)
        .order("created_at", { ascending: true });

      if (docsData) setDocuments(docsData);
      toast.success("Document uploaded successfully");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to upload document");
    }
  };

  const handleSubmit = async () => {
    if (!portalAccess) return;

    setIsSubmitting(true);
    try {
      // Save form data one final time
      await saveFormData(formData);

      // Mark as submitted using secure RPC
      const { data: submitted, error: submitError } = await supabase
        .rpc("submit_portal_access", { p_token: token });

      if (submitError || !submitted) {
        throw new Error("Failed to submit application");
      }

      // Note: Notifications are handled separately since this is unauthenticated access
      // The edge function or backend should handle notifying team members

      setPortalAccess({ ...portalAccess, is_submitted: true });
      setIsSubmitDialogOpen(false);
      toast.success("Application submitted successfully!");
    } catch (err) {
      console.error("Submit failed:", err);
      toast.error("Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Access Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const clientName = client?.client_type === "corporate" 
    ? client.company_name 
    : `${client?.first_name || ""} ${client?.last_name || ""}`.trim();

  const completedDocs = documents.filter(d => d.is_completed).length;
  const totalDocs = documents.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Client Portal</h1>
              <p className="text-sm text-muted-foreground">
                {clientName && `Welcome, ${clientName}`}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Saved {lastSaved.toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {portalAccess?.is_submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
                <p className="text-muted-foreground mb-4">
                  Thank you for submitting your documents. Your agent will review them and contact you if anything else is needed.
                </p>
                <p className="text-sm text-muted-foreground">
                  Submitted on {new Date(portalAccess.submitted_at!).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Matter Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{matter?.matter_name}</CardTitle>
                    {matter?.visa_subclass && (
                      <CardDescription>Visa Subclass: {matter.visa_subclass}</CardDescription>
                    )}
                  </div>
                  <Badge variant="outline">
                    {completedDocs}/{totalDocs} documents
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Personal Information Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>Please fill in your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name (as per passport)</Label>
                    <Input
                      id="full_name"
                      value={formData.personal_info.full_name}
                      onChange={(e) => updateFormField("personal_info", "full_name", e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.personal_info.date_of_birth}
                      onChange={(e) => updateFormField("personal_info", "date_of_birth", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input
                      id="nationality"
                      value={formData.personal_info.nationality}
                      onChange={(e) => updateFormField("personal_info", "nationality", e.target.value)}
                      placeholder="Enter your nationality"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passport_number">Passport Number</Label>
                    <Input
                      id="passport_number"
                      value={formData.personal_info.passport_number}
                      onChange={(e) => updateFormField("personal_info", "passport_number", e.target.value)}
                      placeholder="Enter passport number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passport_expiry">Passport Expiry Date</Label>
                    <Input
                      id="passport_expiry"
                      type="date"
                      value={formData.personal_info.passport_expiry}
                      onChange={(e) => updateFormField("personal_info", "passport_expiry", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
                <CardDescription>How can we reach you?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.contact_info.phone}
                      onChange={(e) => updateFormField("contact_info", "phone", e.target.value)}
                      placeholder="+61 400 000 000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.contact_info.email}
                      onChange={(e) => updateFormField("contact_info", "email", e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Current Address</Label>
                  <Textarea
                    id="address"
                    value={formData.contact_info.address}
                    onChange={(e) => updateFormField("contact_info", "address", e.target.value)}
                    placeholder="Enter your current residential address"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Document Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Checklist
                </CardTitle>
                <CardDescription>
                  Please upload the required documents. Progress: {completedDocs}/{totalDocs}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {doc.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className={doc.is_completed ? "line-through text-muted-foreground" : ""}>
                          {doc.document_name.replace(/^\[.*?\]\s*/, "")}
                        </span>
                      </div>
                      {!doc.is_completed && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(doc.id, file);
                            }}
                          />
                          <Button size="sm" variant="outline" asChild>
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload
                            </span>
                          </Button>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Notes</CardTitle>
                <CardDescription>Any other information you'd like to share</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.additional_notes}
                  onChange={(e) => updateFormField("additional_notes", "", e.target.value)}
                  placeholder="Enter any additional information here..."
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Submit Section */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Ready to submit?</p>
                    <p className="text-sm text-muted-foreground">
                      Make sure all your information is correct and documents are uploaded.
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={() => setIsSubmitDialogOpen(true)}
                    className="gradient-bg"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Your Application?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, you won't be able to make further changes. Your agent will be notified and will review your submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
