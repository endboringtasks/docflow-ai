import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  FileText,
  CheckCircle,
  User,
  Loader2,
  Trash2,
  Pencil,
  FolderOpen,
  RotateCcw
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  client_name: string;
  matter_name: string;
  visa_subclass: string | null;
  status: "draft" | "active" | "done";
  drive_folder_id: string | null;
  folder_status: string;
  created_at: string;
}

interface Client {
  id: string;
  client_type: "personal" | "corporate";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
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

const MigrationMatters = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "done">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [matterToDelete, setMatterToDelete] = useState<Matter | null>(null);
  const [matterToEdit, setMatterToEdit] = useState<Matter | null>(null);
  const [editForm, setEditForm] = useState({
    matterName: "",
    visaSubclass: "",
  });
  const [newMatter, setNewMatter] = useState({
    clientId: "",
    matterName: "",
    visaSubclass: "",
  });

  // Fetch clients for the dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Use secure RPC function
      const { data, error } = await supabase
        .rpc("get_clients_secure", { p_company_id: currentCompany.id });
      
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch matters with client names
  const { data: matters = [], isLoading } = useQuery({
    queryKey: ["matters", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("matters")
        .select(`
          id,
          client_id,
          matter_name,
          visa_subclass,
          status,
          drive_folder_id,
          folder_status,
          created_at,
          clients (
            client_type,
            first_name,
            last_name,
            company_name
          )
        `)
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(matter => {
        const clientData = matter.clients as any;
        let clientName = "Unknown";
        if (clientData) {
          if (clientData.client_type === "corporate") {
            clientName = clientData.company_name || "Unnamed Company";
          } else {
            clientName = clientData.last_name 
              ? `${clientData.first_name} ${clientData.last_name}` 
              : (clientData.first_name || "Unnamed Client");
          }
        }
        return {
          id: matter.id,
          client_id: matter.client_id,
          client_name: clientName,
          matter_name: matter.matter_name,
          visa_subclass: matter.visa_subclass,
          status: matter.status as "draft" | "active" | "done",
          drive_folder_id: matter.drive_folder_id,
          folder_status: matter.folder_status,
          created_at: matter.created_at,
        };
      }) as Matter[];
    },
    enabled: !!currentCompany?.id,
  });

