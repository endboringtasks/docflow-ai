import { useState } from "react";
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
  Plus
} from "lucide-react";
import { motion } from "framer-motion";
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

interface Matter {
  id: string;
  client_id: string;
  matter_name: string;
  visa_subclass: string | null;
  status: "draft" | "active" | "done";
  drive_folder_id: string | null;
  created_at: string;
}

interface Client {
  id: string;
  full_name: string;
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

// Default document checklist based on visa subclass
const getDefaultDocuments = (visaSubclass: string | null): DocumentItem[] => {
  const baseDocuments: DocumentItem[] = [
    { id: "1", name: "Passport (certified copy)", category: "Identity", required: true, completed: false },
    { id: "2", name: "Birth Certificate", category: "Identity", required: true, completed: false },
    { id: "3", name: "Passport Photos", category: "Identity", required: true, completed: false },
    { id: "4", name: "Police Clearance Certificate", category: "Character", required: true, completed: false },
    { id: "5", name: "Health Examination Results", category: "Health", required: true, completed: false },
  ];

  const additionalDocsByVisa: Record<string, DocumentItem[]> = {
    "482": [
      { id: "6", name: "Employment Contract", category: "Employment", required: true, completed: false },
      { id: "7", name: "Skills Assessment", category: "Skills", required: true, completed: false },
      { id: "8", name: "English Language Test Results", category: "English", required: true, completed: false },
      { id: "9", name: "Qualifications/Degrees", category: "Education", required: true, completed: false },
      { id: "10", name: "Resume/CV", category: "Employment", required: true, completed: false },
    ],
    "186": [
      { id: "6", name: "Nomination Approval", category: "Nomination", required: true, completed: false },
      { id: "7", name: "Skills Assessment", category: "Skills", required: true, completed: false },
      { id: "8", name: "English Language Test Results", category: "English", required: true, completed: false },
      { id: "9", name: "Employment References", category: "Employment", required: true, completed: false },
    ],
    "500": [
      { id: "6", name: "Confirmation of Enrolment (CoE)", category: "Education", required: true, completed: false },
      { id: "7", name: "English Language Test Results", category: "English", required: true, completed: false },
      { id: "8", name: "Financial Evidence", category: "Financial", required: true, completed: false },
      { id: "9", name: "OSHC Policy", category: "Insurance", required: true, completed: false },
    ],
    "820": [
      { id: "6", name: "Relationship Evidence", category: "Relationship", required: true, completed: false },
      { id: "7", name: "Sponsor's Identity Documents", category: "Sponsor", required: true, completed: false },
      { id: "8", name: "Form 888 Statutory Declarations", category: "Relationship", required: true, completed: false },
      { id: "9", name: "Joint Financial Records", category: "Financial", required: true, completed: false },
    ],
  };

  return [...baseDocuments, ...(additionalDocsByVisa[visaSubclass || ""] || [])];
};

const MatterDetail = () => {
  const { matterId } = useParams<{ matterId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [newDocName, setNewDocName] = useState("");
  
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
      
      // Initialize documents when matter loads
      if (data) {
        setDocuments(getDefaultDocuments(data.visa_subclass));
      }
      
      return data as Matter | null;
    },
    enabled: !!matterId,
  });

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["matter-client", matter?.client_id],
    queryFn: async () => {
      if (!matter?.client_id) return null;
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, client_type")
        .eq("id", matter.client_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!matter?.client_id,
  });

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
    onSuccess: () => {
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
    onSuccess: () => {
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
      if (!matterId) throw new Error("No matter ID");
      
      const { error } = await supabase
        .from("matters")
        .delete()
        .eq("id", matterId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      toast.success("Application deleted");
      navigate("/app/migration/matters");
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

  const handleToggleDocument = (docId: string) => {
    setDocuments(docs => 
      docs.map(doc => 
        doc.id === docId ? { ...doc, completed: !doc.completed } : doc
      )
    );
  };

  const handleAddDocument = () => {
    if (!newDocName.trim()) return;
    
    const newDoc: DocumentItem = {
      id: `custom-${Date.now()}`,
      name: newDocName.trim(),
      category: "Custom",
      required: false,
      completed: false,
    };
    
    setDocuments([...documents, newDoc]);
    setNewDocName("");
    toast.success("Document added to checklist");
  };

  const handleRemoveDocument = (docId: string) => {
    setDocuments(docs => docs.filter(doc => doc.id !== docId));
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

  const isLoading = isLoadingMatter || isLoadingClient;

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
            <Button variant="outline" onClick={() => navigate("/app/migration/matters")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Applications
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, DocumentItem[]>);

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/app/migration/matters")} className="gap-2">
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
                <p className="font-medium hover:text-primary transition-colors">{client?.full_name || "Unknown"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Drive Folder</p>
                <Badge variant={matter.drive_folder_id ? "success" : "secondary"}>
                  {matter.drive_folder_id ? "Linked" : "Pending"}
                </Badge>
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
            {/* Progress Bar */}
            <div className="card-gradient rounded-xl border border-border/50 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Overall Progress</h3>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <motion.div 
                  className="h-full gradient-bg"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {completedCount} of {documents.length} documents collected
              </p>
            </div>

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
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        doc.completed 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-secondary/50 border-border/50"
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={doc.completed}
                          onCheckedChange={() => handleToggleDocument(doc.id)}
                        />
                        <span className={doc.completed ? "line-through text-muted-foreground" : ""}>
                          {doc.name}
                        </span>
                        {doc.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      {!doc.required && doc.id.startsWith("custom-") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveDocument(doc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                <Button variant="outline" onClick={handleAddDocument} disabled={!newDocName.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
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
      </div>
    </AppLayout>
  );
};

export default MatterDetail;
