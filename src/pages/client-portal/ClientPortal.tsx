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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  FileText, 
  Upload, 
  CheckCircle2, 
  Circle,
  Send,
  Save,
  AlertCircle,
  Clock,
  X,
  File
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface PortalAccess {
  id: string;
  visa_application_id: string;
  client_id: string;
  company_id: string;
  email: string;
  is_submitted: boolean;
  submitted_at: string | null;
  token_expires_at: string;
}

interface VisaApplication {
  id: string;
  application_name: string;
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
  const [visaApplication, setVisaApplication] = useState<VisaApplication | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [removingDocId, setRemovingDocId] = useState<string | null>(null);
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // File validation constants
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
  ];
  const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];

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

      // Load visa application details using secure RPC
      const { data: visaAppData } = await supabase
        .rpc("get_portal_visa_application_details", { p_token: token });

      if (visaAppData && visaAppData.length > 0) {
        setVisaApplication({
          id: visaAppData[0].visa_application_id,
          application_name: visaAppData[0].application_name,
          visa_subclass: visaAppData[0].visa_subclass,
          status: visaAppData[0].status,
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
        .eq("visa_application_id", portalData.visa_application_id)
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
        .eq("visa_application_id", portalAccess.visa_application_id)
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
            visa_application_id: portalAccess.visa_application_id,
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

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`;
    }

    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return `Invalid file type. Allowed types: PDF, JPG, PNG, GIF, WebP, HEIC`;
    }

    // Also check MIME type if available
    if (file.type && !ALLOWED_FILE_TYPES.includes(file.type) && file.type !== '') {
      return `Invalid file type. Allowed types: PDF, JPG, PNG, GIF, WebP, HEIC`;
    }

    return null;
  };

  const handleFileUpload = async (docId: string, file: File) => {
    if (!portalAccess || !token) return;

    // Validate file before upload
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploadingDocId(docId);
    
    try {
      // Use edge function for unauthenticated upload
      const formData = new FormData();
      formData.append('token', token);
      formData.append('doc_id', docId);
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Refresh documents using secure RPC
      const { data: docsData } = await supabase
        .rpc("get_portal_documents", { p_token: token });

      if (docsData) setDocuments(docsData);
      toast.success("Document uploaded successfully");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!token) return;

    setRemovingDocId(docId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-remove-document`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, doc_id: docId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Remove failed');
      }

      // Refresh documents
      const { data: docsData } = await supabase
        .rpc("get_portal_documents", { p_token: token });

      if (docsData) setDocuments(docsData);
      toast.success("Document removed");
    } catch (err) {
      console.error("Remove failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to remove document");
    } finally {
      setRemovingDocId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDocId(docId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDocId(null);
  };

  const handleDrop = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDocId(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(docId, file);
    }
  };

  const getFileName = (filePath: string | null): string => {
    if (!filePath) return '';
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    // Remove timestamp prefix if present
    const match = fileName.match(/^\d+\.(.+)$/);
    return match ? match[1] : fileName;
  };

  const isImageFile = (filePath: string | null): boolean => {
    if (!filePath) return false;
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };

  const getPreviewUrl = async (filePath: string): Promise<string | null> => {
    if (!token || previewUrls[filePath]) return previewUrls[filePath] || null;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-get-file-url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, file_path: filePath }),
        }
      );

      const result = await response.json();
      if (response.ok && result.url) {
        setPreviewUrls(prev => ({ ...prev, [filePath]: result.url }));
        return result.url;
      }
    } catch (err) {
      console.error('Failed to get preview URL:', err);
    }
    return null;
  };

  // Load preview URLs for completed documents
  useEffect(() => {
    if (!token || documents.length === 0) return;

    const loadPreviews = async () => {
      for (const doc of documents) {
        if (doc.is_completed && doc.file_path && isImageFile(doc.file_path) && !previewUrls[doc.file_path]) {
          await getPreviewUrl(doc.file_path);
        }
      }
    };

    loadPreviews();
  }, [documents, token]);

  const openPreview = async (filePath: string) => {
    let url = previewUrls[filePath];
    if (!url) {
      url = await getPreviewUrl(filePath) || '';
    }
    if (url) {
      setPreviewImage(url);
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

      setPortalAccess({ ...portalAccess, is_submitted: true, submitted_at: new Date().toISOString() });
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
                  Submitted on {new Date(portalAccess.submitted_at!).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' })}
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
                    <Select
                      value={formData.personal_info.nationality}
                      onValueChange={(value) => updateFormField("personal_info", "nationality", value)}
                    >
                      <SelectTrigger id="nationality">
                        <SelectValue placeholder="Select your nationality" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine", "Armenian", "Australian", "Austrian",
                          "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese",
                          "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian", "Cambodian",
                          "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comorian", "Congolese",
                          "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djiboutian", "Dominican", "Dutch", "Ecuadorian",
                          "Egyptian", "Emirati", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino", "Finnish", "French",
                          "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guyanese",
                          "Haitian", "Honduran", "Hungarian", "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli",
                          "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakh", "Kenyan", "Kuwaiti", "Kyrgyz", "Laotian",
                          "Latvian", "Lebanese", "Liberian", "Libyan", "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian",
                          "Maldivian", "Malian", "Maltese", "Mauritanian", "Mauritian", "Mexican", "Moldovan", "Monacan", "Mongolian", "Montenegrin",
                          "Moroccan", "Mozambican", "Namibian", "Nepalese", "New Zealand", "Nicaraguan", "Nigerian", "North Korean", "Norwegian", "Omani",
                          "Pakistani", "Palestinian", "Panamanian", "Paraguayan", "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian",
                          "Rwandan", "Saudi", "Senegalese", "Serbian", "Singaporean", "Slovak", "Slovenian", "Somali", "South African", "South Korean",
                          "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajik", "Tanzanian",
                          "Thai", "Togolese", "Trinidadian", "Tunisian", "Turkish", "Turkmen", "Ugandan", "Ukrainian", "Uruguayan", "Uzbek",
                          "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean"
                        ].map((nationality) => (
                          <SelectItem key={nationality} value={nationality}>
                            {nationality}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  Please upload the required documents (PDF or images, max 10MB). Drag & drop or click to upload.
                  <br />Progress: {completedDocs}/{totalDocs}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-colors ${
                        dragOverDocId === doc.id && !doc.is_completed
                          ? 'border-primary bg-primary/10'
                          : 'bg-card hover:bg-accent/5'
                      }`}
                      onDragOver={(e) => !doc.is_completed && handleDragOver(e, doc.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => !doc.is_completed && handleDrop(e, doc.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Thumbnail for images */}
                        {doc.is_completed && doc.file_path && isImageFile(doc.file_path) && previewUrls[doc.file_path] ? (
                          <button
                            type="button"
                            onClick={() => openPreview(doc.file_path!)}
                            className="w-10 h-10 rounded border overflow-hidden shrink-0 hover:ring-2 ring-primary transition-all cursor-pointer"
                          >
                            <img
                              src={previewUrls[doc.file_path]}
                              alt={doc.document_name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : doc.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className={doc.is_completed ? "text-muted-foreground" : ""}>
                            {doc.document_name.replace(/^\[.*?\]\s*/, "")}
                          </span>
                          {doc.is_completed && doc.file_path && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <File className="h-3 w-3" />
                              <span className="truncate">{getFileName(doc.file_path)}</span>
                              {isImageFile(doc.file_path) && previewUrls[doc.file_path] && (
                                <button
                                  type="button"
                                  onClick={() => openPreview(doc.file_path!)}
                                  className="text-primary hover:underline ml-1"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        {doc.is_completed ? (
                          // Show remove/replace options for completed documents
                          removingDocId === doc.id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Removing...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <label className={`cursor-pointer ${uploadingDocId || removingDocId ? 'pointer-events-none opacity-50' : ''}`}>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic"
                                  disabled={!!uploadingDocId || !!removingDocId}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      // First remove, then upload
                                      handleRemoveDocument(doc.id).then(() => {
                                        handleFileUpload(doc.id, file);
                                      });
                                    }
                                    e.target.value = '';
                                  }}
                                />
                                <Button size="sm" variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
                                  <span>
                                    <Upload className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveDocument(doc.id)}
                                disabled={!!uploadingDocId || !!removingDocId}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        ) : (
                          // Show upload for incomplete documents
                          uploadingDocId === doc.id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <label className={`cursor-pointer ${uploadingDocId || removingDocId ? 'pointer-events-none opacity-50' : ''}`}>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic"
                                disabled={!!uploadingDocId || !!removingDocId}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(doc.id, file);
                                  e.target.value = '';
                                }}
                              />
                              <Button size="sm" variant="outline" asChild disabled={!!uploadingDocId || !!removingDocId}>
                                <span>
                                  <Upload className="h-4 w-4 mr-2" />
                                  {dragOverDocId === doc.id ? 'Drop here' : 'Upload'}
                                </span>
                              </Button>
                            </label>
                          )
                        )}
                      </div>
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

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewImage && (
            <img
              src={previewImage}
              alt="Document preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