  // Subscribe to realtime updates for matters
  useEffect(() => {
    if (!currentCompany?.id) return;

    const channel = supabase
      .channel('matters-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matters',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        (payload) => {
          console.log('Matter updated:', payload);
          queryClient.invalidateQueries({ queryKey: ["matters", currentCompany.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matters',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["matters", currentCompany.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'matters',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["matters", currentCompany.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  // Create matter mutation
  const createMatterMutation = useMutation({
    mutationFn: async (matterData: {
      client_id: string;
      matter_name: string;
      visa_subclass: string;
    }) => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      const { data, error } = await supabase
        .from("matters")
        .insert({
          company_id: currentCompany.id,
          client_id: matterData.client_id,
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
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsCreateOpen(false);
      setNewMatter({ clientId: "", matterName: "", visaSubclass: "" });
      toast.success("Visa application created!", {
        description: "A webhook can be configured to create the matter folder.",
      });
    },
    onError: (error) => {
      toast.error("Failed to create application", {
        description: error.message,
      });
    },
  });

  // Update matter status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ matterId, status }: { matterId: string; status: "draft" | "active" | "done" }) => {
      const { data, error } = await supabase
        .from("matters")
        .update({ status })
        .eq("id", matterId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["recent-matters", currentCompany?.id] });
      
      // Update selected matter in state
      if (selectedMatter && selectedMatter.id === data.id) {
        setSelectedMatter({
          ...selectedMatter,
          status: data.status as "draft" | "active" | "done",
        });
      }
      
      toast.success("Status updated!", {
        description: `Application status changed to ${data.status}`,
      });
    },
    onError: (error) => {
      toast.error("Failed to update status", {
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
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setMatterToDelete(null);
      setSelectedMatter(null);
      toast.success("Application deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      });
    },
  });

  // Update matter details mutation
  const updateMatterMutation = useMutation({
    mutationFn: async (matterData: {
      id: string;
      matter_name: string;
      visa_subclass: string | null;
    }) => {
      const { data, error } = await supabase
        .from("matters")
        .update({
          matter_name: matterData.matter_name,
          visa_subclass: matterData.visa_subclass,
        })
        .eq("id", matterData.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      setMatterToEdit(null);
      
      // Update selected matter if it's the one being edited
      if (selectedMatter && selectedMatter.id === data.id) {
        setSelectedMatter({
          ...selectedMatter,
          matter_name: data.matter_name,
          visa_subclass: data.visa_subclass,
        });
      }
      
      toast.success("Application updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update application", {
        description: error.message,
      });
    },
  });

  // Retry folder creation mutation
  const retryFolderMutation = useMutation({
    mutationFn: async (matter: Matter) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      // Set folder_status back to 'creating'
      const { error: updateError } = await supabase
        .from("matters")
        .update({ folder_status: "creating" })
        .eq("id", matter.id);

      if (updateError) throw updateError;

      // Fetch client to get drive_folder_id
      const { data: clientData } = await supabase
        .rpc("get_client_by_id", { p_client_id: matter.client_id });
      
      const client = clientData?.[0];

      // Fetch company's Google Drive connection to get root folder ID
      let rootFolderId: string | null = null;
      try {
        const { data: driveConnection } = await supabase
          .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });
        rootFolderId = driveConnection?.[0]?.root_folder_id ?? null;
      } catch (e) {
        console.warn("Could not fetch drive connection:", e);
      }

      // Dispatch webhook for matter.created event
      const { error: webhookError } = await supabase.functions.invoke("dispatch-webhook", {
        body: {
          event_type: "matter.created",
          data: {
            matter_id: matter.id,
            company_id: currentCompany.id,
            client_id: matter.client_id,
            matter_name: matter.matter_name,
            visa_subclass: matter.visa_subclass,
            status: matter.status,
            client_folder_id: client?.drive_folder_id || null,
            root_folder_id: rootFolderId,
            created_at: matter.created_at,
          },
        },
      });

      if (webhookError) throw webhookError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matters", currentCompany?.id] });
      toast.success("Folder creation retry initiated");
    },
    onError: (error) => {
      toast.error("Failed to retry folder creation", {
        description: error.message,
      });
    },
  });

  const filteredMatters = matters.filter(matter => {
    const matchesSearch = matter.matter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matter.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matter.visa_subclass?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || matter.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateMatter = () => {
    if (!newMatter.clientId || !newMatter.matterName.trim() || !newMatter.visaSubclass) return;
    
    createMatterMutation.mutate({
      client_id: newMatter.clientId,
      matter_name: newMatter.matterName.trim(),
      visa_subclass: newMatter.visaSubclass,
    });
  };

  const handleStatusChange = (matterId: string, newStatus: "draft" | "active" | "done") => {
    updateStatusMutation.mutate({ matterId, status: newStatus });
  };

  const handleEditMatter = (matter: Matter) => {
    setEditForm({
      matterName: matter.matter_name,
      visaSubclass: matter.visa_subclass || "",
    });
    setMatterToEdit(matter);
  };

  const handleUpdateMatter = () => {
    if (!matterToEdit || !editForm.matterName.trim()) return;
    
    updateMatterMutation.mutate({
      id: matterToEdit.id,
      matter_name: editForm.matterName.trim(),
      visa_subclass: editForm.visaSubclass || null,
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

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Visa Applications</h1>
            <p className="text-muted-foreground">Manage visa applications and track their progress</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" disabled={clients.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                New Application
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Visa Application</DialogTitle>
                <DialogDescription>
                  Start a new visa application for an existing client. A folder structure can be created in Google Drive via webhook.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Client</Label>
                  <Select 
                    value={newMatter.clientId} 
                    onValueChange={(value) => setNewMatter({...newMatter, clientId: value})}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_type === "corporate" 
                            ? (client.company_name || "Unnamed Company")
                            : (client.last_name ? `${client.first_name} ${client.last_name}` : (client.first_name || "Unnamed Client"))
                          }
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="gradient" 
                  className="flex-1" 
                  onClick={handleCreateMatter} 
                  disabled={!newMatter.clientId || !newMatter.matterName.trim() || !newMatter.visaSubclass || createMatterMutation.isPending}
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
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "draft", "active", "done"] as const).map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Matters Table */}
        {!isLoading && (
          <div className="card-gradient rounded-xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Application</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Visa</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Drive Folder</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredMatters.map((matter, index) => (
                    <motion.tr 
                      key={matter.id}
                      className="hover:bg-secondary/30 transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td 
                        className="p-4 cursor-pointer"
                        onClick={() => navigate(`/app/migration/matters/${matter.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="font-medium hover:text-primary transition-colors">{matter.matter_name}</p>
                            <p className="text-sm text-muted-foreground">Created {formatDate(matter.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-4 h-4" />
                          {matter.client_name}
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        {matter.visa_subclass ? (
                          <Badge variant="outline">Subclass {matter.visa_subclass}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusColor(matter.status)}>
                          {matter.status}
                        </Badge>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        {matter.folder_status === "created" && matter.drive_folder_id ? (
                          <a
                            href={`https://drive.google.com/drive/folders/${matter.drive_folder_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Badge variant="success" className="gap-1 cursor-pointer hover:opacity-80 transition-opacity">
                              <FolderOpen className="w-3 h-3" />
                              Created
                            </Badge>
                          </a>
                        ) : matter.folder_status === "creating" ? (
                          <Badge variant="outline" className="gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Creating
                          </Badge>
                        ) : matter.folder_status === "failed" ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">Failed</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                retryFolderMutation.mutate(matter);
                              }}
                              disabled={retryFolderMutation.isPending}
                            >
                              {retryFolderMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditMatter(matter)}
                          >
                            <Pencil className="w-4 h-4" />
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
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredMatters.length === 0 && (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No applications found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try different filters" 
                    : clients.length === 0 
                      ? "Add a client first before creating applications"
                      : "Create your first visa application"
                  }
                </p>
                {!searchQuery && statusFilter === "all" && clients.length > 0 && (
                  <Button variant="gradient" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Application
                  </Button>
                )}
              </div>
            )}
          </div>
        )}


        {/* Matter Detail Dialog */}
        <Dialog open={!!selectedMatter} onOpenChange={() => setSelectedMatter(null)}>
          <DialogContent className="sm:max-w-2xl">
            {selectedMatter && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={getStatusColor(selectedMatter.status)}>
                      {selectedMatter.status}
                    </Badge>
                    {selectedMatter.visa_subclass && (
                      <Badge variant="outline">Subclass {selectedMatter.visa_subclass}</Badge>
                    )}
                  </div>
                  <DialogTitle className="text-2xl">{selectedMatter.matter_name}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedMatter.client_name}
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="overview" className="mt-6">
                  <TabsList className="grid w-full grid-cols-3 bg-secondary">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="validation">Validation</TabsTrigger>
                    <TabsTrigger value="forms">Forms</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="mt-6 space-y-6">
                    {/* Status Update Section */}
                    <div className="glass rounded-lg p-4">
                      <Label className="text-sm text-muted-foreground mb-3 block">Update Status</Label>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant={selectedMatter.status === option.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleStatusChange(selectedMatter.id, option.value as "draft" | "active" | "done")}
                            disabled={updateStatusMutation.isPending}
                            className="gap-2"
                          >
                            {updateStatusMutation.isPending && updateStatusMutation.variables?.matterId === selectedMatter.id && updateStatusMutation.variables?.status === option.value ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            {option.label}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {statusOptions.find(o => o.value === selectedMatter.status)?.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Created</p>
                        <p className="font-medium">{formatDate(selectedMatter.created_at)}</p>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Visa Subclass</p>
                        <p className="font-medium">{selectedMatter.visa_subclass || "N/A"}</p>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Drive Folder</p>
                        <p className="font-medium">{selectedMatter.drive_folder_id ? "Linked" : "Pending"}</p>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Actions</p>
                        <div className="flex gap-2 mt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditMatter(selectedMatter)}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setMatterToDelete(selectedMatter)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="validation" className="mt-6">
                    <div className="glass rounded-lg p-8 text-center">
                      <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">Document Validation</h3>
                      <p className="text-sm text-muted-foreground">
                        Validation status is synced from external automation events.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="forms" className="mt-6">
                    <div className="glass rounded-lg p-8 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <Badge variant="secondary" className="mb-4">Coming Soon</Badge>
                      <h3 className="font-semibold mb-2">Online Forms</h3>
                      <p className="text-sm text-muted-foreground">
                        Send forms to clients for document collection and information gathering.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
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

        {/* Edit Matter Dialog */}
        <Dialog open={!!matterToEdit} onOpenChange={() => setMatterToEdit(null)}>
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
              <Button variant="outline" className="flex-1" onClick={() => setMatterToEdit(null)}>
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
      </div>
    </AppLayout>
  );
};

export default MigrationMatters;
