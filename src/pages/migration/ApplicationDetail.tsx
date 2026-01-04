import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { getFileTypeBadge } from "@/lib/fileUtils";
import { DocumentThumbnail } from "@/components/documents/DocumentThumbnail";
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
  
  Download,
  X,
  File,
  ExternalLink,
  Mail,
  Eye,
  AlertCircle,
  XCircle,
  Filter,
  Merge,
  Clock,
  Calendar,
  Languages,
  Link2,
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
import { InviteClientDialog } from "@/components/visa-application/InviteClientDialog";
import { DocumentPreviewDialog, ReviewStatus } from "@/components/visa-application/DocumentPreviewDialog";
import { useAuth } from "@/hooks/useAuth";
import { getCountryFlag } from "@/lib/countryFlags";

interface VisaApplication {
  id: string;
  client_id: string;
  application_name: string;
  visa_subclass: string | null;
  country_id: string | null;
  status: "draft" | "active" | "done";
  visa_application_folder_id: string | null;
  folder_status: "pending" | "creating" | "created" | "failed";
  folder_status_updated_at: string | null;
  created_at: string;
  company_id: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  client_type: "personal" | "corporate";
}

interface DocumentAttachment {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploaded_by_client: string | null;
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
  isStandardForClient: boolean;
  applicantType: string | null;
  ageCondition: string | null;
  minFiles: number;
  maxFiles: number | null;
  attachmentCount: number;
  attachments: DocumentAttachment[];
  translationOfId: string | null;
  requiresTranslation: boolean;
  translationTargetLanguage: string | null;
  translationCertificationTypeId: string | null;
  translationCertificationTypeName: string | null;
  translationNotes: string | null;
  requirementType: 'required' | 'conditional' | 'optional';
  applicabilityCondition: string | null;
  isApplicable: boolean;
}

interface DbDocumentItem {
  id: string;
  visa_application_id: string;
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
  is_standard_for_client: boolean | null;
  applicant_type: string | null;
  age_condition: string | null;
  min_files: number | null;
  max_files: number | null;
  uploader_profile?: { display_name: string | null; email: string | null } | null;
  uploader_client?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  reviewer_profile?: { display_name: string | null; email: string | null } | null;
  created_at: string;
  updated_at: string;
  attachment_count?: number;
  attachments?: DocumentAttachment[];
  translation_of_id?: string | null;
  requires_translation?: boolean;
  translation_target_language?: string | null;
  translation_certification_type_id?: string | null;
  translation_notes?: string | null;
  requirement_type?: string | null;
  applicability_condition?: string | null;
  is_applicable?: boolean;
}

interface TranslationCertificationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface VisaType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  country_id: string | null;
}

