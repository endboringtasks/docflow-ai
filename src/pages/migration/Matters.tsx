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
  RotateCcw,
  ExternalLink
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useFolderStatusRealtime } from "@/hooks/useFolderStatusRealtime";
import { getCountryFlag } from "@/lib/countryFlags";

interface VisaApplication {
  id: string;
  client_id: string;
  client_name: string;
  application_name: string;
  visa_subclass: string | null;
  country_id: string | null;
  status: "draft" | "active" | "done";
  visa_application_folder_id: string | null;
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

const MigrationVisaApplications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "done">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<VisaApplication | null>(null);
  const [applicationToDelete, setApplicationToDelete] = useState<VisaApplication | null>(null);
  const [applicationToEdit, setApplicationToEdit] = useState<VisaApplication | null>(null);
  const [editForm, setEditForm] = useState({
    countryId: "",
    applicationName: "",
    visaSubclass: "",
  });
  const [newApplication, setNewApplication] = useState({
    clientId: "",
    countryId: "",
    applicationName: "",
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

  // Filter visa types by selected country
  const filteredVisaTypes = newApplication.countryId
    ? visaTypes.filter(type => type.country_id === newApplication.countryId)
    : [];

  // Filter visa types for edit form
  const editFilteredVisaTypes = editForm.countryId
    ? visaTypes.filter(type => type.country_id === editForm.countryId)
    : visaTypes;

  // Fetch visa applications with client names
  const { data: visaApplications = [], isLoading } = useQuery({
    queryKey: ["visa-applications", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("visa_applications")
        .select(`
          id,
          client_id,
          application_name,
          visa_subclass,
          country_id,
          status,
          visa_application_folder_id,
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
      
      return (data || []).map(application => {
        const clientData = application.clients as any;
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
          id: application.id,
          client_id: application.client_id,
          client_name: clientName,
          application_name: application.application_name,
          visa_subclass: application.visa_subclass,
          country_id: application.country_id,
          status: application.status as "draft" | "active" | "done",
          visa_application_folder_id: application.visa_application_folder_id,
          folder_status: application.folder_status,
          created_at: application.created_at,
        };
      }) as VisaApplication[];
    },
    enabled: !!currentCompany?.id,
  });

  // Smart real-time subscription - only active when there are pending/creating folders
  useFolderStatusRealtime(
    "visa_applications",
    currentCompany?.id,
    visaApplications,
    ["visa-applications", currentCompany?.id || ""]
  );

  // Create visa application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async (applicationData: {
      client_id: string;
      application_name: string;
      visa_subclass: string;
      country_id: string;
    }) => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      const { data, error } = await supabase
        .from("visa_applications")
        .insert({
          company_id: currentCompany.id,
          client_id: applicationData.client_id,
          application_name: applicationData.application_name,
          visa_subclass: applicationData.visa_subclass,
          country_id: applicationData.country_id,
          status: "draft",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Copy document templates to document_checklist
      try {
        if (data.visa_subclass && currentCompany?.id) {
          const { data: templates } = await supabase
            .from("document_checklist_templates")
            .select("document_name, category, is_required, sort_order")
            .eq("company_id", currentCompany.id)
            .eq("visa_subclass", data.visa_subclass)
            .order("sort_order");

          if (templates && templates.length > 0) {
            const documentsToInsert = templates.map((template) => ({
              visa_application_id: data.id,
              company_id: currentCompany.id,
              document_name: `[${template.category}:${template.is_required ? 'required' : 'optional'}] ${template.document_name}`,
              is_completed: false,
            }));

            await supabase.from("document_checklist").insert(documentsToInsert);
          }
        }
      } catch (templateError) {
        console.error("Failed to copy document templates:", templateError);
      }

      // Dispatch webhook for visa_application.created event
      try {
        // Get drive connection and client folder info
        const [driveConnectionResult, clientResult] = await Promise.all([
          supabase
            .from("google_drive_connections")
            .select("root_folder_id")
            .eq("company_id", currentCompany?.id)
            .single(),
          supabase
            .from("clients")
            .select("client_folder_id, first_name, last_name, company_name, client_type")
            .eq("id", data.client_id)
            .single(),
        ]);

        const clientName = clientResult.data?.client_type === "corporate"
          ? clientResult.data?.company_name
          : `${clientResult.data?.first_name || ""} ${clientResult.data?.last_name || ""}`.trim();

        await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "visa_application.created",
            data: {
              // Essential fields (always sent)
              visa_application_id: data.id,
              application_name: data.application_name,
              visa_subclass: data.visa_subclass,
              client_folder_id: clientResult.data?.client_folder_id || null,
              // Optional fields (filtered by edge function based on webhook config)
              company_id: currentCompany?.id,
              client_id: data.client_id,
              status: data.status,
              root_folder_id: driveConnectionResult.data?.root_folder_id || null,
              created_at: data.created_at,
            },
          },
        });
        console.log("Webhook dispatched for visa application:", data.id);
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }

      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsCreateOpen(false);
      setNewApplication({ clientId: "", countryId: "", applicationName: "", visaSubclass: "" });
      toast.success("Visa application created!", {
        description: "A webhook can be configured to create the application folder.",
      });
    },
    onError: (error) => {
      toast.error("Failed to create application", {
        description: error.message,
      });
    },
  });

  // Update application status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: "draft" | "active" | "done" }) => {
      const { data, error } = await supabase
        .from("visa_applications")
        .update({ status })
        .eq("id", applicationId)
        .select()
        .single();
      
      if (error) throw error;

      // Dispatch webhook for visa_application.updated event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "visa_application.updated",
            data: {
              visa_application_id: data.id,
              company_id: currentCompany?.id,
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
        console.warn("Failed to dispatch webhook:", webhookError);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["recent-applications", currentCompany?.id] });
      
      // Update selected application in state
      if (selectedApplication && selectedApplication.id === data.id) {
        setSelectedApplication({
          ...selectedApplication,
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

  // Delete application mutation
  const deleteApplicationMutation = useMutation({
    mutationFn: async (application: VisaApplication) => {
      const { error } = await supabase
        .from("visa_applications")
        .delete()
        .eq("id", application.id);
      
      if (error) throw error;

      // Dispatch webhook for visa_application.deleted event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "visa_application.deleted",
            data: {
              visa_application_id: application.id,
              company_id: currentCompany?.id,
              client_id: application.client_id,
              application_name: application.application_name,
              visa_subclass: application.visa_subclass,
              status: application.status,
              visa_application_folder_id: application.visa_application_folder_id,
            },
          },
        });

        if (invokeError) throw invokeError;
      } catch (webhookError) {
        console.warn("Failed to dispatch webhook:", webhookError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setApplicationToDelete(null);
      setSelectedApplication(null);
      toast.success("Application deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      });
    },
  });

  // Update application details mutation
  const updateApplicationMutation = useMutation({
    mutationFn: async (applicationData: {
      id: string;
      application_name: string;
      visa_subclass: string | null;
      country_id: string | null;
    }) => {
      const { data, error } = await supabase
        .from("visa_applications")
        .update({
          application_name: applicationData.application_name,
          visa_subclass: applicationData.visa_subclass,
          country_id: applicationData.country_id,
        })
        .eq("id", applicationData.id)
        .select()
        .single();
      
      if (error) throw error;

      // Dispatch webhook for visa_application.updated event
      try {
        const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "visa_application.updated",
            data: {
              visa_application_id: data.id,
              company_id: currentCompany?.id,
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
        console.warn("Failed to dispatch webhook:", webhookError);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      setApplicationToEdit(null);
      
      // Update selected application if it's the one being edited
      if (selectedApplication && selectedApplication.id === data.id) {
        setSelectedApplication({
          ...selectedApplication,
          application_name: data.application_name,
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
    mutationFn: async (application: VisaApplication) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      // Set folder_status back to 'creating' with timestamp
      const { error: updateError } = await supabase
        .from("visa_applications")
        .update({ 
          folder_status: "creating",
          folder_status_updated_at: new Date().toISOString()
        })
        .eq("id", application.id);

      if (updateError) throw updateError;

      // Fetch client to get drive_folder_id
      const { data: clientData } = await supabase
        .from("clients")
        .select("client_folder_id, first_name, last_name, company_name, client_type")
        .eq("id", application.client_id)
        .single();

      // Dispatch webhook again
      await supabase.functions.invoke("dispatch-webhook", {
        body: {
          event_type: "visa_application.created",
          data: {
            visa_application_id: application.id,
            application_name: application.application_name,
            visa_subclass: application.visa_subclass,
            client_folder_id: clientData?.client_folder_id || null,
            company_id: currentCompany?.id,
            client_id: application.client_id,
            status: application.status,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      toast.success("Folder creation retried");
    },
    onError: (error) => {
      toast.error("Failed to retry folder creation", {
        description: error.message,
      });
    },
  });

  const filteredApplications = visaApplications.filter(app => {
    const matchesSearch = 
      app.application_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.visa_subclass && app.visa_subclass.includes(searchQuery));
    
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateApplication = () => {
    if (!newApplication.clientId || !newApplication.countryId || !newApplication.applicationName.trim() || !newApplication.visaSubclass) return;
    
    createApplicationMutation.mutate({
      client_id: newApplication.clientId,
      application_name: newApplication.applicationName.trim(),
      visa_subclass: newApplication.visaSubclass,
      country_id: newApplication.countryId,
    });
  };

  const handleEditApplication = (application: VisaApplication) => {
    setEditForm({
      countryId: application.country_id || "",
      applicationName: application.application_name,
      visaSubclass: application.visa_subclass || "",
    });
    setApplicationToEdit(application);
  };

  const handleUpdateApplication = () => {
    if (!applicationToEdit || !editForm.applicationName.trim()) return;
    
    updateApplicationMutation.mutate({
      id: applicationToEdit.id,
      application_name: editForm.applicationName.trim(),
      visa_subclass: editForm.visaSubclass || null,
      country_id: editForm.countryId || null,
    });
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

  const getClientName = (client: Client) => {
    if (client.client_type === "corporate") {
      return client.company_name || "Unnamed Company";
    }
    return client.last_name 
      ? `${client.first_name} ${client.last_name}` 
      : (client.first_name || "Unnamed Client");
  };

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Visa Applications</h1>
            <p className="text-muted-foreground">Manage visa applications for your clients</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Application
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Visa Application</DialogTitle>
                <DialogDescription>
                  Add a new visa application for a client.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={newApplication.clientId}
                    onValueChange={(value) => setNewApplication(prev => ({ ...prev, clientId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {getClientName(client)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={newApplication.countryId}
                    onValueChange={(value) => setNewApplication(prev => ({ 
                      ...prev, 
                      countryId: value, 
                      applicationName: "", 
                      visaSubclass: "" 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{getCountryFlag(country.code)}</span>
                            {country.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationName">Application Name</Label>
                  <Select
                    value={newApplication.applicationName}
                    onValueChange={(value) => setNewApplication(prev => ({ ...prev, applicationName: value }))}
                    disabled={!newApplication.countryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={newApplication.countryId ? "Select application type" : "Select a country first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredVisaTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visaSubclass">Visa Subclass</Label>
                  <Select
                    value={newApplication.visaSubclass}
                    onValueChange={(value) => setNewApplication(prev => ({ ...prev, visaSubclass: value }))}
                    disabled={!newApplication.countryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={newApplication.countryId ? "Select visa subclass" : "Select a country first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredVisaTypes.map((type) => (
                        <SelectItem key={type.id} value={type.code}>
                          {type.code} - {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateApplication}
                  disabled={!newApplication.clientId || !newApplication.countryId || !newApplication.applicationName.trim() || !newApplication.visaSubclass || createApplicationMutation.isPending}
                >
                  {createApplicationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search applications..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Applications List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || statusFilter !== "all" ? "No applications found" : "No applications yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all" 
                ? "Try adjusting your search or filters"
                : "Create your first visa application to get started"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Application
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredApplications.map((application, index) => (
              <motion.div
                key={application.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card-gradient rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/app/migration/visa-applications/${application.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold truncate">{application.application_name}</h3>
                      <Badge variant={getStatusColor(application.status)}>
                        {application.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span className="truncate">{application.client_name}</span>
                      <span>•</span>
                      <span>{application.visa_subclass ? `Subclass ${application.visa_subclass}` : "No subclass"}</span>
                      <span>•</span>
                      <span>{formatDate(application.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    {/* Folder Status Indicator */}
                    {application.folder_status === "created" && application.visa_application_folder_id ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`https://drive.google.com/drive/folders/${application.visa_application_folder_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                              <FolderOpen className="w-4 h-4 text-green-500" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Open folder in Google Drive</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : application.folder_status === "creating" ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-2">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Creating folder...</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : application.folder_status === "failed" ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => retryFolderMutation.mutate(application)}
                              disabled={retryFolderMutation.isPending}
                            >
                              <RotateCcw className="w-4 h-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Folder creation failed. Click to retry.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditApplication(application)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setApplicationToDelete(application)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Application Dialog */}
      <Dialog open={!!applicationToEdit} onOpenChange={() => setApplicationToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Application</DialogTitle>
            <DialogDescription>
              Update the application details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCountry">Country</Label>
              <Select
                value={editForm.countryId}
                onValueChange={(value) => setEditForm(prev => ({ 
                  ...prev, 
                  countryId: value,
                  applicationName: "",
                  visaSubclass: ""
                }))}
              >
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
            <div className="space-y-2">
              <Label htmlFor="editApplicationName">Application Name</Label>
              <Select
                value={editForm.applicationName}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, applicationName: value }))}
                disabled={!editForm.countryId}
              >
                <SelectTrigger>
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
              <Label htmlFor="editVisaSubclass">Visa Subclass</Label>
              <Select
                value={editForm.visaSubclass}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, visaSubclass: value }))}
                disabled={!editForm.countryId}
              >
                <SelectTrigger>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApplicationToEdit(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateApplication}
              disabled={!editForm.applicationName.trim() || updateApplicationMutation.isPending}
            >
              {updateApplicationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!applicationToDelete} onOpenChange={() => setApplicationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{applicationToDelete?.application_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => applicationToDelete && deleteApplicationMutation.mutate(applicationToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteApplicationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default MigrationVisaApplications;
