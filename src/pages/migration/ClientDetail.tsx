import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft,
  Plus, 
  User,
  Building2,
  Mail,
  Phone,
  FolderOpen,
  Loader2,
  FileText,
  Pencil,
  Trash2
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
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface Client {
  id: string;
  client_type: "personal" | "corporate";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  drive_folder_id: string | null;
  created_at: string;
}

interface Matter {
  id: string;
  matter_name: string;
  visa_subclass: string | null;
  status: "draft" | "active" | "done";
  drive_folder_id: string | null;
  created_at: string;
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

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  
  const [isCreateMatterOpen, setIsCreateMatterOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [matterToDelete, setMatterToDelete] = useState<Matter | null>(null);
  
  const [newMatter, setNewMatter] = useState({
    matterName: "",
    visaSubclass: "",
  });
  
  const [editForm, setEditForm] = useState({
    clientType: "personal" as "personal" | "corporate",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
  });

  const getFullName = (client: Client) => {
    if (client.client_type === "corporate") {
      return client.company_name || "Unnamed Company";
    }
    return client.last_name ? `${client.first_name} ${client.last_name}` : (client.first_name || "Unnamed Client");
  };

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      // Use secure RPC function that masks PII for non-admins
      const { data, error } = await supabase
        .rpc("get_client_by_id", { p_client_id: clientId });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] as Client : null;
    },
    enabled: !!clientId,
  });

  // Fetch matters for this client
  const { data: matters = [], isLoading: isLoadingMatters } = useQuery({
    queryKey: ["client-matters", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("matters")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Matter[];
    },
    enabled: !!clientId,
  });

  // Create matter mutation
  const createMatterMutation = useMutation({
    mutationFn: async (matterData: {
      matter_name: string;
      visa_subclass: string;
    }) => {
      if (!currentCompany?.id || !clientId) throw new Error("Missing required data");
      
      const { data, error } = await supabase
        .from("matters")
        .insert({
          company_id: currentCompany.id,
          client_id: clientId,
          matter_name: matterData.matter_name,
          visa_subclass: matterData.visa_subclass,
          status: "draft",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-matters", clientId] });
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsCreateMatterOpen(false);
      setNewMatter({ matterName: "", visaSubclass: "" });
      toast.success("Application created!");
    },
    onError: (error) => {
      toast.error("Failed to create application", {
        description: error.message,
      });
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async (clientData: {
      client_type: "personal" | "corporate";
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      email: string | null;
      phone: string | null;
    }) => {
      if (!clientId) throw new Error("No client ID");
      
      const { data, error } = await supabase
        .from("clients")
        .update({
          client_type: clientData.client_type,
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          company_name: clientData.company_name,
          email: clientData.email,
          phone: clientData.phone,
        })
        .eq("id", clientId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsEditClientOpen(false);
      toast.success("Client updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update client", {
        description: error.message,
      });
    },
  });

  // Delete matter mutation
  const deleteMatterMutation = useMutation({
    mutationFn: async (matterId: string) => {
      const { error } = await supabase
        .from("matters")
        .delete()
        .eq("id", matterId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-matters", clientId] });
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setMatterToDelete(null);
      toast.success("Application deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      });
    },
  });

  const handleCreateMatter = () => {
    if (!newMatter.matterName.trim() || !newMatter.visaSubclass) return;
    
    createMatterMutation.mutate({
      matter_name: newMatter.matterName.trim(),
      visa_subclass: newMatter.visaSubclass,
    });
  };

  const handleEditClient = () => {
    if (!client) return;
    setEditForm({
      clientType: client.client_type,
      firstName: client.first_name || "",
      lastName: client.last_name || "",
      companyName: client.company_name || "",
      email: client.email || "",
      phone: client.phone || "",
    });
    setIsEditClientOpen(true);
  };

  const handleUpdateClient = () => {
    const isCorporate = editForm.clientType === "corporate";
    const hasRequiredField = isCorporate ? editForm.companyName.trim() : editForm.firstName.trim();
    if (!hasRequiredField) return;
    
    updateClientMutation.mutate({
      client_type: editForm.clientType,
      first_name: isCorporate ? null : editForm.firstName.trim(),
      last_name: isCorporate ? null : (editForm.lastName.trim() || null),
      company_name: isCorporate ? editForm.companyName.trim() : null,
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
    });
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

  const isLoading = isLoadingClient || isLoadingMatters;

  if (isLoading) {
    return (
      <AppLayout niche="migration">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout niche="migration">
        <div className="p-6 lg:p-8">
          <div className="text-center py-12">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Client not found</h2>
            <p className="text-muted-foreground mb-4">The client you're looking for doesn't exist.</p>
            <Button variant="outline" onClick={() => navigate("/app/migration/clients")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Clients
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
        <Button variant="ghost" onClick={() => navigate("/app/migration/clients")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Button>

        {/* Client Header */}
        <div className="card-gradient rounded-xl border border-border/50 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                client.client_type === "corporate" ? "bg-accent/20" : "bg-primary/20"
              }`}>
                {client.client_type === "corporate" 
                  ? <Building2 className="w-8 h-8 text-accent" />
                  : <User className="w-8 h-8 text-primary" />
                }
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{getFullName(client)}</h1>
                  <Badge variant={client.client_type === "corporate" ? "secondary" : "outline"}>
                    {client.client_type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Added {formatDate(client.created_at)}</p>
              </div>
            </div>
            
            <Button variant="outline" onClick={handleEditClient}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit Client
            </Button>
          </div>

          {/* Contact Info */}
          <div className="grid sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/50">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{client.email || "Not provided"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{client.phone || "Not provided"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Drive Folder</p>
                <Badge variant={client.drive_folder_id ? "success" : "secondary"}>
                  {client.drive_folder_id ? "Linked" : "Pending"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Matters Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Visa Applications</h2>
            <p className="text-sm text-muted-foreground">{matters.length} application(s)</p>
          </div>
          <Button variant="gradient" onClick={() => setIsCreateMatterOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Button>
        </div>

        {/* Matters Grid */}
        {matters.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matters.map((matter, index) => (
              <motion.div
                key={matter.id}
                className="card-gradient rounded-xl border border-border/50 p-6 hover:border-primary/50 transition-all"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <Badge variant={getStatusColor(matter.status)}>
                    {matter.status}
                  </Badge>
                </div>
                
                <h3 className="font-semibold mb-1 line-clamp-1">{matter.matter_name}</h3>
                {matter.visa_subclass && (
                  <p className="text-sm text-primary mb-2">Subclass {matter.visa_subclass}</p>
                )}

                <p className="text-xs text-muted-foreground mb-4">
                  Created {formatDate(matter.created_at)}
                </p>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/app/migration/matters/${matter.id}`)}
                  >
                    View Details
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setMatterToDelete(matter)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card-gradient rounded-xl border border-border/50 p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No applications yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a visa application for this client
            </p>
            <Button variant="gradient" onClick={() => setIsCreateMatterOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
          </div>
        )}

        {/* Create Matter Dialog */}
        <Dialog open={isCreateMatterOpen} onOpenChange={setIsCreateMatterOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Application</DialogTitle>
              <DialogDescription>
                Start a new visa application for {getFullName(client)}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Application Name</Label>
                <Input
                  value={newMatter.matterName}
                  onChange={(e) => setNewMatter({...newMatter, matterName: e.target.value})}
                  placeholder="e.g., Skilled Worker Application"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label>Visa Subclass</Label>
                <Select 
                  value={newMatter.visaSubclass} 
                  onValueChange={(value) => setNewMatter({...newMatter, visaSubclass: value})}
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
              <Button variant="outline" className="flex-1" onClick={() => setIsCreateMatterOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="gradient" 
                className="flex-1" 
                onClick={handleCreateMatter} 
                disabled={!newMatter.matterName.trim() || !newMatter.visaSubclass || createMatterMutation.isPending}
              >
                {createMatterMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Application"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Client Dialog */}
        <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update client information.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client Type</Label>
                <Select 
                  value={editForm.clientType} 
                  onValueChange={(value: "personal" | "corporate") => setEditForm({...editForm, clientType: value})}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editForm.clientType === "corporate" ? (
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({...editForm, companyName: e.target.value})}
                    placeholder="Acme Corp Pty Ltd"
                    className="bg-secondary border-border"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                      placeholder="John"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                      placeholder="Smith"
                      className="bg-secondary border-border"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  placeholder="email@example.com"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  placeholder="+61 400 123 456"
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditClientOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="gradient" 
                className="flex-1" 
                onClick={handleUpdateClient} 
                disabled={(editForm.clientType === "corporate" ? !editForm.companyName.trim() : !editForm.firstName.trim()) || updateClientMutation.isPending}
              >
                {updateClientMutation.isPending ? (
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

        {/* Delete Matter Confirmation */}
        <AlertDialog open={!!matterToDelete} onOpenChange={() => setMatterToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Application</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{matterToDelete?.matter_name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => matterToDelete && deleteMatterMutation.mutate(matterToDelete.id)}
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

export default ClientDetail;
