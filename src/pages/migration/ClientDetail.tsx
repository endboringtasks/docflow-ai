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
  Trash2,
  ExternalLink
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { getCountryFlag } from "@/lib/countryFlags";

interface Client {
  id: string;
  client_type: "personal" | "corporate";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  client_folder_id: string | null;
  folder_status: "pending" | "creating" | "created" | "failed";
  created_at: string;
}

interface VisaApplication {
  id: string;
  application_name: string;
  visa_subclass: string | null;
  country_id: string | null;
  category_id: string | null;
  status: "draft" | "active" | "done";
  visa_application_folder_id: string | null;
  created_at: string;
}

interface ApplicationCategory {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  country_id: string | null;
}

interface ApplicationType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  country_id: string | null;
  category_id: string | null;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  
  const [isCreateApplicationOpen, setIsCreateApplicationOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<VisaApplication | null>(null);
  
  const [newApplication, setNewApplication] = useState({
    countryId: "",
    categoryId: "",
    applicationName: "",
    visaSubclass: "",
    visaTypeId: "",
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
      
      // Query clients table directly to get folder_status
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!clientId,
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

  // Fetch application categories
  const { data: categories = [] } = useQuery({
    queryKey: ["application-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_categories")
        .select("id, name, code, description, icon, country_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as ApplicationCategory[];
    },
  });

  // Fetch application types (visa_types)
  const { data: applicationTypes = [] } = useQuery({
    queryKey: ["application-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visa_types")
        .select("id, name, code, description, country_id, category_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as ApplicationType[];
    },
  });

  // Filter categories by selected country
  const filteredCategories = newApplication.countryId
    ? categories.filter(cat => cat.country_id === newApplication.countryId)
    : [];

  // Filter application types by selected country and category
  const filteredApplicationTypes = newApplication.countryId && newApplication.categoryId
    ? applicationTypes.filter(type => 
        type.country_id === newApplication.countryId && 
        type.category_id === newApplication.categoryId
      )
    : [];

  // Fetch visa applications for this client
  const { data: visaApplications = [], isLoading: isLoadingApplications } = useQuery({
    queryKey: ["client-visa-applications", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("visa_applications")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as VisaApplication[];
    },
    enabled: !!clientId,
  });

  // Create visa application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async (applicationData: {
      application_name: string;
      visa_subclass: string;
      country_id: string;
      category_id: string;
      visa_type_id?: string;
    }) => {
      if (!currentCompany?.id || !clientId) throw new Error("Missing required data");
      
      const { data, error } = await supabase
        .from("visa_applications")
        .insert({
          company_id: currentCompany.id,
          client_id: clientId,
          application_name: applicationData.application_name,
          visa_subclass: applicationData.visa_subclass || null,
          country_id: applicationData.country_id,
          category_id: applicationData.category_id,
          status: "draft",
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, visa_type_id: applicationData.visa_type_id };
    },
    onSuccess: async (data) => {
      // Copy document templates to document_checklist based on linked application types
      try {
        if (data.visa_type_id && currentCompany?.id) {
          // Fetch template IDs linked to this application type via junction table
          const { data: linkedTemplates } = await supabase
            .from("document_template_applications")
            .select("document_template_id")
            .eq("visa_type_id", data.visa_type_id);

          const templateIds = linkedTemplates?.map(t => t.document_template_id) || [];

          if (templateIds.length > 0) {
            const { data: templates } = await supabase
              .from("document_checklist_templates")
              .select("document_name, category, is_required, sort_order")
              .in("id", templateIds)
              .order("sort_order");

            if (templates && templates.length > 0) {
              const documentsToInsert = templates.map((template) => ({
                visa_application_id: data.id,
                company_id: currentCompany.id,
                document_name: `[${template.category}:${template.is_required ? 'required' : 'optional'}] ${template.document_name}`,
                is_completed: false,
                is_standard_for_client: true, // All linked templates are standard for client
              }));

              await supabase.from("document_checklist").insert(documentsToInsert);
            }
          }
        }
      } catch (templateError) {
        console.error("Failed to copy document templates:", templateError);
      }

      // Dispatch webhook for visa_application.created event
      try {
        // Get drive connection info
        const { data: driveConnection } = await supabase
          .from("google_drive_connections")
          .select("root_folder_id")
          .eq("company_id", currentCompany?.id)
          .single();

        // Get client name for folder naming
        const clientName = client?.client_type === "corporate"
          ? client?.company_name
          : `${client?.first_name || ""} ${client?.last_name || ""}`.trim();

        await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "visa_application.created",
            data: {
              // Essential fields (always sent)
              visa_application_id: data.id,
              application_name: data.application_name,
              visa_subclass: data.visa_subclass,
              client_folder_id: client?.client_folder_id || null,
              // Optional fields (filtered by edge function based on webhook config)
              company_id: currentCompany?.id,
              client_id: data.client_id,
              status: data.status,
              root_folder_id: driveConnection?.root_folder_id || null,
              created_at: data.created_at,
            },
          },
        });
      } catch (webhookError) {
        console.error("Failed to dispatch webhook:", webhookError);
      }

      queryClient.invalidateQueries({ queryKey: ["client-visa-applications", clientId] });
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsCreateApplicationOpen(false);
      setNewApplication({ countryId: "", categoryId: "", applicationName: "", visaSubclass: "", visaTypeId: "" });
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

  // Delete visa application mutation
  const deleteApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      // Get application data before deletion for webhook
      const { data: applicationData } = await supabase
        .from("visa_applications")
        .select("id, company_id, client_id, application_name, visa_subclass, status, visa_application_folder_id")
        .eq("id", applicationId)
        .single();
      
      const { error } = await supabase
        .from("visa_applications")
        .delete()
        .eq("id", applicationId);
      
      if (error) throw error;
      return applicationData;
    },
    onSuccess: async (applicationData) => {
      // Dispatch webhook for visa_application.deleted event
      if (applicationData) {
        try {
          const { error: invokeError } = await supabase.functions.invoke("dispatch-webhook", {
            body: {
              event_type: "visa_application.deleted",
              data: {
                visa_application_id: applicationData.id,
                company_id: applicationData.company_id,
                client_id: applicationData.client_id,
                application_name: applicationData.application_name,
                visa_subclass: applicationData.visa_subclass,
                status: applicationData.status,
                visa_application_folder_id: applicationData.visa_application_folder_id,
              },
            },
          });

          if (invokeError) throw invokeError;
        } catch (webhookError) {
          console.error("Failed to dispatch webhook:", webhookError);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["client-visa-applications", clientId] });
      queryClient.invalidateQueries({ queryKey: ["visa-applications", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setApplicationToDelete(null);
      toast.success("Application deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      });
    },
  });

  const handleCreateApplication = () => {
    if (!newApplication.countryId || !newApplication.categoryId || !newApplication.applicationName.trim()) return;
    
    createApplicationMutation.mutate({
      application_name: newApplication.applicationName.trim(),
      visa_subclass: newApplication.visaSubclass,
      country_id: newApplication.countryId,
      category_id: newApplication.categoryId,
      visa_type_id: newApplication.visaTypeId || undefined,
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

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.name || null;
  };

  const getCategoryBadgeColor = (code: string | null) => {
    if (!code) return "secondary";
    switch (code) {
      case "visa": return "default";
      case "skill_assessment": return "outline";
      case "sponsorship": return "secondary";
      case "police_check": return "outline";
      case "citizenship": return "default";
      default: return "secondary";
    }
  };

  const isLoading = isLoadingClient || isLoadingApplications;

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
                {client.folder_status === 'created' && client.client_folder_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a 
                          href={`https://drive.google.com/drive/folders/${client.client_folder_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          Open Folder
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open client folder in Google Drive</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : client.folder_status === 'creating' ? (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Creating...
                  </span>
                ) : client.folder_status === 'failed' ? (
                  <span className="text-sm text-destructive">Failed to create</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Pending</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Applications Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Applications</h2>
            <Button onClick={() => setIsCreateApplicationOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
          </div>

          {visaApplications.length === 0 ? (
            <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Applications</h3>
              <p className="text-muted-foreground mb-4">
                Create the first application for this client.
              </p>
              <Button onClick={() => setIsCreateApplicationOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Application
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {visaApplications.map((application, index) => (
                <motion.div
                  key={application.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card-gradient rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/app/migration/applications/${application.id}`)}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        {application.country_id && countries.find(c => c.id === application.country_id) && (
                          <span className="text-lg" title={countries.find(c => c.id === application.country_id)?.name}>
                            {getCountryFlag(countries.find(c => c.id === application.country_id)?.code || '')}
                          </span>
                        )}
                        {application.category_id && (
                          <Badge variant={getCategoryBadgeColor(categories.find(c => c.id === application.category_id)?.code || null)}>
                            {getCategoryName(application.category_id)}
                          </Badge>
                        )}
                        <h3 className="font-semibold">{application.application_name}</h3>
                        <Badge variant={getStatusColor(application.status)}>
                          {application.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {application.visa_subclass ? `${application.visa_subclass}` : "No code"} • 
                        Created {formatDate(application.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {application.visa_application_folder_id && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`https://drive.google.com/drive/folders/${application.visa_application_folder_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                              >
                                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Open folder in Google Drive</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
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
      </div>

      {/* Create Application Dialog */}
      <Dialog open={isCreateApplicationOpen} onOpenChange={setIsCreateApplicationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Application</DialogTitle>
            <DialogDescription>
              Create a new application for {getFullName(client)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={newApplication.countryId}
                onValueChange={(value) => setNewApplication(prev => ({ 
                  ...prev, 
                  countryId: value, 
                  categoryId: "",
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
              <Label htmlFor="category">Application Category</Label>
              <Select
                value={newApplication.categoryId}
                onValueChange={(value) => setNewApplication(prev => ({ 
                  ...prev, 
                  categoryId: value,
                  applicationName: "",
                  visaSubclass: ""
                }))}
                disabled={!newApplication.countryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={newApplication.countryId ? "Select category" : "Select a country first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="applicationName">Application Type</Label>
              {filteredApplicationTypes.length > 0 ? (
                <Select
                  value={newApplication.applicationName}
                  onValueChange={(value) => {
                    const selectedType = filteredApplicationTypes.find(t => t.name === value);
                    setNewApplication(prev => ({ 
                      ...prev, 
                      applicationName: value,
                      visaSubclass: selectedType?.code || "",
                      visaTypeId: selectedType?.id || ""
                    }));
                  }}
                  disabled={!newApplication.categoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={newApplication.categoryId ? "Select application type" : "Select a category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredApplicationTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={newApplication.categoryId ? "Enter application name" : "Select a category first"}
                  value={newApplication.applicationName}
                  onChange={(e) => setNewApplication(prev => ({ ...prev, applicationName: e.target.value }))}
                  disabled={!newApplication.categoryId}
                />
              )}
            </div>
            {filteredApplicationTypes.length === 0 && newApplication.categoryId && (
              <div className="space-y-2">
                <Label htmlFor="visaSubclass">Code/Subclass (Optional)</Label>
                <Input
                  placeholder="Enter code or subclass"
                  value={newApplication.visaSubclass}
                  onChange={(e) => setNewApplication(prev => ({ ...prev, visaSubclass: e.target.value }))}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateApplicationOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateApplication}
              disabled={!newApplication.countryId || !newApplication.categoryId || !newApplication.applicationName.trim() || createApplicationMutation.isPending}
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

      {/* Edit Client Dialog */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update the client's information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client Type</Label>
              <Select
                value={editForm.clientType}
                onValueChange={(value: "personal" | "corporate") => 
                  setEditForm(prev => ({ ...prev, clientType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.clientType === "personal" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="editCompanyName">Company Name</Label>
                <Input
                  id="editCompanyName"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input
                id="editPhone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditClientOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateClient}
              disabled={updateClientMutation.isPending}
            >
              {updateClientMutation.isPending ? (
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

      {/* Delete Application Confirmation */}
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
              onClick={() => applicationToDelete && deleteApplicationMutation.mutate(applicationToDelete.id)}
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

export default ClientDetail;