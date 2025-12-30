import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  ChevronsUpDown
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { cn } from "@/lib/utils";

interface DocumentTemplate {
  id: string;
  visa_subclass: string;
  category: string;
  document_name: string;
  is_required: boolean;
  sort_order: number;
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
  
  const [selectedVisa, setSelectedVisa] = useState(visaSubclasses[0].value);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentTemplate | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentTemplate | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(defaultCategories));
  
  const [newDoc, setNewDoc] = useState({
    category: "",
    documentName: "",
    isRequired: true,
  });
  
  const [newCategory, setNewCategory] = useState("");
  const [docNameOpen, setDocNameOpen] = useState(false);
  const [editDocNameOpen, setEditDocNameOpen] = useState(false);
  const [customDocName, setCustomDocName] = useState("");

  // Fetch templates for selected visa
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates", currentCompany?.id, selectedVisa],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("document_checklist_templates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("visa_subclass", selectedVisa)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as DocumentTemplate[];
    },
    enabled: !!currentCompany?.id,
  });

  // Get unique categories from templates
  const categories = [...new Set([
    ...defaultCategories,
    ...templates.map(t => t.category)
  ])];

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, DocumentTemplate[]>);

  // Add document mutation
  const addDocMutation = useMutation({
    mutationFn: async (doc: { category: string; document_name: string; is_required: boolean }) => {
      if (!currentCompany?.id) throw new Error("No company");
      
      const maxOrder = templates
        .filter(t => t.category === doc.category)
        .reduce((max, t) => Math.max(max, t.sort_order), -1);
      
      const { data, error } = await supabase
        .from("document_checklist_templates")
        .insert({
          company_id: currentCompany.id,
          visa_subclass: selectedVisa,
          category: doc.category,
          document_name: doc.document_name,
          is_required: doc.is_required,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates", currentCompany?.id, selectedVisa] });
      setIsAddDocOpen(false);
      setNewDoc({ category: "", documentName: "", isRequired: true });
      toast.success("Document added to template");
    },
    onError: (error) => {
      toast.error("Failed to add document", { description: error.message });
    },
  });

  // Update document mutation
  const updateDocMutation = useMutation({
    mutationFn: async (doc: { id: string; document_name: string; is_required: boolean; category: string }) => {
      const { data, error } = await supabase
        .from("document_checklist_templates")
        .update({
          document_name: doc.document_name,
          is_required: doc.is_required,
          category: doc.category,
        })
        .eq("id", doc.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates", currentCompany?.id, selectedVisa] });
      setEditingDoc(null);
      toast.success("Document updated");
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
      queryClient.invalidateQueries({ queryKey: ["document-templates", currentCompany?.id, selectedVisa] });
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
    });
  };

  const handleUpdateDocument = () => {
    if (!editingDoc || !editingDoc.document_name.trim()) return;
    updateDocMutation.mutate({
      id: editingDoc.id,
      document_name: editingDoc.document_name.trim(),
      is_required: editingDoc.is_required,
      category: editingDoc.category,
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

  const getVisaLabel = (value: string) => {
    return visaSubclasses.find(v => v.value === value)?.label || value;
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
              Configure required documents for each visa type
            </p>
          </div>
          <Button variant="gradient" onClick={() => setIsAddDocOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Button>
        </div>

        {/* Visa Type Tabs */}
        <Tabs value={selectedVisa} onValueChange={setSelectedVisa}>
          <div className="overflow-x-auto">
            <TabsList className="bg-secondary inline-flex w-auto min-w-full lg:min-w-0">
              {visaSubclasses.map((visa) => (
                <TabsTrigger 
                  key={visa.value} 
                  value={visa.value}
                  className="whitespace-nowrap"
                >
                  {visa.value}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {visaSubclasses.map((visa) => (
            <TabsContent key={visa.value} value={visa.value} className="space-y-4 mt-6">
              <div className="card-gradient rounded-xl border border-border/50 p-4">
                <h2 className="text-lg font-semibold mb-1">{visa.label}</h2>
                <p className="text-sm text-muted-foreground">
                  {templates.length} document{templates.length !== 1 ? "s" : ""} configured
                </p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : templates.length === 0 ? (
                <div className="card-gradient rounded-xl border border-border/50 p-12 text-center">
                  <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No documents configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Add required documents for {visa.label} applications.
                  </p>
                  <Button variant="outline" onClick={() => setIsAddDocOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {categories
                    .filter(category => groupedTemplates[category]?.length > 0)
                    .map((category) => (
                      <div 
                        key={category} 
                        className="card-gradient rounded-xl border border-border/50 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                            <h3 className="font-semibold">{category}</h3>
                            <Badge variant="outline">
                              {groupedTemplates[category]?.length || 0}
                            </Badge>
                          </div>
                        </button>

                        <AnimatePresence>
                          {expandedCategories.has(category) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="border-t border-border/50 divide-y divide-border/50">
                                {groupedTemplates[category]?.map((doc) => (
                                  <div 
                                    key={doc.id}
                                    className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                                      <span className="font-medium">{doc.document_name}</span>
                                      {!doc.is_required && (
                                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditingDoc(doc)}
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
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Add Document Dialog */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Add a new required document for {getVisaLabel(selectedVisa)} applications.
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
                  {categories.map((cat) => (
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
            <div className="flex items-center justify-between">
              <Label>Required Document</Label>
              <Switch
                checked={newDoc.isRequired}
                onCheckedChange={(checked) => setNewDoc({ ...newDoc, isRequired: checked })}
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
                    {categories.map((cat) => (
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
              <div className="flex items-center justify-between">
                <Label>Required Document</Label>
                <Switch
                  checked={editingDoc.is_required}
                  onCheckedChange={(checked) => setEditingDoc({ ...editingDoc, is_required: checked })}
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
              This will remove "{docToDelete?.document_name}" from the {getVisaLabel(selectedVisa)} template. 
              This won't affect existing matters that already use this document.
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