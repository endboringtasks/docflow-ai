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
  category_id: string | null;
  subcategory_id: string | null;
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

interface ApplicationCategory {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  country_id: string | null;
}

interface ApplicationSubcategory {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category_id: string;
  country_id: string | null;
}

interface ApplicationType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  country_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

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
    categoryId: "",
    subcategoryId: "",
    applicationName: "",
    visaSubclass: "",
  });
  const [newApplication, setNewApplication] = useState({
    clientId: "",
    countryId: "",
    categoryId: "",
    subcategoryId: "",
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

  // Fetch application subcategories
  const { data: subcategories = [] } = useQuery({
    queryKey: ["application-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_subcategories")
        .select("id, name, code, description, category_id, country_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as ApplicationSubcategory[];
    },
  });

  // Fetch application types (visa_types)
  const { data: applicationTypes = [] } = useQuery({
    queryKey: ["application-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visa_types")
        .select("id, name, code, description, country_id, category_id, subcategory_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as ApplicationType[];
    },
  });

  // Filter categories by selected country
  const filteredCategories = newApplication.countryId
    ? newApplication.countryId === "__all__"
      ? categories.filter(cat => cat.country_id === null)
      : categories.filter(cat => cat.country_id === newApplication.countryId)
    : [];

  // Filter subcategories by selected country and category
  const filteredSubcategories = newApplication.countryId && newApplication.categoryId
    ? subcategories.filter(sub => 
        (newApplication.countryId === "__all__" ? sub.country_id === null : sub.country_id === newApplication.countryId) && 
        sub.category_id === newApplication.categoryId
      )
    : [];

  // Filter application types by selected country, category, and optionally subcategory
  const filteredApplicationTypes = newApplication.countryId && newApplication.categoryId
    ? applicationTypes.filter(type => {
        const matchesCountry = newApplication.countryId === "__all__" ? type.country_id === null : type.country_id === newApplication.countryId;
        const matchesCategory = type.category_id === newApplication.categoryId;
        const matchesSubcategory = !newApplication.subcategoryId || type.subcategory_id === newApplication.subcategoryId;
        return matchesCountry && matchesCategory && matchesSubcategory;
      })
    : [];

  // Filter categories for edit form
  const editFilteredCategories = editForm.countryId
    ? editForm.countryId === "__all__"
      ? categories.filter(cat => cat.country_id === null)
      : categories.filter(cat => cat.country_id === editForm.countryId)
    : [];

  // Filter subcategories for edit form
  const editFilteredSubcategories = editForm.countryId && editForm.categoryId
    ? subcategories.filter(sub => 
        (editForm.countryId === "__all__" ? sub.country_id === null : sub.country_id === editForm.countryId) && 
        sub.category_id === editForm.categoryId
      )
    : [];

  // Filter application types for edit form
  const editFilteredApplicationTypes = editForm.countryId && editForm.categoryId
    ? applicationTypes.filter(type => {
        const matchesCountry = editForm.countryId === "__all__" ? type.country_id === null : type.country_id === editForm.countryId;
        const matchesCategory = type.category_id === editForm.categoryId;
        const matchesSubcategory = !editForm.subcategoryId || type.subcategory_id === editForm.subcategoryId;
        return matchesCountry && matchesCategory && matchesSubcategory;
      })
    : [];

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
          category_id,
          subcategory_id,
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
          category_id: application.category_id,
          subcategory_id: application.subcategory_id,
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
      country_id: string | null;
      category_id: string;
      subcategory_id: string | null;
    }) => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      const { data, error } = await supabase
        .from("visa_applications")
        .insert({
          company_id: currentCompany.id,
          client_id: applicationData.client_id,
          application_name: applicationData.application_name,
          visa_subclass: applicationData.visa_subclass || null,
          country_id: applicationData.country_id,
          category_id: applicationData.category_id,
          subcategory_id: applicationData.subcategory_id || null,
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
      setNewApplication({ clientId: "", countryId: "", categoryId: "", subcategoryId: "", applicationName: "", visaSubclass: "" });
      toast.success("Application created!", {
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
      category_id: string | null;
      subcategory_id: string | null;
    }) => {
      const { data, error } = await supabase
        .from("visa_applications")
        .update({
          application_name: applicationData.application_name,
          visa_subclass: applicationData.visa_subclass,
          country_id: applicationData.country_id,
          category_id: applicationData.category_id,
          subcategory_id: applicationData.subcategory_id,
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
    if (!newApplication.clientId || !newApplication.countryId || !newApplication.categoryId || !newApplication.applicationName.trim()) return;
    
    createApplicationMutation.mutate({
      client_id: newApplication.clientId,
      application_name: newApplication.applicationName.trim(),
      visa_subclass: newApplication.visaSubclass,
      country_id: newApplication.countryId === "__all__" ? null : newApplication.countryId,
      category_id: newApplication.categoryId,
      subcategory_id: newApplication.subcategoryId || null,
    });
  };

  const handleEditApplication = (application: VisaApplication) => {
    setEditForm({
      countryId: application.country_id || "__all__",
      categoryId: application.category_id || "",
      subcategoryId: application.subcategory_id || "",
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
      country_id: editForm.countryId === "__all__" ? null : (editForm.countryId || null),
      category_id: editForm.categoryId || null,
      subcategory_id: editForm.subcategoryId || null,
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

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.name || null;
  };

  const getSubcategoryName = (subcategoryId: string | null) => {
    if (!subcategoryId) return null;
    const subcategory = subcategories.find(s => s.id === subcategoryId);
    return subcategory?.name || null;
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

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Applications</h1>
            <p className="text-muted-foreground">Manage applications for your clients</p>
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
                <DialogTitle>Create Application</DialogTitle>
                <DialogDescription>
                  Add a new application for a client.
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
                      categoryId: "",
                      subcategoryId: "",
                      applicationName: "", 
                      visaSubclass: "" 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">🌍</span>
                          All Countries
                        </span>
                      </SelectItem>
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
                {newApplication.countryId && filteredCategories.length === 0 && (
                  <div className="p-3 bg-muted/50 rounded-md border border-border">
                    <p className="text-sm text-muted-foreground">
                      No categories available for this selection.
                    </p>
                  </div>
                )}
                {(!newApplication.countryId || filteredCategories.length > 0) && (
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newApplication.categoryId}
                      onValueChange={(value) => setNewApplication(prev => ({ 
                        ...prev, 
                        categoryId: value,
                        subcategoryId: "",
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
                )}
                {newApplication.categoryId && filteredSubcategories.length === 0 && (
                  <div className="p-3 bg-muted/50 rounded-md border border-border">
                    <p className="text-sm text-muted-foreground">
                      No sub-categories available for this category.
                    </p>
                  </div>
                )}
                {newApplication.categoryId && filteredSubcategories.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Sub-category (Optional)</Label>
                    <Select
                      value={newApplication.subcategoryId || "__all__"}
                      onValueChange={(value) => setNewApplication(prev => ({ 
                        ...prev, 
                        subcategoryId: value === "__all__" ? "" : value,
                        applicationName: "",
                        visaSubclass: ""
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All sub-categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All sub-categories</SelectItem>
                        {filteredSubcategories.map((subcategory) => (
                          <SelectItem key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {newApplication.categoryId && filteredApplicationTypes.length === 0 && (
                  <div className="p-3 bg-muted/50 rounded-md border border-border">
                    <p className="text-sm text-muted-foreground">
                      No application types available for this selection.
                    </p>
                  </div>
                )}
                {newApplication.categoryId && filteredApplicationTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="applicationName">Application Name</Label>
                    <Select
                      value={newApplication.applicationName}
                      onValueChange={(value) => {
                        const selectedType = filteredApplicationTypes.find(t => t.name === value);
                        setNewApplication(prev => ({ 
                          ...prev, 
                          applicationName: value,
                          visaSubclass: selectedType?.code || ""
                        }));
                      }}
                      disabled={!newApplication.categoryId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select application name" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredApplicationTypes.map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateApplication}
                  disabled={!newApplication.clientId || !newApplication.countryId || !newApplication.categoryId || !newApplication.applicationName.trim() || createApplicationMutation.isPending}
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
                : "Create your first application to get started"}
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
                onClick={() => navigate(`/app/migration/applications/${application.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
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
                      {application.subcategory_id && (
                        <Badge variant="outline">
                          {getSubcategoryName(application.subcategory_id)}
                        </Badge>
                      )}
                      <h3 className="font-semibold truncate">{application.application_name}</h3>
                      <Badge variant={getStatusColor(application.status)}>
                        {application.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span className="truncate">{application.client_name}</span>
                      {application.visa_subclass && (
                        <>
                          <span>•</span>
                          <span>{application.visa_subclass}</span>
                        </>
                      )}
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
                  categoryId: "",
                  applicationName: "",
                  visaSubclass: ""
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">🌍</span>
                      All Countries
                    </span>
                  </SelectItem>
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
            {editForm.countryId && editFilteredCategories.length === 0 && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <p className="text-sm text-muted-foreground">
                  No categories available for this selection.
                </p>
              </div>
            )}
            {(!editForm.countryId || editFilteredCategories.length > 0) && (
              <div className="space-y-2">
                <Label htmlFor="editCategory">Category</Label>
                <Select
                  value={editForm.categoryId}
                  onValueChange={(value) => setEditForm(prev => ({ 
                    ...prev, 
                    categoryId: value,
                    subcategoryId: "",
                    applicationName: "",
                    visaSubclass: ""
                  }))}
                  disabled={!editForm.countryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={editForm.countryId ? "Select category" : "Select a country first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {editFilteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editForm.categoryId && editFilteredSubcategories.length === 0 && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <p className="text-sm text-muted-foreground">
                  No sub-categories available for this category.
                </p>
              </div>
            )}
            {editForm.categoryId && editFilteredSubcategories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="editSubcategory">Sub-category (Optional)</Label>
                <Select
                  value={editForm.subcategoryId || "__all__"}
                  onValueChange={(value) => setEditForm(prev => ({ 
                    ...prev, 
                    subcategoryId: value === "__all__" ? "" : value,
                    applicationName: "",
                    visaSubclass: ""
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sub-categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All sub-categories</SelectItem>
                    {editFilteredSubcategories.map((subcategory) => (
                      <SelectItem key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editForm.categoryId && editFilteredApplicationTypes.length === 0 && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <p className="text-sm text-muted-foreground">
                  No application types available for this selection.
                </p>
              </div>
            )}
            {editForm.categoryId && editFilteredApplicationTypes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="editApplicationName">Application Name</Label>
                <Select
                  value={editForm.applicationName}
                  onValueChange={(value) => {
                    const selectedType = editFilteredApplicationTypes.find(t => t.name === value);
                    setEditForm(prev => ({ 
                      ...prev, 
                      applicationName: value,
                      visaSubclass: selectedType?.code || ""
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select application name" />
                  </SelectTrigger>
                  <SelectContent>
                    {editFilteredApplicationTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editFilteredApplicationTypes.length === 0 && editForm.categoryId && (
              <div className="space-y-2">
                <Label htmlFor="editVisaSubclass">Code/Subclass (Optional)</Label>
                <Input
                  placeholder="Enter code or subclass"
                  value={editForm.visaSubclass}
                  onChange={(e) => setEditForm(prev => ({ ...prev, visaSubclass: e.target.value }))}
                />
              </div>
            )}
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