interface Country {
  id: string;
  name: string;
  code: string;
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
type DefaultDocFields = Pick<DocumentItem, "name" | "category" | "required" | "completed">;

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

const VisaApplicationDetail = () => {
  const { visaApplicationId } = useParams<{ visaApplicationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [documentsInitialized, setDocumentsInitialized] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>("all");
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  
  const [editForm, setEditForm] = useState({
    countryId: "",
    applicationName: "",
    visaSubclass: "",
  });

  // Fetch visa application details
  const { data: visaApplication, isLoading: isLoadingApplication } = useQuery({
    queryKey: ["visa-application", visaApplicationId],
    queryFn: async () => {
      if (!visaApplicationId) return null;
      
      const { data, error } = await supabase
        .from("visa_applications")
        .select("*")
        .eq("id", visaApplicationId)
        .maybeSingle();
      
      if (error) throw error;
      return data as VisaApplication | null;
    },
    enabled: !!visaApplicationId,
  });

  // Fetch countries for the dropdown
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as Country[];
    },
  });

  // Fetch visa types for the dropdown
  const { data: visaTypes = [] } = useQuery({
    queryKey: ["visa-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visa_types")
        .select("id, name, code, description, country_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as VisaType[];
    },
  });

  // Fetch translation certification types
  const { data: certificationTypes = [] } = useQuery({
    queryKey: ["translation-certification-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("translation_certification_types")
        .select("id, code, name, description")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as TranslationCertificationType[];
    },
  });

  // Filter visa types by selected country in edit form
  const editFilteredVisaTypes = editForm.countryId
    ? visaTypes.filter(type => type.country_id === editForm.countryId)
    : visaTypes;

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["application-client", visaApplication?.client_id],
    queryFn: async () => {
      if (!visaApplication?.client_id) return null;
      
      // Use secure RPC function that masks PII for non-admins
      const { data, error } = await supabase
        .rpc("get_client_by_id", { p_client_id: visaApplication.client_id });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] as Client : null;
    },
    enabled: !!visaApplication?.client_id,
  });

  // Fetch document checklist from database with attachments
  const { data: dbDocumentsRaw, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["document-checklist", visaApplicationId],
    queryFn: async () => {
      if (!visaApplicationId) return [];
      
      // Fetch documents with translation fields
      const { data: docs, error } = await supabase
        .from("document_checklist")
        .select("*, min_files, max_files, translation_of_id, requires_translation, translation_target_language, translation_certification_type_id, translation_notes, requirement_type, applicability_condition, is_applicable")
        .eq("visa_application_id", visaApplicationId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      // Fetch attachments for all documents
      const docIds = (docs || []).map(d => d.id);
      const { data: attachments } = await supabase
        .from("document_attachments")
        .select("id, document_checklist_id, file_path, file_name, file_type, file_size, uploaded_at, uploaded_by, uploaded_by_client")
        .in("document_checklist_id", docIds)
        .order("uploaded_at", { ascending: true });
      
      // Group attachments by document
      const attachmentsByDoc: Record<string, DocumentAttachment[]> = {};
      (attachments || []).forEach(a => {
        if (!attachmentsByDoc[a.document_checklist_id]) {
          attachmentsByDoc[a.document_checklist_id] = [];
        }
        attachmentsByDoc[a.document_checklist_id].push({
          id: a.id,
          file_path: a.file_path,
          file_name: a.file_name,
          file_type: a.file_type,
          file_size: a.file_size,
          uploaded_at: a.uploaded_at,
          uploaded_by: a.uploaded_by,
          uploaded_by_client: a.uploaded_by_client,
        });
      });
      
      // Merge documents with attachments
      return (docs || []).map(doc => ({
        ...doc,
        attachment_count: attachmentsByDoc[doc.id]?.length || 0,
        attachments: attachmentsByDoc[doc.id] || [],
      }));
    },
    enabled: !!visaApplicationId,
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
    mutationFn: async () => {
      if (!visaApplicationId || !visaApplication?.company_id) throw new Error("Missing IDs");

      // 1) Try to initialize from configured templates (preferred)
      const visaTypeQuery = supabase
        .from("visa_types")
        .select("id")
        .eq("is_active", true)
        .eq("name", visaApplication.application_name)
        .limit(1);

      const { data: matchingVisaType, error: visaTypeError } = await (visaApplication.visa_subclass
        ? visaTypeQuery.eq("code", visaApplication.visa_subclass).maybeSingle()
        : visaTypeQuery.maybeSingle());

      if (visaTypeError) throw visaTypeError;

      const visaTypeId = matchingVisaType?.id;

      if (visaTypeId) {
        const { data: linkedTemplates, error: linkedError } = await supabase
          .from("document_template_applications")
          .select("document_template_id")
          .eq("visa_type_id", visaTypeId);

        if (linkedError) throw linkedError;

        const templateIds = (linkedTemplates || [])
          .map((t) => t.document_template_id)
          .filter(Boolean);

        if (templateIds.length > 0) {
          const { data: templates, error: templatesError } = await supabase
            .from("document_checklist_templates")
            .select(
              `
                document_name, 
                category, 
                description,
                age_condition,
                is_required, 
                sort_order,
                requires_translation,
                translation_target_language,
                translation_certification_type_id,
                translation_notes,
                requirement_type,
                applicability_condition,
                applicant_type:applicant_types(name)
              `
            )
            .in("id", templateIds)
            .order("sort_order");

          if (templatesError) throw templatesError;

          if (templates && templates.length > 0) {
            // First pass: create all original documents
            const documentsToInsert = templates.map((template: any) => {
              const category = template.category || "General";
              const required = !!template.is_required;
              const rawName = String(template.document_name || "").trim();
              const formattedName = rawName.startsWith("[")
                ? rawName
                : `[${category}:${required ? "required" : "optional"}] ${rawName}`;

              return {
                visa_application_id: visaApplicationId,
                company_id: visaApplication.company_id,
                document_name: formattedName,
                category: template.category,
                description: template.description,
                applicant_type: template.applicant_type?.name || null,
                age_condition: template.age_condition,
                is_completed: false,
                is_standard_for_client: true,
                review_status: "pending_client",
                requires_translation: template.requires_translation ?? false,
                translation_target_language: template.translation_target_language,
                translation_certification_type_id: template.translation_certification_type_id,
                translation_notes: template.translation_notes,
                requirement_type: template.requirement_type ?? "required",
                applicability_condition: template.applicability_condition ?? null,
                is_applicable: true, // Default to applicable, staff can toggle off
              };
            });

            const { data: insertedDocs, error: insertError } = await supabase
              .from("document_checklist")
              .insert(documentsToInsert)
              .select("id, document_name, category, description, applicant_type, age_condition, requires_translation, translation_target_language, translation_certification_type_id, translation_notes");

            if (insertError) throw insertError;

            // Second pass: create translation documents for those that require it
            const translationDocs = (insertedDocs || [])
              .filter((doc: any) => doc.requires_translation)
              .map((originalDoc: any) => {
                const translationName = `[${originalDoc.category || "General"}:required] ${originalDoc.document_name.replace(/^\[[^\]]+\]\s*/, "")} (Translation)`;
                return {
                  visa_application_id: visaApplicationId,
                  company_id: visaApplication.company_id,
                  document_name: translationName,
                  category: originalDoc.category,
                  description: `Certified translation of: ${originalDoc.document_name.replace(/^\[[^\]]+\]\s*/, "")}`,
                  applicant_type: originalDoc.applicant_type,
                  age_condition: originalDoc.age_condition,
                  is_completed: false,
                  is_standard_for_client: true,
                  review_status: "pending_client",
                  requires_translation: false,
                  translation_of_id: originalDoc.id,
                  translation_target_language: originalDoc.translation_target_language,
                  translation_certification_type_id: originalDoc.translation_certification_type_id,
                  translation_notes: originalDoc.translation_notes,
                };
              });

            if (translationDocs.length > 0) {
              const { error: translationInsertError } = await supabase
                .from("document_checklist")
                .insert(translationDocs);

              if (translationInsertError) throw translationInsertError;
            }

            return;
          }
        }
      }

      // 2) Fallback: initialize with generic default docs
      const defaultDocs = getDefaultDocuments(visaApplication.visa_subclass);
      const documentsToInsert = defaultDocs.map((doc) => ({
        visa_application_id: visaApplicationId,
        company_id: visaApplication.company_id,
        document_name: formatDocumentForStorage(doc),
        is_completed: false,
        review_status: "pending_client",
      }));

      const { error: fallbackError } = await supabase
        .from("document_checklist")
        .insert(documentsToInsert);

      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
      setDocumentsInitialized(true);
    },
    onError: (error) => {
      // Prevent infinite retries, and surface the problem
      setDocumentsInitialized(true);
      console.error("Failed to initialize documents:", error);
      toast.error("Couldn't generate document checklist", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  // Initialize documents when visa application loads and no documents exist
  useEffect(() => {
    if (
      visaApplication &&
      dbDocuments !== undefined &&
      dbDocuments.length === 0 &&
      !documentsInitialized &&
      !initializeDocumentsMutation.isPending
    ) {
      initializeDocumentsMutation.mutate();
    }
  }, [visaApplication, dbDocuments, documentsInitialized]);

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
    
    // Lookup certification type name
    const certType = doc.translation_certification_type_id 
      ? certificationTypes.find(ct => ct.id === doc.translation_certification_type_id)
      : null;
    
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
      isStandardForClient: doc.is_standard_for_client ?? false,
      applicantType: doc.applicant_type,
      ageCondition: doc.age_condition,
      minFiles: doc.min_files ?? 1,
      maxFiles: doc.max_files ?? 1,
      attachmentCount: doc.attachment_count ?? 0,
      attachments: doc.attachments ?? [],
      translationOfId: doc.translation_of_id ?? null,
      requiresTranslation: doc.requires_translation ?? false,
      translationTargetLanguage: doc.translation_target_language ?? null,
      translationCertificationTypeId: doc.translation_certification_type_id ?? null,
      translationCertificationTypeName: certType?.name ?? null,
      translationNotes: doc.translation_notes ?? null,
      requirementType: (doc.requirement_type as 'required' | 'conditional' | 'optional') ?? 'required',
      applicabilityCondition: doc.applicability_condition ?? null,
      isApplicable: doc.is_applicable ?? true,
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
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
    },
    onError: (error) => {
      toast.error("Failed to update document", { description: error.message });
    },
  });

  // Toggle document applicability (for conditional documents)
  const toggleApplicabilityMutation = useMutation({
    mutationFn: async ({ docId, isApplicable }: { docId: string; isApplicable: boolean }) => {
      const { error } = await supabase
        .from("document_checklist")
        .update({ is_applicable: isApplicable })
        .eq("id", docId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
      toast.success("Document applicability updated");
    },
    onError: (error) => {
      toast.error("Failed to update document", { description: error.message });
    },
  });


  const addDocumentMutation = useMutation({
    mutationFn: async (docName: string) => {
      if (!visaApplicationId || !visaApplication?.company_id) throw new Error("Missing IDs");
      
        const { data, error } = await supabase
          .from("document_checklist")
          .insert({
            visa_application_id: visaApplicationId,
            company_id: visaApplication.company_id,
            document_name: `[Custom] ${docName}`,
            is_completed: false,
            review_status: "pending_client",
          })
          .select()
          .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
      setNewDocName("");
      toast.success("Document added to checklist");
    },
    onError: (error) => {
      toast.error("Failed to add document", { description: error.message });
    },
  });

  // Merge templates into existing checklist (only adds missing documents)
  const mergeTemplatesMutation = useMutation({
    mutationFn: async () => {
      if (!visaApplicationId || !visaApplication?.company_id) throw new Error("Missing IDs");

      // Get existing document names for comparison
      const existingDocNames = new Set(
        (dbDocuments || []).map(d => {
          const parsed = parseDocumentName(d.document_name);
          return parsed.displayName.toLowerCase().trim();
        })
      );

      // Fetch templates
      const visaTypeQuery = supabase
        .from("visa_types")
        .select("id")
        .eq("is_active", true)
        .eq("name", visaApplication.application_name)
        .limit(1);

      const { data: matchingVisaType, error: visaTypeError } = await (visaApplication.visa_subclass
        ? visaTypeQuery.eq("code", visaApplication.visa_subclass).maybeSingle()
        : visaTypeQuery.maybeSingle());

      if (visaTypeError) throw visaTypeError;

      const visaTypeId = matchingVisaType?.id;
      let newDocs: any[] = [];

      if (visaTypeId) {
        const { data: linkedTemplates, error: linkedError } = await supabase
          .from("document_template_applications")
          .select("document_template_id")
          .eq("visa_type_id", visaTypeId);

        if (linkedError) throw linkedError;

        const templateIds = (linkedTemplates || [])
          .map((t) => t.document_template_id)
          .filter(Boolean);

        if (templateIds.length > 0) {
          const { data: templates, error: templatesError } = await supabase
            .from("document_checklist_templates")
            .select(`
              document_name, 
              category, 
              description,
              age_condition,
              is_required, 
              sort_order,
              applicant_type:applicant_types(name)
            `)
            .in("id", templateIds)
            .order("sort_order");

          if (templatesError) throw templatesError;

          if (templates && templates.length > 0) {
            // Filter to only templates that don't already exist
            newDocs = templates
              .filter((template: any) => {
                const templateName = String(template.document_name || "").trim().toLowerCase();
                return !existingDocNames.has(templateName);
              })
              .map((template: any) => {
                const category = template.category || "General";
                const required = !!template.is_required;
                const rawName = String(template.document_name || "").trim();
                const formattedName = rawName.startsWith("[")
                  ? rawName
                  : `[${category}:${required ? "required" : "optional"}] ${rawName}`;

                return {
                  visa_application_id: visaApplicationId,
                  company_id: visaApplication.company_id,
                  document_name: formattedName,
                  category: template.category,
                  description: template.description,
                  applicant_type: template.applicant_type?.name || null,
                  age_condition: template.age_condition,
                  is_completed: false,
                  is_standard_for_client: true,
                  review_status: "pending_client",
                };
              });
          }
        }
      }

      // Fallback to default docs if no templates found
      if (newDocs.length === 0 && !visaTypeId) {
        const defaultDocs = getDefaultDocuments(visaApplication.visa_subclass);
        newDocs = defaultDocs
          .filter(doc => !existingDocNames.has(doc.name.toLowerCase().trim()))
          .map((doc) => ({
            visa_application_id: visaApplicationId,
            company_id: visaApplication.company_id,
            document_name: formatDocumentForStorage(doc),
            is_completed: false,
            review_status: "pending_client",
          }));
      }

      if (newDocs.length === 0) {
        return { added: 0, skipped: existingDocNames.size };
      }

      const { error: insertError } = await supabase
        .from("document_checklist")
        .insert(newDocs);

      if (insertError) throw insertError;
      return { added: newDocs.length, skipped: existingDocNames.size };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
      setIsMergeOpen(false);
      if (result.added > 0) {
        toast.success(`Added ${result.added} new document${result.added > 1 ? "s" : ""}`, {
          description: `${result.skipped} existing documents preserved`,
        });
      } else {
        toast.info("No new documents to add", {
          description: "All template documents already exist in the checklist",
        });
      }
    },
    onError: (error) => {
      toast.error("Failed to merge templates", { description: error instanceof Error ? error.message : "Please try again" });
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
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
      toast.success("Document removed");
    },
    onError: (error) => {
      toast.error("Failed to remove document", { description: error.message });
    },
  });



  // Remove file from a document (legacy - removes all)
  const removeFileMutation = useMutation({
    mutationFn: async ({ docId, filePath }: { docId: string; filePath: string }) => {
      // First delete from attachments table
      const { error: attachmentError } = await supabase
        .from("document_attachments")
        .delete()
        .eq("document_checklist_id", docId);
      
      if (attachmentError) console.warn("Error deleting attachments:", attachmentError);
      
      // Then remove from storage if not a Drive file
      if (!filePath.startsWith("drive://")) {
        const { error: removeError } = await supabase.storage
          .from("document-attachments")
          .remove([filePath]);
        
        if (removeError) console.warn("Error removing from storage:", removeError);
      }
      
      const { error: updateError } = await supabase
        .from("document_checklist")
        .update({ file_path: null, is_completed: false })
        .eq("id", docId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
      toast.success("File removed");
    },
    onError: (error) => {
      toast.error("Failed to remove file", { description: error.message });
    },
  });

  // Remove individual attachment
  const removeAttachmentMutation = useMutation({
    mutationFn: async ({ attachmentId, docId, filePath }: { attachmentId: string; docId: string; filePath: string }) => {
      // Delete the attachment record
      const { error: deleteError } = await supabase
        .from("document_attachments")
        .delete()
        .eq("id", attachmentId);
      
      if (deleteError) throw deleteError;
      
      // Remove from storage if not a Drive file
      if (!filePath.startsWith("drive://")) {
        await supabase.storage
          .from("document-attachments")
          .remove([filePath]);
      }
      
      // Count remaining attachments
      const { count } = await supabase
        .from("document_attachments")
        .select("id", { count: "exact", head: true })
        .eq("document_checklist_id", docId);
      
      // Get document's min_files
      const { data: docData } = await supabase
        .from("document_checklist")
        .select("min_files")
        .eq("id", docId)
        .single();
      
      const minFiles = docData?.min_files ?? 1;
      const isCompleted = (count || 0) >= minFiles;
      
      // Update the first remaining file as file_path for backward compatibility
      let newFilePath: string | null = null;
      if (count && count > 0) {
        const { data: firstAttachment } = await supabase
          .from("document_attachments")
          .select("file_path")
          .eq("document_checklist_id", docId)
          .order("uploaded_at", { ascending: true })
          .limit(1)
          .single();
        
        newFilePath = firstAttachment?.file_path || null;
      }
      
      // Update document checklist
      await supabase
        .from("document_checklist")
        .update({ 
          file_path: newFilePath, 
          is_completed: isCompleted,
        })
        .eq("id", docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
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
      queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
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

  // Update visa application mutation
  const updateApplicationMutation = useMutation({
    mutationFn: async (applicationData: {
      application_name: string;
      visa_subclass: string | null;
      country_id: string | null;
    }) => {
      if (!visaApplicationId) throw new Error("No application ID");
      
      const { data, error } = await supabase
        .from("visa_applications")
        .update({
          application_name: applicationData.application_name,
          visa_subclass: applicationData.visa_subclass,
          country_id: applicationData.country_id,
        })
        .eq("id", visaApplicationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Dispatch webhook for application.updated event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "application.updated",
            data: {
              application_id: data.id,
              company_id: data.company_id,
              client_id: data.client_id,
              application_name: data.application_name,
              visa_subclass: data.visa_subclass,
              status: data.status,
              application_folder_id: data.visa_application_folder_id,
            },
          },
        });

        if (invokeError) throw invokeError;
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }
      
      queryClient.invalidateQueries({ queryKey: ["visa-application", visaApplicationId] });
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
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
      if (!visaApplicationId) throw new Error("No application ID");
      
      const { data, error } = await supabase
        .from("visa_applications")
        .update({ status })
        .eq("id", visaApplicationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Dispatch webhook for application.updated event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "application.updated",
            data: {
              visa_application_id: data.id,
              company_id: data.company_id,
              client_id: data.client_id,
              application_name: data.application_name,
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
      
      queryClient.invalidateQueries({ queryKey: ["visa-application", visaApplicationId] });
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      toast.success("Status updated!");
    },
    onError: (error) => {
      toast.error("Failed to update status", {
        description: error.message,
      });
    },
  });

  // Delete visa application mutation
  const deleteApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!visaApplicationId || !visaApplication) throw new Error("No application ID");
      
      // Store application data before deletion for webhook
      const applicationData = {
        visa_application_id: visaApplication.id,
        company_id: visaApplication.company_id,
        client_id: visaApplication.client_id,
        application_name: visaApplication.application_name,
        visa_subclass: visaApplication.visa_subclass,
        status: visaApplication.status,
        visa_application_folder_id: visaApplication.visa_application_folder_id,
        folder_status: visaApplication.folder_status,
        folder_status_updated_at: visaApplication.folder_status_updated_at,
        created_at: visaApplication.created_at,
      };
      
      const { error } = await supabase
        .from("visa_applications")
        .delete()
        .eq("id", visaApplicationId);
      
      if (error) throw error;
      return applicationData;
    },
    onSuccess: async (applicationData) => {
      // Dispatch webhook for application.deleted event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "application.deleted",
            data: applicationData,
          },
        });

        if (invokeError) throw invokeError;
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }
      
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      toast.success("Application deleted");
      navigate("/app/migration/applications");
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      });
    },
  });

  const handleEditApplication = () => {
    if (!visaApplication) return;
    setEditForm({
      countryId: visaApplication.country_id || "",
      applicationName: visaApplication.application_name,
      visaSubclass: visaApplication.visa_subclass || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdateApplication = () => {
    if (!editForm.applicationName.trim()) return;
    
    updateApplicationMutation.mutate({
      application_name: editForm.applicationName.trim(),
      visa_subclass: editForm.visaSubclass || null,
      country_id: editForm.countryId || null,
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


  const handleFileRemove = (docId: string, filePath: string) => {
    removeFileMutation.mutate({ docId, filePath });
  };

  const isDriveFile = (filePath: string) => filePath.startsWith("drive://");
  const getDriveFileId = (filePath: string) => filePath.replace("drive://", "");
  
  const isPreviewableFile = (filePath: string | null): boolean => {
    if (!filePath) return false;
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext || '');
  };

  const getFileDownloadUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("document-attachments")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Fetch thumbnail URL for a document
  const fetchThumbnailUrl = async (filePath: string): Promise<string | null> => {
    if (thumbnailUrls[filePath]) return thumbnailUrls[filePath];
    
    try {
      if (isDriveFile(filePath)) {
        if (!currentCompany?.id) return null;
        const fileId = getDriveFileId(filePath);
        const { data, error } = await supabase.functions.invoke("get-drive-file-url", {
          body: { file_id: fileId, company_id: currentCompany.id },
        });
        if (error || !data?.success) return null;
        const url = data.file.previewUrl || data.file.thumbnailLink;
        if (url) {
          setThumbnailUrls(prev => ({ ...prev, [filePath]: url }));
          return url;
        }
      } else {
        const { data, error } = await supabase.storage
          .from("document-attachments")
          .createSignedUrl(filePath, 3600);
        if (error) return null;
        setThumbnailUrls(prev => ({ ...prev, [filePath]: data.signedUrl }));
        return data.signedUrl;
      }
    } catch (err) {
      console.error("Failed to fetch thumbnail:", err);
    }
    return null;
  };

  // Load thumbnails for documents with files
  // Load thumbnail URLs for documents and their attachments
  useEffect(() => {
    if (!documents.length) return;
    
    const loadThumbnails = async () => {
      for (const doc of documents) {
        // Load thumbnail for legacy filePath
        if (doc.filePath && isPreviewableFile(doc.filePath) && !thumbnailUrls[doc.filePath]) {
          await fetchThumbnailUrl(doc.filePath);
        }
        // Load thumbnails for all attachments
        if (doc.attachments) {
          for (const attachment of doc.attachments) {
            if (isPreviewableFile(attachment.file_path) && !thumbnailUrls[attachment.file_path]) {
              await fetchThumbnailUrl(attachment.file_path);
            }
          }
        }
      }
    };
    
    loadThumbnails();
  }, [documents, currentCompany?.id]);

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

  const getStatusColor = (status: VisaApplication["status"]) => {
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

  // Only count applicable documents for progress
  const applicableDocuments = documents.filter(d => d.isApplicable);
  const completedCount = applicableDocuments.filter(d => d.completed).length;
  const requiredCount = applicableDocuments.filter(d => d.required || d.requirementType === 'required').length;
  const requiredCompleted = applicableDocuments.filter(d => (d.required || d.requirementType === 'required') && d.completed).length;
  const progress = applicableDocuments.length > 0 ? Math.round((completedCount / applicableDocuments.length) * 100) : 0;

  // Apply review status filter - MUST be before any conditional returns (hooks rule)
  const filteredDocuments = useMemo(() => {
    if (reviewFilter === "all") return documents;
    // "pending_client" means documents awaiting client upload (no file yet)
    if (reviewFilter === "pending_client") return documents.filter(d => !d.filePath);
    // Other filters apply to documents with files
    return documents.filter(d => d.filePath && d.reviewStatus === reviewFilter);
  }, [documents, reviewFilter]);

  // Group documents by applicant type, then by category
  const groupedByApplicantType = useMemo(() => {
    const grouped: Record<string, Record<string, DocumentItem[]>> = {};
    
    filteredDocuments.forEach(doc => {
      const applicantType = doc.applicantType || "General";
      const category = doc.category;
      
      if (!grouped[applicantType]) {
        grouped[applicantType] = {};
      }
      if (!grouped[applicantType][category]) {
        grouped[applicantType][category] = [];
      }
      grouped[applicantType][category].push(doc);
    });
    
    return grouped;
  }, [filteredDocuments]);

  // Get ordered applicant types (General last if present)
  const orderedApplicantTypes = useMemo(() => {
    const types = Object.keys(groupedByApplicantType);
    // Define preferred order
    const preferredOrder = ["Primary Applicant", "Partner", "Dependant", "Sponsor"];
    
    return types.sort((a, b) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [groupedByApplicantType]);

  const isLoading = isLoadingApplication || isLoadingClient || isLoadingDocuments;

  if (isLoading) {
    return (
      <AppLayout niche="migration">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!visaApplication) {
    return (
      <AppLayout niche="migration">
        <div className="p-6 lg:p-8">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Application not found</h2>
            <p className="text-muted-foreground mb-4">The application you're looking for doesn't exist.</p>
            <Button variant="outline" onClick={() => navigate("/app/migration/applications")}>
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
        <Button variant="ghost" onClick={() => navigate("/app/migration/applications")} className="gap-2">
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
                  {visaApplication.country_id && countries.find(c => c.id === visaApplication.country_id) && (
                    <span className="text-2xl" title={countries.find(c => c.id === visaApplication.country_id)?.name}>
                      {getCountryFlag(countries.find(c => c.id === visaApplication.country_id)?.code || '')}
                    </span>
                  )}
                  <h1 className="text-2xl font-bold">{visaApplication.application_name}</h1>
                  <Badge variant={getStatusColor(visaApplication.status)}>
                    {visaApplication.status}
                  </Badge>
                </div>
                {visaApplication.visa_subclass && (
                  <p className="text-primary font-medium mb-1">
                    Subclass {visaApplication.visa_subclass} - {visaSubclasses.find(v => v.value === visaApplication.visa_subclass)?.label.split('(')[0].trim()}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Created {formatDate(visaApplication.created_at)}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsInviteOpen(true)}>
                <Mail className="w-4 h-4 mr-2" />
                Invite Client
              </Button>
              <Button variant="outline" onClick={handleEditApplication}>
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
                <p className="font-medium hover:text-primary transition-colors">
                  {client ? (
                    client.client_type === "corporate"
                      ? client.company_name || "Unnamed Company"
                      : client.first_name || client.last_name 
                        ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                        : client.email || "Unknown"
                  ) : "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Drive Folder</p>
                {visaApplication.folder_status === 'created' && visaApplication.visa_application_folder_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a 
                          href={`https://drive.google.com/drive/folders/${visaApplication.visa_application_folder_id}`}
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
                      visaApplication.folder_status === 'creating' ? "default" : 
                      visaApplication.folder_status === 'failed' ? "destructive" : "secondary"
                    }
                    className="gap-1"
                  >
                    {visaApplication.folder_status === 'creating' && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {visaApplication.folder_status === 'creating' ? "Creating" : 
                     visaApplication.folder_status === 'failed' ? "Failed" : "Pending"}
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
            {/* Checklist Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMergeOpen(true)}
                disabled={mergeTemplatesMutation.isPending}
              >
                {mergeTemplatesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Merge className="w-4 h-4 mr-2" />
                )}
                Merge Templates
              </Button>
            </div>

            {/* Review Status Summary */}
            {documents.some(d => d.filePath) && (
              <div className="card-gradient rounded-xl border border-border/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          className="text-secondary"
                          strokeWidth="3"
                          stroke="currentColor"
                          fill="transparent"
                          r="16"
                          cx="18"
                          cy="18"
                        />
                        <circle
                          className="text-primary transition-all duration-500"
                          strokeWidth="3"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="16"
                          cx="18"
                          cy="18"
                          strokeDasharray={`${progress} 100`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                        {progress}%
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">Review Status</h3>
                      <span className="text-sm text-muted-foreground">
                        {completedCount} of {documents.length} collected
                      </span>
                    </div>
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
                        <SelectItem value="in_review">Ready to Review</SelectItem>
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
                        {documents.filter(d => !d.filePath).length}
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
                      <p className="text-xs text-muted-foreground">Ready to Review</p>
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
                
                {/* Total count verification */}
                {(() => {
                  const pendingCount = documents.filter(d => !d.filePath).length;
                  const inReviewCount = documents.filter(d => d.filePath && d.reviewStatus === "in_review").length;
                  const approvedCount = documents.filter(d => d.filePath && d.reviewStatus === "approved").length;
                  const rejectedCount = documents.filter(d => d.filePath && d.reviewStatus === "rejected").length;
                  const sum = pendingCount + inReviewCount + approvedCount + rejectedCount;
                  const isMatch = sum === documents.length;
                  
                  return (
                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">Total Documents:</span>
                        <span className="font-bold text-foreground">{documents.length}</span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md cursor-help ${
                              isMatch 
                                ? "bg-green-500/10 text-green-600" 
                                : "bg-destructive/10 text-destructive"
                            }`}>
                              {isMatch ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5" />
                              )}
                              <span className="font-medium">
                                {isMatch ? "Counts verified" : "Count mismatch"}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="font-medium mb-1">Status Breakdown:</p>
                            <p className="text-xs">
                              {pendingCount} Pending + {inReviewCount} Ready to Review + {approvedCount} Approved + {rejectedCount} Rejected = {sum}
                            </p>
                            {!isMatch && (
                              <p className="text-xs text-destructive mt-1">
                                Expected: {documents.length}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  );
                })()}
                
                {reviewFilter !== "all" && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Showing {filteredDocuments.length} of {documents.length} documents
                  </p>
                )}
              </div>
            )}

            {/* Documents grouped by Applicant Type, then by Category */}
            {orderedApplicantTypes.map((applicantType) => (
              <div key={applicantType} className="space-y-4">
                {/* Applicant Type Header */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">{applicantType}</h2>
                  <Badge variant="outline">
                    {Object.values(groupedByApplicantType[applicantType]).flat().filter(d => d.completed).length}/
                    {Object.values(groupedByApplicantType[applicantType]).flat().length}
                  </Badge>
                </div>
                
                {/* Categories within this Applicant Type */}
                {Object.entries(groupedByApplicantType[applicantType]).map(([category, docs]) => (
                  <div key={`${applicantType}-${category}`} className="card-gradient rounded-xl border border-border/50 p-6 ml-4">
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
                            <div className="flex items-center gap-3 flex-wrap">
                              <Checkbox
                                checked={doc.completed}
                                onCheckedChange={() => handleToggleDocument(doc.id, doc.completed)}
                                disabled={toggleDocumentMutation.isPending}
                              />
                              <span className={doc.completed ? "line-through text-muted-foreground" : ""}>
                                {doc.name}
                              </span>
                              {/* Requirement Type Badge */}
                              {doc.requirementType === "conditional" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className={`text-xs border-amber-500 text-amber-600 dark:text-amber-400 ${!doc.isApplicable ? 'opacity-50' : ''}`}>
                                        If Applicable
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="text-xs">{doc.applicabilityCondition || "Submit this document if it applies to this case"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {doc.requirementType === "optional" && (
                                <Badge variant="secondary" className="text-xs">
                                  Optional
                                </Badge>
                              )}
                              {/* Not Applicable indicator for conditional documents */}
                              {doc.requirementType === "conditional" && !doc.isApplicable && (
                                <Badge variant="outline" className="text-xs text-muted-foreground bg-muted/50">
                                  Not Applicable
                                </Badge>
                              )}
                              {/* Multi-file indicator */}
                              {(doc.maxFiles === null || doc.maxFiles > 1) && (
                                <Badge variant="outline" className="text-xs">
                                  {doc.attachmentCount}/{doc.maxFiles ?? "∞"} files
                                </Badge>
                              )}
                              {doc.ageCondition && (
                                <Badge variant="secondary" className="text-xs">
                                  {doc.ageCondition}
                                </Badge>
                              )}
                              {/* Translation indicator with certification requirements */}
                              {doc.translationOfId && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-400 bg-purple-50 dark:bg-purple-950/30">
                                        <Languages className="w-3 h-3 mr-1" />
                                        Translation
                                        {doc.translationCertificationTypeName && (
                                          <span className="ml-1 font-semibold">• {doc.translationCertificationTypeName}</span>
                                        )}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="space-y-1">
                                        <p className="font-medium">Translation Requirements</p>
                                        {doc.translationTargetLanguage && (
                                          <p className="text-xs">Target: {doc.translationTargetLanguage}</p>
                                        )}
                                        {doc.translationCertificationTypeName && (
                                          <p className="text-xs">Certification: {doc.translationCertificationTypeName}</p>
                                        )}
                                        {doc.translationNotes && (
                                          <p className="text-xs text-muted-foreground">{doc.translationNotes}</p>
                                        )}
                                        {!doc.translationCertificationTypeName && !doc.translationNotes && (
                                          <p className="text-xs text-muted-foreground">Any certified translator</p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {doc.requiresTranslation && !doc.translationOfId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-400 bg-purple-50 dark:bg-purple-950/30">
                                      <Link2 className="w-3 h-3 mr-1" />
                                      Has Translation
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>A translation document was auto-created for this original</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {/* Review Status Badge */}
                              {doc.attachmentCount === 0 && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending Client
                                </Badge>
                              )}
                              {doc.attachmentCount > 0 && doc.reviewStatus === "approved" && (
                                <Badge variant="default" className="text-xs bg-green-600">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Approved
                                </Badge>
                              )}
                              {doc.attachmentCount > 0 && doc.reviewStatus === "rejected" && (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Rejected
                                </Badge>
                              )}
                              {doc.attachmentCount > 0 && doc.reviewStatus !== "approved" && doc.reviewStatus !== "rejected" && (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950/30">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Ready to Review
                                </Badge>
                              )}
                            </div>
                            {/* Document Timeline */}
                            {(doc.uploadedAt || doc.reviewedAt) && (
                              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {doc.uploadedAt && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
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
                              {doc.attachmentCount > 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary"
                                  onClick={() => setPreviewDoc(doc)}
                                  title="Preview & Review"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Toggle applicability for conditional documents */}
                              {doc.requirementType === "conditional" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className={`h-7 text-xs ${doc.isApplicable ? 'text-amber-600 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30' : 'text-muted-foreground border-muted'}`}
                                        onClick={() => toggleApplicabilityMutation.mutate({ docId: doc.id, isApplicable: !doc.isApplicable })}
                                        disabled={toggleApplicabilityMutation.isPending}
                                      >
                                        {doc.isApplicable ? "Applies" : "N/A"}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">
                                        {doc.isApplicable 
                                          ? "Click to mark as not applicable to this case" 
                                          : "Click to mark as applicable to this case"}
                                      </p>
                                      {doc.applicabilityCondition && (
                                        <p className="text-xs text-muted-foreground mt-1">{doc.applicabilityCondition}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
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
                          {/* Attachments list */}
                          {doc.attachments && doc.attachments.length > 0 && (
                            <div className="mt-2 ml-8 space-y-2">
                              <div className="bg-secondary/30 rounded-lg p-2 space-y-1">
                                {doc.attachments.map((attachment) => (
                                  <div 
                                    key={attachment.id}
                                    className="flex items-center justify-between py-1.5 px-2 bg-background rounded text-sm group"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <DocumentThumbnail
                                        filePath={attachment.file_path}
                                        fileUrl={thumbnailUrls[attachment.file_path] || null}
                                        onPreview={() => setPreviewDoc(doc)}
                                        size={24}
                                      />
                                      <span className="truncate text-muted-foreground">
                                        {attachment.file_name}
                                      </span>
                                      {attachment.file_size && (
                                        <span className="text-xs text-muted-foreground/70 flex-shrink-0">
                                          ({(attachment.file_size / 1024).toFixed(0)} KB)
                                        </span>
                                      )}
                                      {attachment.file_type && (() => {
                                        const fileType = getFileTypeBadge(attachment.file_path);
                                        return fileType ? (
                                          <Badge variant="outline" className={`text-xs ${fileType.color}`}>
                                            {fileType.label}
                                          </Badge>
                                        ) : null;
                                      })()}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground"
                                        onClick={() => handleDownloadFile(attachment.file_path, attachment.file_name)}
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeAttachmentMutation.mutate({ 
                                          attachmentId: attachment.id, 
                                          docId: doc.id, 
                                          filePath: attachment.file_path 
                                        })}
                                        disabled={removeAttachmentMutation.isPending}
                                        title="Remove"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {doc.reviewComment && (
                                <p className="text-sm text-muted-foreground italic pl-1">
                                  "{doc.reviewComment}"
                                </p>
                              )}
                            </div>
                          )}
                          {/* Legacy single file display (for backward compatibility) */}
                          {doc.filePath && (!doc.attachments || doc.attachments.length === 0) && (
                            <div className="mt-2 ml-8 space-y-2">
                              <div className="flex items-center gap-2">
                                <DocumentThumbnail
                                  filePath={doc.filePath}
                                  fileUrl={thumbnailUrls[doc.filePath] || null}
                                  onPreview={() => setPreviewDoc(doc)}
                                  size={32}
                                />
                              </div>
                              {doc.reviewComment && (
                                <p className="text-sm text-muted-foreground italic pl-1">
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
                    variant={visaApplication.status === option.value ? "default" : "outline"}
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
                {statusOptions.find(o => o.value === visaApplication.status)?.description}
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
                    <p className="text-sm text-muted-foreground">{formatDate(visaApplication.created_at)}</p>
                  </div>
                </div>
                {visaApplication.status !== "draft" && (
                  <div className="flex gap-4">
                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="font-medium">Status Changed to Active</p>
                      <p className="text-sm text-muted-foreground">Application in progress</p>
                    </div>
                  </div>
                )}
                {visaApplication.status === "done" && (
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
                <Label>Country</Label>
                <Select
                  value={editForm.countryId}
                  onValueChange={(value) => setEditForm({
                    ...editForm, 
                    countryId: value,
                    applicationName: "",
                    visaSubclass: ""
                  })}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Application Name</Label>
                <Select
                  value={editForm.applicationName}
                  onValueChange={(value) => setEditForm({...editForm, applicationName: value})}
                  disabled={!editForm.countryId}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={editForm.countryId ? "Select application type" : "Select a country first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {editFilteredVisaTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Visa Subclass</Label>
                <Select 
                  value={editForm.visaSubclass} 
                  onValueChange={(value) => setEditForm({...editForm, visaSubclass: value})}
                  disabled={!editForm.countryId}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={editForm.countryId ? "Select visa subclass" : "Select a country first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {editFilteredVisaTypes.map((type) => (
                      <SelectItem key={type.id} value={type.code}>
                        {type.code} - {type.name}
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
                onClick={handleUpdateApplication} 
                disabled={!editForm.applicationName.trim() || updateApplicationMutation.isPending}
              >
                {updateApplicationMutation.isPending ? (
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
                Are you sure you want to delete "{visaApplication.application_name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteApplicationMutation.mutate()}
                disabled={deleteApplicationMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteApplicationMutation.isPending ? (
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

        {/* Merge Templates Confirmation */}
        <AlertDialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Merge Template Documents</AlertDialogTitle>
              <AlertDialogDescription>
                This will add any missing documents from the configured templates to the checklist. Existing documents and uploaded files will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => mergeTemplatesMutation.mutate()}
                disabled={mergeTemplatesMutation.isPending}
              >
                {mergeTemplatesMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Merging...
                  </>
                ) : (
                  "Merge"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invite Client Dialog */}
        <InviteClientDialog
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          visaApplicationId={visaApplicationId!}
          clientId={visaApplication.client_id}
          clientEmail={client?.email || null}
          companyId={visaApplication.company_id}
          applicationName={visaApplication.application_name}
        />

        {/* Document Preview Dialog */}
        <DocumentPreviewDialog
          open={!!previewDoc}
          onOpenChange={(open) => !open && setPreviewDoc(null)}
          document={previewDoc}
          onReviewUpdate={handleReviewUpdate}
          onRequestNewDocument={handleRequestNewDocument}
          companyId={visaApplication?.company_id}
        />
      </div>
    </AppLayout>
  );
};

export default VisaApplicationDetail;
