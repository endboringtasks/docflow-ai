import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getFileTypeBadge } from "@/lib/fileUtils";
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
  File,
  ChevronDown,
  ChevronRight,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  description: string | null;
  category: string | null;
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
      // Map the RPC response to our PortalAccess interface
      setPortalAccess({
        id: portalData.id,
        visa_application_id: portalData.visa_application_id,
        client_id: portalData.client_id,
        company_id: portalData.company_id,
        email: portalData.email,
        is_submitted: portalData.is_submitted,
        submitted_at: portalData.submitted_at,
        token_expires_at: portalData.token_expires_at,
      });

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

      // Load saved form data - use the visa_application_id from RPC
      const visaAppId = portalData.visa_application_id;
      const { data: formDataResult } = await supabase
        .from("client_form_data")
        .select("form_data")
        .eq("visa_application_id", visaAppId)
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

      // Call edge function to notify team and finalize submission
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-submit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }
        );
      } catch (notifyError) {
        console.error("Failed to notify team:", notifyError);
      }

      setPortalAccess(prev => prev ? { ...prev, is_submitted: true } : null);
      setIsSubmitDialogOpen(false);
      toast.success("Application submitted successfully!");
    } catch (err) {
      console.error("Submit failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getClientName = () => {
    if (!client) return "";
    if (client.client_type === "corporate") {
      return client.company_name || "Company";
    }
    return client.first_name ? `${client.first_name}${client.last_name ? ` ${client.last_name}` : ""}` : "Client";
  };

  const completedDocs = documents.filter(d => d.is_completed).length;
  const totalDocs = documents.length;
  const progress = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;

  // Group documents by category
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, DocumentItem[]> = {};
    documents.forEach(doc => {
      const category = doc.category || "Other Documents";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(doc);
    });
    return groups;
  }, [documents]);

  const categoryNames = useMemo(() => Object.keys(groupedDocuments).sort(), [groupedDocuments]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Auto-expand all categories on first load
  useEffect(() => {
    if (categoryNames.length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set(categoryNames));
    }
  }, [categoryNames]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getCategoryProgress = (category: string) => {
    const docs = groupedDocuments[category] || [];
    const completed = docs.filter(d => d.is_completed).length;
    return { completed, total: docs.length };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Access Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Document Portal</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {getClientName()}
              </p>
            </div>
            {!portalAccess?.is_submitted && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {portalAccess?.is_submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <Card className="max-w-lg mx-auto">
              <CardHeader>
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <CardTitle className="text-2xl">Application Submitted!</CardTitle>
                <CardDescription className="text-base">
                  Thank you for submitting your documents. Your agent will review them and contact you if anything else is needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Submitted {portalAccess.submitted_at ? new Date(portalAccess.submitted_at).toLocaleDateString() : "recently"}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Visa Application Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{visaApplication?.application_name}</CardTitle>
                    {visaApplication?.visa_subclass && (
                      <CardDescription>Visa Subclass: {visaApplication.visa_subclass}</CardDescription>
                    )}
                  </div>
                  <Badge variant="outline">
                    {completedDocs}/{totalDocs} documents
                  </Badge>
                </div>
              </CardHeader>
            </Card>



            {/* Document Checklist */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Required Documents
                    </CardTitle>
                    <CardDescription>Upload the required documents for your application</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{Math.round(progress)}%</div>
                    <div className="text-sm text-muted-foreground">Complete</div>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 bg-muted rounded-full mt-4">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryNames.map((category) => {
                    const { completed, total } = getCategoryProgress(category);
                    const isExpanded = expandedCategories.has(category);
                    const categoryDocs = groupedDocuments[category] || [];

                    return (
                      <div key={category} className="border rounded-lg overflow-hidden">
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                            <FolderOpen className="w-5 h-5 text-primary" />
                            <span className="font-semibold">{category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={completed === total ? "default" : "secondary"}
                              className={completed === total ? "bg-green-600" : ""}
                            >
                              {completed}/{total}
                            </Badge>
                          </div>
                        </button>

                        {/* Category Documents */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="p-3 space-y-2">
                                {categoryDocs.map((doc) => (
                                  <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                                      doc.is_completed 
                                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                        : dragOverDocId === doc.id
                                          ? "bg-primary/10 border-primary border-dashed"
                                          : "bg-background border-border/50 hover:border-border"
                                    }`}
                                    onDragOver={(e) => handleDragOver(e, doc.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, doc.id)}
                                  >
                                    <div className="flex-shrink-0">
                                      {doc.is_completed ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`font-medium text-sm ${doc.is_completed ? "text-green-700 dark:text-green-400" : ""}`}>
                                        {doc.document_name}
                                      </p>
                                      {doc.description && !doc.is_completed && (
                                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                          {doc.description}
                                        </p>
                                      )}
                                      {doc.is_completed && doc.file_path && (
                                        <div className="flex items-center gap-2 mt-1">
                                          {isImageFile(doc.file_path) && previewUrls[doc.file_path] ? (
                                            <button 
                                              onClick={() => openPreview(doc.file_path!)}
                                              className="hover:opacity-75 transition-opacity"
                                            >
                                              <img 
                                                src={previewUrls[doc.file_path]} 
                                                alt="Preview" 
                                                className="w-8 h-8 object-cover rounded border"
                                              />
                                            </button>
                                          ) : (
                                            <File className="w-4 h-4 text-muted-foreground" />
                                          )}
                                          {(() => {
                                            const fileType = getFileTypeBadge(doc.file_path);
                                            return fileType ? (
                                              <Badge variant="outline" className={`text-xs ${fileType.color}`}>
                                                {fileType.label}
                                              </Badge>
                                            ) : null;
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                      {doc.is_completed ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveDocument(doc.id)}
                                          disabled={removingDocId === doc.id}
                                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                        >
                                          {removingDocId === doc.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <X className="w-4 h-4" />
                                          )}
                                        </Button>
                                      ) : (
                                        <label className="cursor-pointer">
                                          <input
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleFileUpload(doc.id, file);
                                              e.target.value = "";
                                            }}
                                            disabled={uploadingDocId === doc.id}
                                          />
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            disabled={uploadingDocId === doc.id}
                                            className="h-8"
                                          >
                                            <span>
                                              {uploadingDocId === doc.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <>
                                                  <Upload className="w-4 h-4 mr-1" />
                                                  Upload
                                                </>
                                              )}
                                            </span>
                                          </Button>
                                        </label>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Notes</CardTitle>
                <CardDescription>Any additional information you'd like to share</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.additional_notes}
                  onChange={(e) => updateFormField("additional_notes", "", e.target.value)}
                  placeholder="Enter any additional notes or comments..."
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => setIsSubmitDialogOpen(true)}
                disabled={completedDocs === 0}
                className="gap-2"
              >
                <Send className="w-5 h-5" />
                Submit Application
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Application?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, you won't be able to make changes. Make sure all your information is correct and all required documents are uploaded.
              <br /><br />
              <strong>{completedDocs}</strong> of <strong>{totalDocs}</strong> documents uploaded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
        <DialogContent className="max-w-3xl p-0">
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Document preview" 
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
