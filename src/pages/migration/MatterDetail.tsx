import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft,
  User,
  FolderOpen,
  Loader2,
  FileText,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  Upload,
  Download,
  X,
  File,
  ExternalLink,
  Mail,
  Eye,
  AlertCircle,
  XCircle,
  Filter,
  Clock,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { InviteClientDialog } from "@/components/matter/InviteClientDialog";
import { DocumentPreviewDialog, ReviewStatus } from "@/components/matter/DocumentPreviewDialog";
import { useAuth } from "@/hooks/useAuth";

interface Matter {
  id: string;
  client_id: string;
  matter_name: string;
  visa_subclass: string | null;
  status: "draft" | "active" | "done";
  visa_application_folder_id: string | null;
  folder_status: "pending" | "creating" | "created" | "failed";
  created_at: string;
  company_id: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  client_type: "personal" | "corporate";
}

interface DocumentItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  completed: boolean;
  filePath: string | null;
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedByClient: string | null;
  uploadedByClientName: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
}

interface DbDocumentItem {
  id: string;
  matter_id: string;
  company_id: string;
  document_name: string;
  is_completed: boolean;
  file_path: string | null;
  review_status: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  uploaded_by_client: string | null;
  uploader_profile?: { display_name: string | null; email: string | null } | null;
  uploader_client?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  reviewer_profile?: { display_name: string | null; email: string | null } | null;
  created_at: string;
  updated_at: string;
}

const visaSubclasses = [
  { value: "482", label: "Temporary Skill Shortage (482)" },
  { value: "186", label: "Employer Nomination Scheme (186)" },
  { value: "189", label: "Skilled Independent (189)" },
  { value: "190", label: "Skilled Nominated (190)" },
  { value: "500", label: "Student Visa (500)" },
  { value: "820", label: "Partner Visa (820)" },
  { value: "188", label: "Business Innovation (188)" },
  { value: "600", label: "Visitor Visa (600)" },
];

const statusOptions = [
  { value: "draft", label: "Draft", description: "Application is being prepared" },
  { value: "active", label: "Active", description: "Application is in progress" },
  { value: "done", label: "Done", description: "Application is completed" },
];

// Default document checklist based on visa subclass (excluding DB-only fields)
type DefaultDocFields = Omit<DocumentItem, "id" | "filePath" | "reviewStatus" | "reviewComment" | "uploadedAt" | "uploadedBy" | "uploadedByName" | "uploadedByClient" | "uploadedByClientName" | "reviewedAt" | "reviewedBy" | "reviewedByName">;

const getDefaultDocuments = (visaSubclass: string | null): DefaultDocFields[] => {
  const baseDocuments: DefaultDocFields[] = [
    { name: "Passport (certified copy)", category: "Identity", required: true, completed: false },
    { name: "Birth Certificate", category: "Identity", required: true, completed: false },
    { name: "Passport Photos", category: "Identity", required: true, completed: false },
    { name: "Police Clearance Certificate", category: "Character", required: true, completed: false },
    { name: "Health Examination Results", category: "Health", required: true, completed: false },
  ];

  const additionalDocsByVisa: Record<string, DefaultDocFields[]> = {
    "482": [
      { name: "Employment Contract", category: "Employment", required: true, completed: false },
      { name: "Skills Assessment", category: "Skills", required: true, completed: false },
      { name: "English Language Test Results", category: "English", required: true, completed: false },
      { name: "Qualifications/Degrees", category: "Education", required: true, completed: false },
      { name: "Resume/CV", category: "Employment", required: true, completed: false },
    ],
    "186": [
      { name: "Nomination Approval", category: "Nomination", required: true, completed: false },
      { name: "Skills Assessment", category: "Skills", required: true, completed: false },
      { name: "English Language Test Results", category: "English", required: true, completed: false },
      { name: "Employment References", category: "Employment", required: true, completed: false },
    ],
    "500": [
      { name: "Confirmation of Enrolment (CoE)", category: "Education", required: true, completed: false },
      { name: "English Language Test Results", category: "English", required: true, completed: false },
      { name: "Financial Evidence", category: "Financial", required: true, completed: false },
      { name: "OSHC Policy", category: "Insurance", required: true, completed: false },
    ],
    "820": [
      { name: "Relationship Evidence", category: "Relationship", required: true, completed: false },
      { name: "Sponsor's Identity Documents", category: "Sponsor", required: true, completed: false },
      { name: "Form 888 Statutory Declarations", category: "Relationship", required: true, completed: false },
      { name: "Joint Financial Records", category: "Financial", required: true, completed: false },
    ],
  };

  return [...baseDocuments, ...(additionalDocsByVisa[visaSubclass || ""] || [])];
};

