import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DocumentsListTab from "@/components/documents/DocumentsListTab";
import { 
  Plus, 
  FileCheck,
  Loader2,
  Trash2,
  Pencil,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Save,
  Check,
  ChevronsUpDown,
  Search,
  X,
  Eye,
  Settings,
  User,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { cn } from "@/lib/utils";

interface DocumentTemplate {
  id: string;
  visa_type_id: string | null;
  visa_subclass: string | null;
  category: string;
  document_name: string;
  is_required: boolean;
  sort_order: number;
  country_id: string | null;
  applicant_type_id: string | null;
  age_condition: string | null;
  description: string | null;
  requires_translation: boolean;
  applicant_type?: ApplicantType | null;
}

interface ApplicantType {
  id: string;
  name: string;
  code: string;
  sort_order: number;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

interface ApplicationCategory {
  id: string;
  name: string;
  code: string;
  country_id: string | null;
}

interface ApplicationSubcategory {
  id: string;
  name: string;
  code: string;
  category_id: string;
}

interface VisaType {
  id: string;
  name: string;
  code: string;
  country_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
}

const defaultCategories = [
  "Identity",
  "Character",
  "Health",
  "Employment",
  "Skills",
  "English",
  "Education",
  "Financial",
  "Relationship",
  "Sponsor",
  "Insurance",
  "Nomination",
  "Other",
];

// Common document names organized by category
const commonDocuments: Record<string, string[]> = {
  Identity: [
    "Passport (certified copy)",
    "Birth Certificate",
    "Passport Photos",
    "National ID Card",
    "Driver's License",
    "Change of Name Certificate",
  ],
  Character: [
    "Police Clearance Certificate",
    "AFP National Police Check",
    "Character Statutory Declaration",
    "Military Service Records",
  ],
  Health: [
    "Health Examination Results",
    "Medical Report",
    "Chest X-Ray",
    "HIV Test Results",
    "Vaccination Records",
  ],
  Employment: [
    "Employment Contract",
    "Resume/CV",
    "Employment References",
    "Letter of Offer",
    "Payslips (last 3 months)",
    "Tax Returns",
    "Job Description",
  ],
  Skills: [
    "Skills Assessment",
    "Trade Qualifications",
    "Professional Registration",
    "Work Experience Letters",
  ],
  English: [
    "English Language Test Results",
    "IELTS Certificate",
    "PTE Academic Score Report",
    "TOEFL Score Report",
    "OET Results",
  ],
  Education: [
    "Qualifications/Degrees",
    "Academic Transcripts",
    "Confirmation of Enrolment (CoE)",
    "Completion Letter",
    "Professional Certifications",
  ],
  Financial: [
    "Financial Evidence",
    "Bank Statements (last 3 months)",
    "Tax Assessment Notice",
    "Proof of Assets",
    "Sponsorship Undertaking",
  ],
  Relationship: [
    "Relationship Evidence",
    "Form 888 Statutory Declarations",
    "Joint Financial Records",
    "Shared Lease/Mortgage",
    "Photos Together",
    "Communication Evidence",
    "Marriage Certificate",
  ],
  Sponsor: [
    "Sponsor's Identity Documents",
    "Sponsor's Citizenship Evidence",
    "Sponsor's Income Evidence",
    "Sponsor's Employment Letter",
  ],
  Insurance: [
    "OSHC Policy",
    "Health Insurance Certificate",
    "Travel Insurance",
  ],
  Nomination: [
    "Nomination Approval",
    "Labour Market Testing Evidence",
    "Business Registration",
    "Company Financials",
  ],
  Other: [],
};

const DocumentTemplates = () => {
  const queryClient = useQueryClient();
  const { currentCompany, currentRole } = useCompany();
  const isAdmin = currentRole === "owner" || currentRole === "admin";
  
  // Filter states
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [selectedApplicationType, setSelectedApplicationType] = useState<string>("");
  const [searchName, setSearchName] = useState("");
  
  // Sort states for application types overview
  const [sortColumn, setSortColumn] = useState<'name' | 'code' | 'country' | 'category' | 'documents'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };


  // Dialog states
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentTemplate | null>(null);
  const [editingDocOriginalDescription, setEditingDocOriginalDescription] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentTemplate | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(defaultCategories));
  const [expandedApplicantTypes, setExpandedApplicantTypes] = useState<Set<string>>(new Set(["Primary Applicant", "Partner", "Dependant", "Sponsor", "Witness", "General"]));
  
  const [newDoc, setNewDoc] = useState({
    category: "",
    documentName: "",
    isRequired: true,
    applicantTypeId: "",
    ageCondition: "",
    description: "",
    requiresTranslation: false,
  });
  
  const [docNameOpen, setDocNameOpen] = useState(false);
  const [editDocNameOpen, setEditDocNameOpen] = useState(false);
  const [customDocName, setCustomDocName] = useState("");

  // Fetch countries
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

  // Fetch application categories based on selected country
  const { data: applicationCategories = [] } = useQuery({
    queryKey: ["application-categories", selectedCountry],
    queryFn: async () => {
      let query = supabase
        .from("application_categories")
        .select("id, name, code, country_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (selectedCountry) {
        query = query.or(`country_id.eq.${selectedCountry},country_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationCategory[];
    },
    enabled: !!selectedCountry,
  });

  // Fetch subcategories based on selected category
  const { data: subcategories = [] } = useQuery({
    queryKey: ["application-subcategories", selectedCategory],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_subcategories")
        .select("id, name, code, category_id")
        .eq("category_id", selectedCategory)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as ApplicationSubcategory[];
    },
    enabled: !!selectedCategory,
  });

  // Fetch visa types (application types) based on country, category, and subcategory
  const { data: visaTypes = [] } = useQuery({
    queryKey: ["visa-types", selectedCountry, selectedCategory, selectedSubcategory],
    queryFn: async () => {
      let query = supabase
        .from("visa_types")
        .select("id, name, code, country_id, category_id, subcategory_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (selectedCountry) {
        query = query.or(`country_id.eq.${selectedCountry},country_id.is.null`);
      }
      
      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }
      
      if (selectedSubcategory) {
        query = query.eq("subcategory_id", selectedSubcategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as VisaType[];
    },
    enabled: !!selectedCountry && !!selectedCategory,
  });

  // Fetch applicant types
  const { data: applicantTypes = [] } = useQuery({
    queryKey: ["applicant-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as ApplicantType[];
    },
  });

  // Fetch templates for selected application type via junction table
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates", currentCompany?.id, selectedApplicationType],
    queryFn: async () => {
      if (!selectedApplicationType) return [];
      
      // First get template IDs linked to this application type via junction table
      const { data: linkedTemplates, error: linkError } = await supabase
        .from("document_template_applications")
        .select("document_template_id")
        .eq("visa_type_id", selectedApplicationType);
      
      if (linkError) throw linkError;
      
      const templateIds = linkedTemplates?.map(t => t.document_template_id) || [];
      
      if (templateIds.length === 0) return [];
      
      // Fetch the actual templates with applicant type
      const { data, error } = await supabase
        .from("document_checklist_templates")
        .select("*, applicant_type:applicant_types(*)")
        .in("id", templateIds)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as DocumentTemplate[];
    },
    enabled: !!selectedApplicationType,
  });

  // Filter templates by search name
  const filteredTemplates = useMemo(() => {
    if (!searchName.trim()) return templates;
    return templates.filter(t => 
      t.document_name.toLowerCase().includes(searchName.toLowerCase())
    );
  }, [templates, searchName]);

  // Fetch all visa types with document counts for overview
  const { data: applicationSummary = [], isLoading: isSummaryLoading } = useQuery({
    queryKey: ["application-summary", selectedCountry, selectedCategory, selectedSubcategory],
    queryFn: async () => {
      // Build query based on filters
      let query = supabase
        .from("visa_types")
        .select(`
          id, 
          name, 
          code,
          country_id,
          category_id,
          country:countries!inner(name, code, is_active),
          category:application_categories(name),
          subcategory:application_subcategories(name)
        `)
        .eq("is_active", true)
        .eq("country.is_active", true)
        .order("sort_order");
      
      if (selectedCountry) {
        query = query.or(`country_id.eq.${selectedCountry},country_id.is.null`);
      }
      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }
      if (selectedSubcategory) {
        query = query.eq("subcategory_id", selectedSubcategory);
      }
      
      const { data: visaTypesData, error } = await query;
      if (error) throw error;
      
      // Get document counts via junction table
      const { data: counts, error: countError } = await supabase
        .from("document_template_applications")
        .select("visa_type_id");
      
      if (countError) throw countError;
      
      // Count documents per visa type
      const countMap = (counts || []).reduce((acc, item) => {
        acc[item.visa_type_id] = (acc[item.visa_type_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Combine data
      return (visaTypesData || []).map(vt => ({
        ...vt,
        document_count: countMap[vt.id] || 0
      }));
    },
    enabled: !selectedApplicationType, // Only fetch when no app type selected
  });

  const sortedApplicationSummary = useMemo(() => {
    return [...applicationSummary].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'code': cmp = a.code.localeCompare(b.code); break;
        case 'country': cmp = (a.country?.name || '').localeCompare(b.country?.name || ''); break;
        case 'category': cmp = (a.category?.name || '').localeCompare(b.category?.name || ''); break;
        case 'documents': cmp = a.document_count - b.document_count; break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [applicationSummary, sortColumn, sortDirection]);

  // Get unique categories from templates
  const docCategories = [...new Set([
    ...defaultCategories,
    ...filteredTemplates.map(t => t.category)
  ])];

  // Group templates by category (kept for dialogs)
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, DocumentTemplate[]>);

  // Group templates by applicant type, then by category
  const groupedByApplicantType = useMemo(() => {
    const grouped: Record<string, Record<string, DocumentTemplate[]>> = {};
    
    filteredTemplates.forEach(template => {
      const applicantType = template.applicant_type?.name || "General";
      const category = template.category;
      
      if (!grouped[applicantType]) {
        grouped[applicantType] = {};
      }
      if (!grouped[applicantType][category]) {
        grouped[applicantType][category] = [];
      }
      grouped[applicantType][category].push(template);
    });
    
    return grouped;
  }, [filteredTemplates]);

  // Get ordered applicant types for consistent display
  const orderedApplicantTypes = useMemo(() => {
    const types = Object.keys(groupedByApplicantType);
    const preferredOrder = ["Primary Applicant", "Partner", "Dependant", "Sponsor", "Witness"];
    
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

  // Toggle applicant type expansion
  const toggleApplicantType = (applicantType: string) => {
    setExpandedApplicantTypes(prev => {
      const next = new Set(prev);
      if (next.has(applicantType)) {
        next.delete(applicantType);
      } else {
        next.add(applicantType);
      }
      return next;
    });
  };

  // Get document count for an applicant type
  const getApplicantTypeDocCount = (applicantType: string) => {
    const categories = groupedByApplicantType[applicantType] || {};
    return Object.values(categories).reduce((sum, docs) => sum + docs.length, 0);
  };

  // Get selected application type details
  const selectedTypeDetails = visaTypes.find(v => v.id === selectedApplicationType);

  // Add document mutation
  const addDocMutation = useMutation({
    mutationFn: async (doc: { category: string; document_name: string; is_required: boolean; applicant_type_id: string | null; age_condition: string | null; description: string | null; requires_translation: boolean }) => {
      if (!currentCompany?.id || !selectedApplicationType) throw new Error("No company or application type selected");
      
      const maxOrder = templates
        .filter(t => t.category === doc.category)
        .reduce((max, t) => Math.max(max, t.sort_order), -1);
      
      const { data, error } = await supabase
        .from("document_checklist_templates")
        .insert({
          company_id: currentCompany.id,
          visa_type_id: selectedApplicationType,
          country_id: selectedCountry || null,
          category: doc.category,
          document_name: doc.document_name,
          is_required: doc.is_required,
          applicant_type_id: doc.applicant_type_id || null,
          age_condition: doc.age_condition || null,
          description: doc.description || null,
          requires_translation: doc.requires_translation,
          sort_order: maxOrder + 1,
        })
        .select("*, applicant_type:applicant_types(*)")
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates", currentCompany?.id, selectedApplicationType] });
      setIsAddDocOpen(false);
      setNewDoc({ category: "", documentName: "", isRequired: true, applicantTypeId: "", ageCondition: "", description: "", requiresTranslation: false });
      toast.success("Document added to template");
    },
    onError: (error) => {
      toast.error("Failed to add document", { description: error.message });
    },
  });

  // Update document mutation
  const updateDocMutation = useMutation({
    mutationFn: async (doc: { id: string; document_name: string; is_required: boolean; category: string; applicant_type_id: string | null; age_condition: string | null; description: string | null; requires_translation: boolean; oldDescription: string | null }) => {
      const { data, error } = await supabase
        .from("document_checklist_templates")
        .update({
          document_name: doc.document_name,
          is_required: doc.is_required,
          category: doc.category,
          applicant_type_id: doc.applicant_type_id || null,
          age_condition: doc.age_condition || null,
          description: doc.description || null,
          requires_translation: doc.requires_translation,
        })
        .eq("id", doc.id)
        .select("*, applicant_type:applicant_types(*)")
        .single();
      
      if (error) throw error;

      // Sync description to existing application checklists if it changed
      const descriptionChanged = (doc.oldDescription ?? null) !== (doc.description ?? null);
      let syncedCount = 0;
      if (descriptionChanged && currentCompany?.id) {
        const { data: syncResult } = await supabase.rpc('sync_template_description_to_checklists', {
          p_company_id: currentCompany.id,
          p_document_name: doc.document_name,
          p_category: doc.category,
          p_new_description: doc.description || '',
        });
        syncedCount = syncResult ?? 0;
      }

      return { data, syncedCount, descriptionChanged };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["document-templates", currentCompany?.id, selectedApplicationType] });
      setEditingDoc(null);
      setEditingDocOriginalDescription(null);
      if (result.descriptionChanged && result.syncedCount > 0) {
        toast.success("Document updated", { description: `Description synced to ${result.syncedCount} application checklist(s)` });
      } else {
        toast.success("Document updated");
      }
    },
    onError: (error) => {
      toast.error("Failed to update document", { description: error.message });
    },
  });

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("document_checklist_templates")
        .delete()
        .eq("id", docId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates", currentCompany?.id, selectedApplicationType] });
      setDocToDelete(null);
      toast.success("Document removed from template");
    },
    onError: (error) => {
      toast.error("Failed to remove document", { description: error.message });
    },
  });

  const handleAddDocument = () => {
    if (!newDoc.category || !newDoc.documentName.trim()) return;
    addDocMutation.mutate({
      category: newDoc.category,
      document_name: newDoc.documentName.trim(),
      is_required: newDoc.isRequired,
      applicant_type_id: newDoc.applicantTypeId || null,
      age_condition: newDoc.ageCondition || null,
      description: newDoc.description || null,
      requires_translation: newDoc.requiresTranslation,
    });
  };

  const handleUpdateDocument = () => {
    if (!editingDoc || !editingDoc.document_name.trim()) return;
    updateDocMutation.mutate({
      id: editingDoc.id,
      document_name: editingDoc.document_name.trim(),
      is_required: editingDoc.is_required,
      category: editingDoc.category,
      applicant_type_id: editingDoc.applicant_type_id || null,
      age_condition: editingDoc.age_condition || null,
      description: editingDoc.description || null,
      requires_translation: editingDoc.requires_translation ?? false,
      oldDescription: editingDocOriginalDescription,
    });
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedApplicationType("");
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedSubcategory("");
    setSelectedApplicationType("");
  };

  const handleSubcategoryChange = (value: string) => {
    setSelectedSubcategory(value);
    setSelectedApplicationType("");
  };

  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedApplicationType("");
    setSearchName("");
  };

  if (!isAdmin) {
    return (
      <AppLayout niche="migration">
        <div className="p-6 lg:p-8">
          <div className="text-center py-12">
            <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">Only admins and owners can manage the document checklist.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Document Checklist</h1>
            <p className="text-muted-foreground mt-1">
              Configure required documents for each application type
            </p>
          </div>
          <Button 
            variant="gradient" 
            onClick={() => setIsAddDocOpen(true)}
            disabled={!selectedApplicationType}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="card-gradient rounded-xl border border-border/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Country Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Country</Label>
              <Select value={selectedCountry} onValueChange={handleCountryChange}>
                <SelectTrigger>
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

            {/* Category Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <Select 
                value={selectedCategory} 
                onValueChange={handleCategoryChange}
                disabled={!selectedCountry}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCountry ? "Select category" : "Select country first"} />
                </SelectTrigger>
                <SelectContent>
                  {applicationCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subcategory</Label>
              <Select 
                value={selectedSubcategory} 
                onValueChange={handleSubcategoryChange}
                disabled={!selectedCategory || subcategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedCategory 
                      ? "Select category first" 
                      : subcategories.length === 0 
                        ? "No subcategories" 
                        : "Select subcategory (optional)"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Application Name Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Application Name</Label>
              <Select 
                value={selectedApplicationType} 
                onValueChange={setSelectedApplicationType}
                disabled={!selectedCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCategory ? "Select application name" : "Select category first"} />
                </SelectTrigger>
                <SelectContent>
                  {visaTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Documents</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-9"
                  disabled={!selectedApplicationType}
                />
                {searchName && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchName("")}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedCountry || selectedCategory || selectedSubcategory || selectedApplicationType || searchName) && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCountry && (
                  <Badge variant="secondary" className="gap-1">
                    {countries.find(c => c.id === selectedCountry)?.name}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleCountryChange("")}
                    />
                  </Badge>
                )}
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-1">
                    {applicationCategories.find(c => c.id === selectedCategory)?.name}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleCategoryChange("")}
                    />
                  </Badge>
                )}
                {selectedSubcategory && (
                  <Badge variant="secondary" className="gap-1">
                    {subcategories.find(s => s.id === selectedSubcategory)?.name}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleSubcategoryChange("")}
                    />
                  </Badge>
                )}
                {selectedApplicationType && (
                  <Badge variant="secondary" className="gap-1">
                    {visaTypes.find(v => v.id === selectedApplicationType)?.name}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => setSelectedApplicationType("")}
                    />
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          )}
        </div>

        {/* Content Area */}
        {!selectedApplicationType ? (
          <div className="card-gradient rounded-xl border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="text-lg font-semibold">Application Types Overview</h3>
              <p className="text-sm text-muted-foreground">
                {applicationSummary.length} application type{applicationSummary.length !== 1 ? "s" : ""} found
                {(selectedCountry || selectedCategory) && " (filtered)"}
              </p>
            </div>
            {isSummaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : applicationSummary.length === 0 ? (
              <div className="p-12 text-center">
                <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Application Types Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {selectedCountry || selectedCategory 
                    ? "Try adjusting your filters to see more application types."
                    : "No application types have been configured yet."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('name')}>
                      <span className="flex items-center gap-1">
                        Application Name
                        {sortColumn === 'name' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('code')}>
                      <span className="flex items-center gap-1">
                        Code
                        {sortColumn === 'code' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('country')}>
                      <span className="flex items-center gap-1">
                        Country
                        {sortColumn === 'country' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('category')}>
                      <span className="flex items-center gap-1">
                        Category
                        {sortColumn === 'category' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:text-foreground text-center" onClick={() => handleSort('documents')}>
                      <span className="flex items-center justify-center gap-1">
                        Documents
                        {sortColumn === 'documents' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedApplicationSummary.map((app) => (
                    <TableRow key={app.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                      if (app.country_id && app.country_id !== selectedCountry) {
                        setSelectedCountry(app.country_id);
                      }
                      if (app.category_id && app.category_id !== selectedCategory) {
                        setSelectedCategory(app.category_id);
                      }
                      setSelectedApplicationType(app.id);
                    }}>
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell className="text-muted-foreground">{app.code}</TableCell>
                      <TableCell>{app.country?.name || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{app.category?.name || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={app.document_count > 0 ? "default" : "secondary"}>
                          {app.document_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (app.country_id && app.country_id !== selectedCountry) {
                              setSelectedCountry(app.country_id);
                            }
                            if (app.category_id && app.category_id !== selectedCategory) {
                              setSelectedCategory(app.category_id);
                            }
                            setSelectedApplicationType(app.id);
                          }}
                        >
                          {app.document_count > 0 ? (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </>
                          ) : (
                            <>
                              <Settings className="w-4 h-4 mr-1" />
                              Configure
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected Type Info */}
            <div className="card-gradient rounded-xl border border-border/50 p-4">
              <h2 className="text-lg font-semibold mb-1">
                {selectedTypeDetails?.name} ({selectedTypeDetails?.code})
              </h2>
              <p className="text-sm text-muted-foreground">
                {filteredTemplates.length} document{filteredTemplates.length !== 1 ? "s" : ""} configured
                {searchName && ` (filtered from ${templates.length})`}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="card-gradient rounded-xl border border-border/50 p-12 text-center">
                <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchName ? "No documents match your search" : "No documents configured"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchName 
                    ? `Try a different search term or clear the filter.`
                    : `Add required documents for ${selectedTypeDetails?.name} applications.`
                  }
                </p>
                {!searchName && (
                  <Button variant="outline" onClick={() => setIsAddDocOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Document
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {orderedApplicantTypes.map((applicantType) => (
                  <div key={applicantType} className="space-y-3">
                    {/* Applicant Type Header */}
                    <button
                      onClick={() => toggleApplicantType(applicantType)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-secondary/30 rounded-lg transition-colors"
                    >
                      {expandedApplicantTypes.has(applicantType) ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                      <User className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-semibold">{applicantType}</h2>
                      <Badge variant="secondary" className="ml-auto">
                        {getApplicantTypeDocCount(applicantType)}
                      </Badge>
                    </button>

                    <AnimatePresence>
                      {expandedApplicantTypes.has(applicantType) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="pl-6 space-y-3"
                        >
                          {Object.entries(groupedByApplicantType[applicantType] || {})
                            .sort(([catA], [catB]) => {
                              const orderA = defaultCategories.indexOf(catA);
                              const orderB = defaultCategories.indexOf(catB);
                              if (orderA === -1 && orderB === -1) return catA.localeCompare(catB);
                              if (orderA === -1) return 1;
                              if (orderB === -1) return -1;
                              return orderA - orderB;
                            })
                            .map(([category, docs]) => (
                              <div 
                                key={`${applicantType}-${category}`} 
                                className="card-gradient rounded-xl border border-border/50 overflow-hidden"
                              >
                                <button
                                  onClick={() => toggleCategory(`${applicantType}-${category}`)}
                                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    {expandedCategories.has(`${applicantType}-${category}`) ? (
                                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    )}
                                    <h3 className="font-semibold">{category}</h3>
                                    <Badge variant="outline">
                                      {docs.length}
                                    </Badge>
                                  </div>
                                </button>

                                <AnimatePresence>
                                  {expandedCategories.has(`${applicantType}-${category}`) && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <div className="border-t border-border/50 divide-y divide-border/50">
                                        {docs.map((doc) => (
                                          <div 
                                            key={doc.id}
                                            className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                                          >
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                                              <span className="font-medium">{doc.document_name}</span>
                                              {doc.age_condition && (
                                                <Badge variant="outline" className="text-xs">
                                                  {doc.age_condition}
                                                </Badge>
                                              )}
                                              {!doc.is_required && (
                                                <Badge variant="secondary" className="text-xs">Optional</Badge>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => { setEditingDoc(doc); setEditingDocOriginalDescription(doc.description ?? null); }}
                                              >
                                                <Pencil className="w-4 h-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setDocToDelete(doc)}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Document Dialog */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Add a new required document for {selectedTypeDetails?.name} applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newDoc.category}
                onValueChange={(value) => setNewDoc({ ...newDoc, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {docCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Popover open={docNameOpen} onOpenChange={setDocNameOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={docNameOpen}
                    className="w-full justify-between font-normal"
                  >
                    {newDoc.documentName || "Select or type a document name..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search or add new..." 
                      value={customDocName}
                      onValueChange={setCustomDocName}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2">
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start"
                            onClick={() => {
                              setNewDoc({ ...newDoc, documentName: customDocName });
                              setDocNameOpen(false);
                              setCustomDocName("");
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add "{customDocName}"
                          </Button>
                        </div>
                      </CommandEmpty>
                      {newDoc.category && commonDocuments[newDoc.category]?.length > 0 && (
                        <CommandGroup heading={`${newDoc.category} Documents`}>
                          {commonDocuments[newDoc.category].map((doc) => (
                            <CommandItem
                              key={doc}
                              value={doc}
                              onSelect={() => {
                                setNewDoc({ ...newDoc, documentName: doc });
                                setDocNameOpen(false);
                                setCustomDocName("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newDoc.documentName === doc ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {doc}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {customDocName && !commonDocuments[newDoc.category]?.some(d => 
                        d.toLowerCase().includes(customDocName.toLowerCase())
                      ) && (
                        <>
                          <CommandSeparator />
                          <CommandGroup heading="Add Custom">
                            <CommandItem
                              value={`add-${customDocName}`}
                              onSelect={() => {
                                setNewDoc({ ...newDoc, documentName: customDocName });
                                setDocNameOpen(false);
                                setCustomDocName("");
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add "{customDocName}"
                            </CommandItem>
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Applicant Type</Label>
              <Select
                value={newDoc.applicantTypeId}
                onValueChange={(value) => setNewDoc({ ...newDoc, applicantTypeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select applicant type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {applicantTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age Condition (optional)</Label>
              <Input
                value={newDoc.ageCondition}
                onChange={(e) => setNewDoc({ ...newDoc, ageCondition: e.target.value })}
                placeholder="e.g., +16yrs, Under 18"
              />
            </div>
            <div className="space-y-2">
              <Label>Description / Instructions</Label>
              <Textarea
                value={newDoc.description}
                onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                placeholder="e.g., A copy of the biographical details page of your current valid passport..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This instruction will be shown to clients in the portal.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Required Document</Label>
              <Switch
                checked={newDoc.isRequired}
                onCheckedChange={(checked) => setNewDoc({ ...newDoc, isRequired: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Requires Translation</Label>
                <p className="text-xs text-muted-foreground">Auto-creates a linked translation document</p>
              </div>
              <Switch
                checked={newDoc.requiresTranslation}
                onCheckedChange={(checked) => setNewDoc({ ...newDoc, requiresTranslation: checked })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddDocOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddDocument}
                disabled={!newDoc.category || !newDoc.documentName.trim() || addDocMutation.isPending}
              >
                {addDocMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document details.
            </DialogDescription>
          </DialogHeader>
          {editingDoc && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editingDoc.category}
                  onValueChange={(value) => setEditingDoc({ ...editingDoc, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {docCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Document Name</Label>
                <Popover open={editDocNameOpen} onOpenChange={setEditDocNameOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editDocNameOpen}
                      className="w-full justify-between font-normal"
                    >
                      {editingDoc.document_name || "Select or type a document name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search or add new..." 
                        value={customDocName}
                        onValueChange={setCustomDocName}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2">
                            <Button 
                              variant="ghost" 
                              className="w-full justify-start"
                              onClick={() => {
                                setEditingDoc({ ...editingDoc, document_name: customDocName });
                                setEditDocNameOpen(false);
                                setCustomDocName("");
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add "{customDocName}"
                            </Button>
                          </div>
                        </CommandEmpty>
                        {editingDoc.category && commonDocuments[editingDoc.category]?.length > 0 && (
                          <CommandGroup heading={`${editingDoc.category} Documents`}>
                            {commonDocuments[editingDoc.category].map((doc) => (
                              <CommandItem
                                key={doc}
                                value={doc}
                                onSelect={() => {
                                  setEditingDoc({ ...editingDoc, document_name: doc });
                                  setEditDocNameOpen(false);
                                  setCustomDocName("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    editingDoc.document_name === doc ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {doc}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {customDocName && !commonDocuments[editingDoc.category]?.some(d => 
                          d.toLowerCase().includes(customDocName.toLowerCase())
                        ) && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading="Add Custom">
                              <CommandItem
                                value={`add-${customDocName}`}
                                onSelect={() => {
                                  setEditingDoc({ ...editingDoc, document_name: customDocName });
                                  setEditDocNameOpen(false);
                                  setCustomDocName("");
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add "{customDocName}"
                              </CommandItem>
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Applicant Type</Label>
                <Select
                  value={editingDoc.applicant_type_id || ""}
                  onValueChange={(value) => setEditingDoc({ ...editingDoc, applicant_type_id: value || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select applicant type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {applicantTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Age Condition (optional)</Label>
                <Input
                  value={editingDoc.age_condition || ""}
                  onChange={(e) => setEditingDoc({ ...editingDoc, age_condition: e.target.value || null })}
                  placeholder="e.g., +16yrs, Under 18"
                />
              </div>
              <div className="space-y-2">
                <Label>Description / Instructions</Label>
                <Textarea
                  value={editingDoc.description || ""}
                  onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value || null })}
                  placeholder="e.g., A copy of the biographical details page of your current valid passport..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This instruction will be shown to clients in the portal.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Required Document</Label>
                <Switch
                  checked={editingDoc.is_required}
                  onCheckedChange={(checked) => setEditingDoc({ ...editingDoc, is_required: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Requires Translation</Label>
                  <p className="text-xs text-muted-foreground">Auto-creates a linked translation document</p>
                </div>
                <Switch
                  checked={editingDoc.requires_translation ?? false}
                  onCheckedChange={(checked) => setEditingDoc({ ...editingDoc, requires_translation: checked })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingDoc(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateDocument}
                  disabled={!editingDoc.document_name.trim() || updateDocMutation.isPending}
                >
                  {updateDocMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{docToDelete?.document_name}" from the {selectedTypeDetails?.name} template. 
              This won't affect existing applications that already use this document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => docToDelete && deleteDocMutation.mutate(docToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default DocumentTemplates;