// Parse document name to extract category and required status
const parseDocumentName = (name: string): { displayName: string; category: string; required: boolean } => {
  // Check if it's a custom document
  if (name.startsWith("[Custom] ")) {
    return { displayName: name.replace("[Custom] ", ""), category: "Custom", required: false };
  }
  
  // Check for category prefix pattern like "[Category:Required] Name"
  const match = name.match(/^\[([^:]+):?(required|optional)?\]\s*(.+)$/i);
  if (match) {
    return { 
      displayName: match[3], 
      category: match[1], 
      required: match[2]?.toLowerCase() === "required" 
    };
  }
  
  // Default: treat as standard required document
  return { displayName: name, category: "General", required: true };
};

// Format document for storage
const formatDocumentForStorage = (doc: DefaultDocFields): string => {
  if (doc.category === "Custom") {
    return `[Custom] ${doc.name}`;
  }
  return `[${doc.category}:${doc.required ? "required" : "optional"}] ${doc.name}`;
};

const MatterDetail = () => {
  const { matterId } = useParams<{ matterId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [documentsInitialized, setDocumentsInitialized] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>("all");
  
  const [editForm, setEditForm] = useState({
    matterName: "",
    visaSubclass: "",
  });

  // Fetch matter details
  const { data: matter, isLoading: isLoadingMatter } = useQuery({
    queryKey: ["matter", matterId],
    queryFn: async () => {
      if (!matterId) return null;
      
      const { data, error } = await supabase
        .from("matters")
        .select("*")
        .eq("id", matterId)
        .maybeSingle();
      
      if (error) throw error;
      return data as Matter | null;
    },
    enabled: !!matterId,
  });

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["matter-client", matter?.client_id],
    queryFn: async () => {
      if (!matter?.client_id) return null;
      
      // Use secure RPC function that masks PII for non-admins
      const { data, error } = await supabase
        .rpc("get_client_by_id", { p_client_id: matter.client_id });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] as Client : null;
    },
    enabled: !!matter?.client_id,
  });

  // Fetch document checklist from database
  const { data: dbDocumentsRaw, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["document-checklist", matterId],
    queryFn: async () => {
      if (!matterId) return [];
      
      const { data, error } = await supabase
        .from("document_checklist")
        .select("*")
        .eq("matter_id", matterId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!matterId,
  });

  // Fetch uploader and reviewer profiles for documents
  const uploaderIds = [...new Set((dbDocumentsRaw || []).map(d => d.uploaded_by).filter(Boolean))] as string[];
  const reviewerIds = [...new Set((dbDocumentsRaw || []).map(d => d.reviewed_by).filter(Boolean))] as string[];
  const clientUploaderIds = [...new Set((dbDocumentsRaw || []).map(d => d.uploaded_by_client).filter(Boolean))] as string[];
  const allProfileIds = [...new Set([...uploaderIds, ...reviewerIds])];
  
  const { data: userProfiles } = useQuery({
    queryKey: ["document-user-profiles", allProfileIds],
    queryFn: async () => {
      if (allProfileIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", allProfileIds);
      
      if (error) throw error;
      
      const profileMap: Record<string, { display_name: string | null; email: string | null }> = {};
      (data || []).forEach(p => {
        profileMap[p.id] = { display_name: p.display_name, email: p.email };
      });
      return profileMap;
    },
    enabled: allProfileIds.length > 0,
  });

  // Fetch client uploader details
  const { data: clientProfiles } = useQuery({
    queryKey: ["document-client-profiles", clientUploaderIds],
    queryFn: async () => {
      if (clientUploaderIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email")
        .in("id", clientUploaderIds);
      
      if (error) throw error;
      
      const clientMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
      (data || []).forEach(c => {
        clientMap[c.id] = { first_name: c.first_name, last_name: c.last_name, email: c.email };
      });
      return clientMap;
    },
    enabled: clientUploaderIds.length > 0,
  });

  // Merge documents with uploader and reviewer profiles
  const dbDocuments: DbDocumentItem[] = (dbDocumentsRaw || []).map(doc => ({
    ...doc,
    uploader_profile: doc.uploaded_by && userProfiles ? userProfiles[doc.uploaded_by] : null,
    uploader_client: doc.uploaded_by_client && clientProfiles ? clientProfiles[doc.uploaded_by_client] : null,
    reviewer_profile: doc.reviewed_by && userProfiles ? userProfiles[doc.reviewed_by] : null,
  }));

  // Initialize documents in database if none exist
  const initializeDocumentsMutation = useMutation({
    mutationFn: async (docs: DefaultDocFields[]) => {
      if (!matterId || !matter?.company_id) throw new Error("Missing IDs");
      
      const documentsToInsert = docs.map(doc => ({
        matter_id: matterId,
        company_id: matter.company_id,
        document_name: formatDocumentForStorage(doc),
        is_completed: false,
      }));
      
      const { data, error } = await supabase
        .from("document_checklist")
        .insert(documentsToInsert)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
      setDocumentsInitialized(true);
    },
    onError: (error) => {
      console.error("Failed to initialize documents:", error);
    },
  });

  // Initialize documents when matter loads and no documents exist
  useEffect(() => {
    if (matter && dbDocuments !== undefined && dbDocuments.length === 0 && !documentsInitialized && !initializeDocumentsMutation.isPending) {
      const defaultDocs = getDefaultDocuments(matter.visa_subclass);
      initializeDocumentsMutation.mutate(defaultDocs);
    }
  }, [matter, dbDocuments, documentsInitialized]);

  // Transform DB documents to UI format
  const documents: DocumentItem[] = (dbDocuments || []).map(doc => {
    const parsed = parseDocumentName(doc.document_name);
    const uploaderProfile = doc.uploader_profile;
    const uploaderName = uploaderProfile?.display_name || uploaderProfile?.email || null;
    const uploaderClient = doc.uploader_client;
    const uploaderClientName = uploaderClient 
      ? (uploaderClient.first_name && uploaderClient.last_name 
          ? `${uploaderClient.first_name} ${uploaderClient.last_name}` 
          : uploaderClient.email || "Client")
      : null;
    const reviewerProfile = doc.reviewer_profile;
    const reviewerName = reviewerProfile?.display_name || reviewerProfile?.email || null;
    return {
      id: doc.id,
      name: parsed.displayName,
      category: parsed.category,
      required: parsed.required,
      completed: doc.is_completed,
      filePath: doc.file_path,
      reviewStatus: (doc.review_status as ReviewStatus) || "pending_client",
      reviewComment: doc.review_comment,
      uploadedAt: doc.uploaded_at,
      uploadedBy: doc.uploaded_by,
      uploadedByName: uploaderName,
      uploadedByClient: doc.uploaded_by_client,
      uploadedByClientName: uploaderClientName,
      reviewedAt: doc.reviewed_at,
      reviewedBy: doc.reviewed_by,
      reviewedByName: reviewerName,
    };
  });

  // Toggle document completion
  const toggleDocumentMutation = useMutation({
    mutationFn: async ({ docId, isCompleted }: { docId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("document_checklist")
        .update({ is_completed: isCompleted })
        .eq("id", docId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
    },
    onError: (error) => {
      toast.error("Failed to update document", { description: error.message });
    },
  });

  // Add custom document
  const addDocumentMutation = useMutation({
    mutationFn: async (docName: string) => {
      if (!matterId || !matter?.company_id) throw new Error("Missing IDs");
      
      const { data, error } = await supabase
        .from("document_checklist")
        .insert({
          matter_id: matterId,
          company_id: matter.company_id,
          document_name: `[Custom] ${docName}`,
          is_completed: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
      setNewDocName("");
      toast.success("Document added to checklist");
    },
    onError: (error) => {
      toast.error("Failed to add document", { description: error.message });
    },
  });

  // Remove document
  const removeDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      // First get the document to check if it has a file
      const doc = dbDocuments?.find(d => d.id === docId);
      if (doc?.file_path) {
        // Delete the file from storage
        await supabase.storage
          .from("document-attachments")
          .remove([doc.file_path]);
      }
      
      const { error } = await supabase
        .from("document_checklist")
        .delete()
        .eq("id", docId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
      toast.success("Document removed");
    },
    onError: (error) => {
      toast.error("Failed to remove document", { description: error.message });
    },
  });

  // Upload file for a document - uses edge function for Google Drive sync
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      docId,
      file,
      documentName,
    }: {
      docId: string;
      file: File;
      documentName: string;
    }) => {
      const formData = new FormData();
      formData.append("matter_id", matterId!);
      formData.append("doc_id", docId);
      formData.append("file", file);
      formData.append("document_name", documentName);

      const { data, error } = await supabase.functions.invoke("internal-upload", {
        body: formData,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Upload failed");

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
      const location = data.uploaded_to === "google_drive" ? "Google Drive" : "storage";
      toast.success(`File uploaded to ${location}`);
    },
    onError: (error) => {
      toast.error("Failed to upload file", { description: error.message });
    },
  });

  // Remove file from a document
  const removeFileMutation = useMutation({
    mutationFn: async ({ docId, filePath }: { docId: string; filePath: string }) => {
      const { error: removeError } = await supabase.storage
        .from("document-attachments")
        .remove([filePath]);
      
      if (removeError) throw removeError;
      
      const { error: updateError } = await supabase
        .from("document_checklist")
        .update({ file_path: null })
        .eq("id", docId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
      toast.success("File removed");
    },
    onError: (error) => {
      toast.error("Failed to remove file", { description: error.message });
    },
  });

  // Update document review status
  const updateReviewMutation = useMutation({
    mutationFn: async ({ docId, status, comment }: { docId: string; status: ReviewStatus; comment: string }) => {
      const { error } = await supabase
        .from("document_checklist")
        .update({
          review_status: status,
          review_comment: comment || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", docId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", matterId] });
    },
    onError: (error) => {
      toast.error("Failed to update review", { description: error.message });
    },
  });

  // Handle review update from dialog
  const handleReviewUpdate = async (docId: string, status: ReviewStatus, comment: string) => {
    await updateReviewMutation.mutateAsync({ docId, status, comment });
  };

  // Handle request for new/different document
  const handleRequestNewDocument = async (docId: string, comment: string) => {
    await updateReviewMutation.mutateAsync({ docId, status: "pending_client", comment });
    // TODO: Could trigger notification to client here
  };

  // Update matter mutation
  const updateMatterMutation = useMutation({
    mutationFn: async (matterData: {
      matter_name: string;
      visa_subclass: string | null;
    }) => {
      if (!matterId) throw new Error("No matter ID");
      
      const { data, error } = await supabase
        .from("matters")
        .update({
          matter_name: matterData.matter_name,
          visa_subclass: matterData.visa_subclass,
        })
        .eq("id", matterId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Dispatch webhook for matter.updated event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "matter.updated",
            data: {
              matter_id: data.id,
              company_id: data.company_id,
              client_id: data.client_id,
              matter_name: data.matter_name,
              visa_subclass: data.visa_subclass,
              status: data.status,
              visa_application_folder_id: data.visa_application_folder_id,
            },
          },
        });

        if (invokeError) throw invokeError;
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }
      
      queryClient.invalidateQueries({ queryKey: ["matter", matterId] });
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      setIsEditOpen(false);
      toast.success("Application updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update application", {
        description: error.message,
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: "draft" | "active" | "done") => {
      if (!matterId) throw new Error("No matter ID");
      
      const { data, error } = await supabase
        .from("matters")
        .update({ status })
        .eq("id", matterId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Dispatch webhook for matter.updated event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "matter.updated",
            data: {
              matter_id: data.id,
              company_id: data.company_id,
              client_id: data.client_id,
              matter_name: data.matter_name,
              visa_subclass: data.visa_subclass,
              status: data.status,
              visa_application_folder_id: data.visa_application_folder_id,
            },
          },
        });

        if (invokeError) throw invokeError;
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }
      
      queryClient.invalidateQueries({ queryKey: ["matter", matterId] });
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      toast.success("Status updated!");
    },
    onError: (error) => {
      toast.error("Failed to update status", {
        description: error.message,
      });
    },
  });

  // Delete matter mutation
  const deleteMatterMutation = useMutation({
    mutationFn: async () => {
      if (!matterId || !matter) throw new Error("No matter ID");
      
      // Store matter data before deletion for webhook
      const matterData = {
        matter_id: matter.id,
        company_id: matter.company_id,
        client_id: matter.client_id,
        matter_name: matter.matter_name,
        visa_subclass: matter.visa_subclass,
        status: matter.status,
        visa_application_folder_id: matter.visa_application_folder_id,
      };
      
      const { error } = await supabase
        .from("matters")
        .delete()
        .eq("id", matterId);
      
      if (error) throw error;
      return matterData;
    },
    onSuccess: async (matterData) => {
      // Dispatch webhook for matter.deleted event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "matter.deleted",
            data: matterData,
          },
        });

        if (invokeError) throw invokeError;
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }
      
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      toast.success("Application deleted");
      navigate("/app/migration/visa-applications");
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      });
    },
  });

  const handleEditMatter = () => {
    if (!matter) return;
    setEditForm({
      matterName: matter.matter_name,
      visaSubclass: matter.visa_subclass || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdateMatter = () => {
    if (!editForm.matterName.trim()) return;
    
    updateMatterMutation.mutate({
      matter_name: editForm.matterName.trim(),
      visa_subclass: editForm.visaSubclass || null,
    });
  };

  const handleToggleDocument = (docId: string, currentCompleted: boolean) => {
    toggleDocumentMutation.mutate({ docId, isCompleted: !currentCompleted });
  };

  const handleAddDocument = () => {
    if (!newDocName.trim()) return;
    addDocumentMutation.mutate(newDocName.trim());
  };

  const handleRemoveDocument = (docId: string) => {
    removeDocumentMutation.mutate(docId);
  };

  const handleFileUpload = (docId: string, file: File, documentName: string) => {
    uploadFileMutation.mutate({ docId, file, documentName });
  };

  const handleFileRemove = (docId: string, filePath: string) => {
    removeFileMutation.mutate({ docId, filePath });
  };

  const getFileDownloadUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("document-attachments")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("document-attachments")
      .download(filePath);
    
    if (error) {
      toast.error("Failed to download file", { description: error.message });
      return;
    }
    
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: Matter["status"]) => {
    switch (status) {
      case "draft": return "secondary";
      case "active": return "default";
      case "done": return "success";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const completedCount = documents.filter(d => d.completed).length;
  const requiredCount = documents.filter(d => d.required).length;
  const requiredCompleted = documents.filter(d => d.required && d.completed).length;
  const progress = documents.length > 0 ? Math.round((completedCount / documents.length) * 100) : 0;

  // Apply review status filter - MUST be before any conditional returns (hooks rule)
  const filteredDocuments = useMemo(() => {
    if (reviewFilter === "all") return documents;
    return documents.filter(d => d.reviewStatus === reviewFilter);
  }, [documents, reviewFilter]);

  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = [];
      }
      acc[doc.category].push(doc);
      return acc;
    }, {} as Record<string, DocumentItem[]>);
  }, [filteredDocuments]);

  const isLoading = isLoadingMatter || isLoadingClient || isLoadingDocuments;

  if (isLoading) {
    return (
      <AppLayout niche="migration">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!matter) {
    return (
      <AppLayout niche="migration">
        <div className="p-6 lg:p-8">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Application not found</h2>
            <p className="text-muted-foreground mb-4">The application you're looking for doesn't exist.</p>
            <Button variant="outline" onClick={() => navigate("/app/migration/visa-applications")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Applications
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }
  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/app/migration/visa-applications")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Button>

        {/* Matter Header */}
        <div className="card-gradient rounded-xl border border-border/50 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl gradient-bg flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{matter.matter_name}</h1>
                  <Badge variant={getStatusColor(matter.status)}>
                    {matter.status}
                  </Badge>
                </div>
                {matter.visa_subclass && (
                  <p className="text-primary font-medium mb-1">
                    Subclass {matter.visa_subclass} - {visaSubclasses.find(v => v.value === matter.visa_subclass)?.label.split('(')[0].trim()}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Created {formatDate(matter.created_at)}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsInviteOpen(true)}>
                <Mail className="w-4 h-4 mr-2" />
                Invite Client
              </Button>
              <Button variant="outline" onClick={handleEditMatter}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          {/* Client Info & Status */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors"
              onClick={() => client && navigate(`/app/migration/clients/${client.id}`)}
            >
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium hover:text-primary transition-colors">{client ? (client.last_name ? `${client.first_name} ${client.last_name}` : client.first_name) : "Unknown"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Drive Folder</p>
                {matter.folder_status === 'created' && matter.visa_application_folder_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a 
                          href={`https://drive.google.com/drive/folders/${matter.visa_application_folder_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 hover:underline transition-all group"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Open Folder
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Opens in Google Drive</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Badge 
                    variant={
                      matter.folder_status === 'creating' ? "default" : 
                      matter.folder_status === 'failed' ? "destructive" : "secondary"
                    }
                    className="gap-1"
                  >
                    {matter.folder_status === 'creating' && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {matter.folder_status === 'creating' ? "Creating" : 
                     matter.folder_status === 'failed' ? "Failed" : "Pending"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="font-medium">{completedCount}/{documents.length} completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Circle className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Required</p>
                <p className="font-medium">{requiredCompleted}/{requiredCount} complete</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="documents">Document Checklist</TabsTrigger>
            <TabsTrigger value="status">Status & Timeline</TabsTrigger>
            <TabsTrigger value="forms">Online Forms</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">

            {/* Review Status Summary */}
            {documents.some(d => d.filePath) && (
              <div className="card-gradient rounded-xl border border-border/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">Review Status</h3>
                    <span className="text-sm text-muted-foreground">
                      {completedCount} of {documents.length} collected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as "all" | ReviewStatus)}>
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Documents</SelectItem>
                        <SelectItem value="pending_client">Pending Client</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    {reviewFilter !== "all" && (
                      <Button variant="ghost" size="sm" onClick={() => setReviewFilter("all")} className="h-8 px-2">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => setReviewFilter(reviewFilter === "pending_client" ? "all" : "pending_client")}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                      reviewFilter === "pending_client" 
                        ? "bg-secondary ring-2 ring-primary" 
                        : "bg-secondary/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {documents.filter(d => d.filePath && d.reviewStatus === "pending_client").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Pending Client</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setReviewFilter(reviewFilter === "in_review" ? "all" : "in_review")}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                      reviewFilter === "in_review" 
                        ? "bg-blue-500/20 ring-2 ring-blue-500" 
                        : "bg-blue-500/10 hover:bg-blue-500/20"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {documents.filter(d => d.reviewStatus === "in_review").length}
                      </p>
                      <p className="text-xs text-muted-foreground">In Review</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setReviewFilter(reviewFilter === "approved" ? "all" : "approved")}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                      reviewFilter === "approved" 
                        ? "bg-green-500/20 ring-2 ring-green-500" 
                        : "bg-green-500/10 hover:bg-green-500/20"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {documents.filter(d => d.reviewStatus === "approved").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setReviewFilter(reviewFilter === "rejected" ? "all" : "rejected")}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                      reviewFilter === "rejected" 
                        ? "bg-destructive/20 ring-2 ring-destructive" 
                        : "bg-destructive/10 hover:bg-destructive/20"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">
                        {documents.filter(d => d.reviewStatus === "rejected").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                    </div>
                  </button>
                </div>
                {reviewFilter !== "all" && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Showing {filteredDocuments.length} of {documents.length} documents
                  </p>
                )}
              </div>
            )}

            {/* Document Categories */}
            {Object.entries(groupedDocuments).map(([category, docs]) => (
              <div key={category} className="card-gradient rounded-xl border border-border/50 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {category}
                  <Badge variant="outline" className="ml-2">
                    {docs.filter(d => d.completed).length}/{docs.length}
                  </Badge>
                </h3>
                <div className="space-y-3">
                  {docs.map((doc) => (
                    <motion.div
                      key={doc.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        doc.reviewStatus === "approved" 
                          ? "bg-green-500/5 border-green-500/20"
                          : doc.reviewStatus === "rejected"
                          ? "bg-destructive/5 border-destructive/20"
                          : doc.reviewStatus === "in_review"
                          ? "bg-blue-500/5 border-blue-500/20"
                          : doc.completed 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-secondary/50 border-border/50"
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={doc.completed}
                            onCheckedChange={() => handleToggleDocument(doc.id, doc.completed)}
                            disabled={toggleDocumentMutation.isPending}
                          />
                          <span className={doc.completed ? "line-through text-muted-foreground" : ""}>
                            {doc.name}
                          </span>
                          {/* Review Status Badge */}
                          {doc.filePath && doc.reviewStatus === "approved" && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                          {doc.filePath && doc.reviewStatus === "rejected" && (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="w-3 h-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                          {doc.filePath && doc.reviewStatus === "in_review" && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-500">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              In Review
                            </Badge>
                          )}
                        </div>
                        {/* Document Timeline */}
                        {(doc.uploadedAt || doc.reviewedAt) && (
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {doc.uploadedAt && (
                              <span className="flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                Uploaded {new Date(doc.uploadedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                {doc.uploadedByClientName && <span className="text-muted-foreground">by {doc.uploadedByClientName} (Client)</span>}
                                {!doc.uploadedByClientName && doc.uploadedByName && <span className="text-muted-foreground">by {doc.uploadedByName}</span>}
                              </span>
                            )}
                            {doc.reviewedAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Reviewed {new Date(doc.reviewedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                {doc.reviewedByName && <span className="text-muted-foreground">by {doc.reviewedByName}</span>}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {/* File actions */}
                          {doc.filePath ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => setPreviewDoc(doc)}
                                title="Preview & Review"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => handleDownloadFile(doc.filePath!, doc.name)}
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleFileRemove(doc.id, doc.filePath!)}
                                disabled={removeFileMutation.isPending}
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : null}
                          {doc.category === "Custom" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveDocument(doc.id)}
                              disabled={removeDocumentMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* File indicator with review comment */}
                      {doc.filePath && (
                        <div className="mt-2 ml-8 space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <File className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">
                              {doc.filePath.split('/').pop()}
                            </span>
                          </div>
                          {doc.reviewComment && (
                            <p className="text-sm text-muted-foreground italic pl-5">
                              "{doc.reviewComment}"
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add Custom Document */}
            <div className="card-gradient rounded-xl border border-border/50 p-6">
              <h3 className="font-semibold mb-4">Add Custom Document</h3>
              <div className="flex gap-3">
                <Input
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Document name..."
                  className="bg-secondary border-border"
                  onKeyDown={(e) => e.key === "Enter" && handleAddDocument()}
                />
                <Button 
                  variant="outline" 
                  onClick={handleAddDocument} 
                  disabled={!newDocName.trim() || addDocumentMutation.isPending}
                >
                  {addDocumentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            {/* Status Update */}
            <div className="card-gradient rounded-xl border border-border/50 p-6">
              <h3 className="font-semibold mb-4">Update Application Status</h3>
              <div className="flex flex-wrap gap-3">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={matter.status === option.value ? "default" : "outline"}
                    onClick={() => updateStatusMutation.mutate(option.value as "draft" | "active" | "done")}
                    disabled={updateStatusMutation.isPending}
                    className="gap-2"
                  >
                    {updateStatusMutation.isPending && updateStatusMutation.variables === option.value && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {option.label}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {statusOptions.find(o => o.value === matter.status)?.description}
              </p>
            </div>

            {/* Timeline Placeholder */}
            <div className="card-gradient rounded-xl border border-border/50 p-6">
              <h3 className="font-semibold mb-4">Application Timeline</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-3 h-3 rounded-full bg-primary mt-1.5" />
                  <div>
                    <p className="font-medium">Application Created</p>
                    <p className="text-sm text-muted-foreground">{formatDate(matter.created_at)}</p>
                  </div>
                </div>
                {matter.status !== "draft" && (
                  <div className="flex gap-4">
                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="font-medium">Status Changed to Active</p>
                      <p className="text-sm text-muted-foreground">Application in progress</p>
                    </div>
                  </div>
                )}
                {matter.status === "done" && (
                  <div className="flex gap-4">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="font-medium">Application Completed</p>
                      <p className="text-sm text-muted-foreground">All requirements fulfilled</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="forms" className="space-y-6">
            <div className="card-gradient rounded-xl border border-border/50 p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <Badge variant="secondary" className="mb-4">Coming Soon</Badge>
              <h3 className="font-semibold mb-2">Online Forms</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Send customizable forms to clients for document collection and information gathering. 
                Forms will be automatically linked to this application.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Application</DialogTitle>
              <DialogDescription>
                Update application details.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Application Name</Label>
                <Input
                  value={editForm.matterName}
                  onChange={(e) => setEditForm({...editForm, matterName: e.target.value})}
                  placeholder="e.g., Skilled Worker Application"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label>Visa Subclass</Label>
                <Select 
                  value={editForm.visaSubclass} 
                  onValueChange={(value) => setEditForm({...editForm, visaSubclass: value})}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select visa type" />
                  </SelectTrigger>
                  <SelectContent>
                    {visaSubclasses.map(visa => (
                      <SelectItem key={visa.value} value={visa.value}>
                        {visa.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="gradient" 
                className="flex-1" 
                onClick={handleUpdateMatter} 
                disabled={!editForm.matterName.trim() || updateMatterMutation.isPending}
              >
                {updateMatterMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Application</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{matter.matter_name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMatterMutation.mutate()}
                disabled={deleteMatterMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMatterMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invite Client Dialog */}
        <InviteClientDialog
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          matterId={matterId!}
          clientId={matter.client_id}
          clientEmail={client?.email || null}
          companyId={matter.company_id}
          matterName={matter.matter_name}
        />

        {/* Document Preview Dialog */}
        <DocumentPreviewDialog
          open={!!previewDoc}
          onOpenChange={(open) => !open && setPreviewDoc(null)}
          document={previewDoc}
          onReviewUpdate={handleReviewUpdate}
          onRequestNewDocument={handleRequestNewDocument}
        />
      </div>
    </AppLayout>
  );
};

export default MatterDetail;
