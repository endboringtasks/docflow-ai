import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NationalitySelect } from "@/components/ui/nationality-select";
import { 
  Plus, 
  Search, 
  User,
  Users,
  Building2,
  Mail,
  Phone,
  FolderOpen,
  Loader2,
  Trash2,
  Pencil,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Settings
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useFolderStatusRealtime } from "@/hooks/useFolderStatusRealtime";
import { PhoneInput, parsePhoneNumber, formatPhoneNumber } from "@/components/ui/phone-input";

interface Client {
  id: string;
  client_type: "personal" | "corporate";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  client_folder_id: string | null;
  folder_status: string | null;
  created_at: string;
  visa_applications_count: number;
  drive_connected_email: string | null;
}

const MigrationClients = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    clientType: "personal" as "personal" | "corporate",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phoneCountryCode: "+61",
    phoneNumber: "",
    dateOfBirth: "",
    passportNumber: "",
    nationality: "",
  });
  const [newClient, setNewClient] = useState({
    clientType: "personal" as "personal" | "corporate",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phoneCountryCode: "+61",
    phoneNumber: "",
    dateOfBirth: "",
    passportNumber: "",
    nationality: "",
  });

  // Email validation helper
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Personal client validation
  const isPersonalClientValid = (form: typeof newClient) => 
    form.firstName.trim() && 
    form.lastName.trim() && 
    form.email.trim() && 
    isValidEmail(form.email) &&
    form.phoneNumber.trim();

  // Fetch clients with matters count
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Use secure RPC function that masks PII for non-admins
      const { data: clientsData, error: clientsError } = await supabase
        .rpc("get_clients_secure", { p_company_id: currentCompany.id });
      
      if (clientsError) throw clientsError;

      // Get visa applications count for each client
      const { data: applicationsData, error: applicationsError } = await supabase
        .from("visa_applications")
        .select("client_id")
        .eq("company_id", currentCompany.id);
      
      if (applicationsError) throw applicationsError;

      const applicationsCounts = (applicationsData || []).reduce((acc, app) => {
        acc[app.client_id] = (acc[app.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (clientsData || []).map(client => ({
        ...client,
        visa_applications_count: applicationsCounts[client.id] || 0,
      })) as Client[];
    },
    enabled: !!currentCompany?.id,
  });

  // Smart real-time subscription - only active when there are pending/creating folders
  useFolderStatusRealtime(
    "clients",
    currentCompany?.id,
    clients,
    ["clients", currentCompany?.id || ""]
  );

  // Drive connection status — polling & backfill handled globally by useDriveBackfill in AppLayout
  const { data: driveStatus } = useQuery({
    queryKey: ["drive-connection-status", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data } = await supabase
        .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });
      return data?.[0] ?? null;
    },
    enabled: !!currentCompany?.id,
  });

  const isDriveConnected = !!driveStatus?.root_folder_id && !driveStatus?.disconnected_at;

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: {
      client_type: "personal" | "corporate";
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      email: string | null;
      phone: string | null;
      date_of_birth: string | null;
      passport_number: string | null;
      nationality: string | null;
    }) => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      const { data, error } = await supabase
        .from("clients")
        .insert({
          company_id: currentCompany.id,
          client_type: clientData.client_type,
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          company_name: clientData.company_name,
          email: clientData.email,
          phone: clientData.phone,
          date_of_birth: clientData.date_of_birth,
          passport_number: clientData.passport_number,
          nationality: clientData.nationality,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Fetch company's Google Drive connection to get root folder ID
      let rootFolderId: string | null = null;
      try {
        const { data: driveConnection } = await supabase
          .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });
        rootFolderId = driveConnection?.[0]?.root_folder_id ?? null;
      } catch (e) {
        console.warn("Could not fetch drive connection:", e);
      }

      // Only dispatch folder-creation webhook if Drive is connected
      if (rootFolderId) {
        // Set folder_status to 'pending' since Drive is connected
        await supabase
          .from("clients")
          .update({ folder_status: "pending" })
          .eq("id", data.id);

        try {
          await supabase.functions.invoke("dispatch-webhook", {
            body: {
              event_type: "client.created",
              data: {
                client_id: data.id,
                company_id: currentCompany.id,
                client_type: data.client_type,
                first_name: data.first_name,
                last_name: data.last_name,
                company_name: data.company_name,
                root_folder_id: rootFolderId,
              },
            },
          });
        } catch (webhookError) {
          console.warn("Failed to dispatch webhook:", webhookError);
        }
      } else {
        console.log("Google Drive not connected — skipping folder creation webhook");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsCreateOpen(false);
      setNewClient({ clientType: "personal", firstName: "", lastName: "", companyName: "", email: "", phoneCountryCode: "+61", phoneNumber: "", dateOfBirth: "", passportNumber: "", nationality: "" });
      toast.success("Client created!");
    },
    onError: (error) => {
      toast.error("Failed to create client", {
        description: error.message,
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (client: Client) => {
      // Best-effort: rename Google Drive folder with DELETED_ prefix before deleting
      // Only attempt if folder was actually created (has ID and status is not "failed")
      const shouldRenameFolder = client.client_folder_id && client.folder_status !== "failed" && currentCompany?.id;
      if (shouldRenameFolder) {
        try {
          const { error: renameError } = await supabase.functions.invoke("google-drive-rename-folder", {
            body: {
              companyId: currentCompany.id,
              folderId: client.client_folder_id,
              newPrefix: "DELETED_",
            },
          });
          if (renameError) {
            console.warn("Failed to rename Drive folder (best-effort):", renameError);
          }
        } catch (renameError) {
          console.warn("Failed to rename Drive folder (best-effort):", renameError);
        }
      }

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);
      
      if (error) throw error;

      // Dispatch webhook for client.deleted event
      try {
        await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "client.deleted",
            data: {
              client_id: client.id,
              company_id: currentCompany?.id,
              client_type: client.client_type,
              first_name: client.first_name,
              last_name: client.last_name,
              company_name: client.company_name,
              email: client.email,
              phone: client.phone,
              client_folder_id: client.client_folder_id,
              folder_status: client.folder_status,
              created_at: client.created_at,
            },
          },
        });
      } catch (webhookError) {
        console.warn("Failed to dispatch webhook:", webhookError);
      }

      return { shouldRenameFolder };
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setClientToDelete(null);
      if (_data?.shouldRenameFolder) {
        toast.success("Client deleted and Drive folder renamed");
      } else {
        toast.success("Client deleted successfully");
      }
    },
    onError: (error) => {
      toast.error("Failed to delete client", {
        description: error.message,
      });
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async (clientData: {
      id: string;
      client_type: "personal" | "corporate";
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      email: string | null;
      phone: string | null;
      date_of_birth: string | null;
      passport_number: string | null;
      nationality: string | null;
    }) => {
      const { data, error } = await supabase
        .from("clients")
        .update({
          client_type: clientData.client_type,
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          company_name: clientData.company_name,
          email: clientData.email,
          phone: clientData.phone,
          date_of_birth: clientData.date_of_birth,
          passport_number: clientData.passport_number,
          nationality: clientData.nationality,
        })
        .eq("id", clientData.id)
        .select()
        .single();
      
      if (error) throw error;

      // Dispatch webhook for client.updated event
      try {
        await supabase.functions.invoke("dispatch-webhook", {
          body: {
            event_type: "client.updated",
            data: {
              client_id: data.id,
              company_id: data.company_id,
              client_type: data.client_type,
              first_name: data.first_name,
              last_name: data.last_name,
              company_name: data.company_name,
              client_folder_id: data.client_folder_id,
            },
          },
        });
      } catch (webhookError) {
        console.warn("Failed to dispatch webhook:", webhookError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setClientToEdit(null);
      toast.success("Client updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update client", {
        description: error.message,
      });
    },
  });

  // Retry folder creation mutation
  const retryFolderMutation = useMutation({
    mutationFn: async (client: Client) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      // Check if Drive is connected before retrying
      let rootFolderId: string | null = null;
      try {
        const { data: driveConnection } = await supabase
          .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });
        rootFolderId = driveConnection?.[0]?.root_folder_id ?? null;
      } catch (e) {
        console.warn("Could not fetch drive connection:", e);
      }

      if (!rootFolderId) {
        throw new Error("Google Drive is not connected. Please connect Google Drive in Settings first.");
      }

      // Set folder_status back to 'creating' with timestamp
      const { error: updateError } = await supabase
        .from("clients")
        .update({ 
          folder_status: "creating",
          folder_status_updated_at: new Date().toISOString()
        })
        .eq("id", client.id);

      if (updateError) throw updateError;

      // Dispatch webhook for client.created event
      const { error: webhookError } = await supabase.functions.invoke("dispatch-webhook", {
        body: {
          event_type: "client.created",
          data: {
            client_id: client.id,
            company_id: currentCompany.id,
            client_type: client.client_type,
            first_name: client.first_name,
            last_name: client.last_name,
            company_name: client.company_name,
            root_folder_id: rootFolderId,
          },
        },
      });

      if (webhookError) throw webhookError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      toast.success("Folder creation retry initiated");
    },
    onError: (error) => {
      toast.error("Failed to retry folder creation", {
        description: error.message,
      });
    },
  });

  const getFullName = (client: Client) => {
    if (client.client_type === "corporate") {
      return client.company_name || "Unnamed Company";
    }
    return client.last_name ? `${client.first_name} ${client.last_name}` : (client.first_name || "Unnamed Client");
  };

  const filteredClients = clients.filter(client => {
    const fullName = getFullName(client).toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateClient = () => {
    const isCorporate = newClient.clientType === "corporate";
    const hasRequiredField = isCorporate 
      ? newClient.companyName.trim() 
      : isPersonalClientValid(newClient);
    if (!hasRequiredField) return;
    
    createClientMutation.mutate({
      client_type: newClient.clientType,
      first_name: isCorporate ? null : newClient.firstName.trim(),
      last_name: isCorporate ? null : (newClient.lastName.trim() || null),
      company_name: isCorporate ? newClient.companyName.trim() : null,
      email: newClient.email.trim() || null,
      phone: formatPhoneNumber(newClient.phoneCountryCode, newClient.phoneNumber) || null,
      date_of_birth: isCorporate ? null : (newClient.dateOfBirth || null),
      passport_number: isCorporate ? null : (newClient.passportNumber.trim() || null),
      nationality: isCorporate ? null : (newClient.nationality || null),
    });
  };

  const handleEditClient = (client: Client) => {
    const { countryCode, phoneNumber } = parsePhoneNumber(client.phone);
    setEditForm({
      clientType: client.client_type,
      firstName: client.first_name || "",
      lastName: client.last_name || "",
      companyName: client.company_name || "",
      email: client.email || "",
      phoneCountryCode: countryCode,
      phoneNumber: phoneNumber,
      dateOfBirth: (client as any).date_of_birth || "",
      passportNumber: (client as any).passport_number || "",
      nationality: (client as any).nationality || "",
    });
    setClientToEdit(client);
  };

  const handleUpdateClient = () => {
    if (!clientToEdit) return;
    const isCorporate = editForm.clientType === "corporate";
    const hasRequiredField = isCorporate 
      ? editForm.companyName.trim() 
      : isPersonalClientValid(editForm);
    if (!hasRequiredField) return;
    
    updateClientMutation.mutate({
      id: clientToEdit.id,
      client_type: editForm.clientType,
      first_name: isCorporate ? null : editForm.firstName.trim(),
      last_name: isCorporate ? null : (editForm.lastName.trim() || null),
      company_name: isCorporate ? editForm.companyName.trim() : null,
      email: editForm.email.trim() || null,
      date_of_birth: isCorporate ? null : (editForm.dateOfBirth || null),
      passport_number: isCorporate ? null : (editForm.passportNumber.trim() || null),
      nationality: isCorporate ? null : (editForm.nationality || null),
      phone: formatPhoneNumber(editForm.phoneCountryCode, editForm.phoneNumber) || null,
    });
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
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-muted-foreground">Manage your visa applicants and their information</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Client</DialogTitle>
                <DialogDescription>
                  Add a new visa applicant to your practice. A Google Drive folder can be created automatically via webhook.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] px-1 -mx-1">
                <div className="space-y-2">
                  <Label>Client Type</Label>
                  <Select 
                    value={newClient.clientType} 
                    onValueChange={(value: "personal" | "corporate") => setNewClient({...newClient, clientType: value})}
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

                {newClient.clientType === "corporate" ? (
                  <div className="space-y-2">
                    <Label>Company Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={newClient.companyName}
                      onChange={(e) => setNewClient({...newClient, companyName: e.target.value})}
                      placeholder="Acme Corp Pty Ltd"
                      className="bg-secondary border-border"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>First Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={newClient.firstName}
                        onChange={(e) => setNewClient({...newClient, firstName: e.target.value})}
                        placeholder="John"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={newClient.lastName}
                        onChange={(e) => setNewClient({...newClient, lastName: e.target.value})}
                        placeholder="Smith"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={newClient.dateOfBirth}
                        onChange={(e) => setNewClient({...newClient, dateOfBirth: e.target.value})}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Passport Number</Label>
                      <Input
                        value={newClient.passportNumber}
                        onChange={(e) => setNewClient({...newClient, passportNumber: e.target.value})}
                        placeholder="Enter passport number"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nationality</Label>
                      <NationalitySelect
                        value={newClient.nationality}
                        onValueChange={(value) => setNewClient({...newClient, nationality: value})}
                        placeholder="Select nationality..."
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Email {newClient.clientType === "personal" && <span className="text-destructive">*</span>}</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    placeholder="email@example.com"
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone {newClient.clientType === "personal" && <span className="text-destructive">*</span>}</Label>
                  <PhoneInput
                    countryCode={newClient.phoneCountryCode}
                    phoneNumber={newClient.phoneNumber}
                    onCountryCodeChange={(code) => setNewClient({...newClient, phoneCountryCode: code})}
                    onPhoneNumberChange={(num) => setNewClient({...newClient, phoneNumber: num})}
                  />
                </div>
              </div>

              <DialogFooter className="flex-shrink-0 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="gradient" 
                  onClick={handleCreateClient} 
                  disabled={(newClient.clientType === "corporate" ? !newClient.companyName.trim() : !isPersonalClientValid(newClient)) || createClientMutation.isPending}
                >
                  {createClientMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Client"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Clients Table */}
        {!isLoading && (
          <div className="card-gradient rounded-xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Drive Folder</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Applications</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredClients.map((client, index) => (
                    <motion.tr 
                      key={client.id}
                      className="hover:bg-secondary/30 transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td 
                        className="p-4 cursor-pointer"
                        onClick={() => navigate(`/app/migration/clients/${client.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            client.client_type === "corporate" ? "bg-accent/20" : "bg-primary/20"
                          }`}>
                            {client.client_type === "corporate" 
                              ? <Building2 className="w-5 h-5 text-accent" />
                              : <User className="w-5 h-5 text-primary" />
                            }
                          </div>
                          <div>
                            <p className="font-medium hover:text-primary transition-colors">{getFullName(client)}</p>
                            <p className="text-sm text-muted-foreground">Added {formatDate(client.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <Badge variant={client.client_type === "corporate" ? "secondary" : "outline"}>
                          {client.client_type}
                        </Badge>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {client.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        {/* Always show Open Folder if folder exists, regardless of connection */}
                        {/* Drive folder status with per-client mismatch detection */}
                        {client.folder_status === "created" && client.client_folder_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {(() => {
                                  const clientDriveEmail = client.drive_connected_email;
                                  const currentDriveEmail = driveStatus?.connected_email;
                                  const isDriveMismatch = isDriveConnected && !!clientDriveEmail && !!currentDriveEmail && clientDriveEmail !== currentDriveEmail;
                                  const isWarning = !isDriveConnected || isDriveMismatch;
                                  return (
                                    <a
                                      href={`https://drive.google.com/drive/folders/${client.client_folder_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium hover:underline transition-all group ${
                                        isWarning
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                                          : "bg-primary/10 text-primary hover:bg-primary/20"
                                      }`}
                                    >
                                      <FolderOpen className="w-3.5 h-3.5" />
                                      Open Folder
                                      {isWarning && <AlertTriangle className="w-3 h-3" />}
                                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                  );
                                })()}
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                {(() => {
                                  const clientDriveEmail = client.drive_connected_email;
                                  const currentDriveEmail = driveStatus?.connected_email;
                                  const isDriveMismatch = isDriveConnected && !!clientDriveEmail && !!currentDriveEmail && clientDriveEmail !== currentDriveEmail;
                                  if (!isDriveConnected) {
                                    return <p>Google Drive disconnected{clientDriveEmail ? ` for ${clientDriveEmail}` : ""}. Folder may not be accessible.</p>;
                                  }
                                  if (isDriveMismatch) {
                                    return <p>Folder created with {clientDriveEmail}, but Drive is now connected to {currentDriveEmail}. Folder may not be accessible.</p>;
                                  }
                                  return <p>Opens in Google Drive</p>;
                                })()}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : !isDriveConnected ? (
                          /* Drive not connected and no folder - show warning with instructions */
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium cursor-help">
                                  <AlertTriangle className="w-3 h-3" />
                                  Not Connected
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs p-3">
                                <p className="font-semibold mb-2">Google Drive is not connected</p>
                                <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                                  <li>Go to <strong>Settings</strong></li>
                                  <li>Scroll to <strong>Google Drive Integration</strong></li>
                                  <li>Click <strong>Connect Google Drive</strong></li>
                                  <li>Authorize access</li>
                                </ol>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : client.folder_status === "creating" ? (
                          <Badge variant="outline" className="gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Creating
                          </Badge>
                        ) : client.folder_status === "failed" ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">Failed</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                retryFolderMutation.mutate(client);
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
                        ) : client.folder_status === "pending" ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{client.visa_applications_count}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditClient(client)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setClientToDelete(client)}
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

            {filteredClients.length === 0 && (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No clients found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? "Try a different search term" : "Get started by adding your first client"}
                </p>
                {!searchQuery && (
                  <Button variant="gradient" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Client
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Client</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{clientToDelete ? getFullName(clientToDelete) : ''}"? This action cannot be undone.
                {clientToDelete && clientToDelete.visa_applications_count > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    Warning: This client has {clientToDelete.visa_applications_count} associated application(s) that must be deleted first.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clientToDelete && deleteClientMutation.mutate(clientToDelete)}
                disabled={deleteClientMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteClientMutation.isPending ? (
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

        {/* Edit Client Dialog */}
        <Dialog open={!!clientToEdit} onOpenChange={() => setClientToEdit(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update client information.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh] px-1 -mx-1">
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
                    <Label>Company Name <span className="text-destructive">*</span></Label>
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
                      <Label>First Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                        placeholder="John"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                        placeholder="Smith"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={editForm.dateOfBirth}
                        onChange={(e) => setEditForm({...editForm, dateOfBirth: e.target.value})}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Passport Number</Label>
                      <Input
                        value={editForm.passportNumber}
                        onChange={(e) => setEditForm({...editForm, passportNumber: e.target.value})}
                        placeholder="Enter passport number"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nationality</Label>
                      <NationalitySelect
                        value={editForm.nationality}
                        onValueChange={(value) => setEditForm({...editForm, nationality: value})}
                        placeholder="Select nationality..."
                      />
                    </div>
                  </>
                )}

              <div className="space-y-2">
                <Label>Email {editForm.clientType === "personal" && <span className="text-destructive">*</span>}</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  placeholder="email@example.com"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone {editForm.clientType === "personal" && <span className="text-destructive">*</span>}</Label>
                <PhoneInput
                  countryCode={editForm.phoneCountryCode}
                  phoneNumber={editForm.phoneNumber}
                  onCountryCodeChange={(code) => setEditForm({...editForm, phoneCountryCode: code})}
                  onPhoneNumberChange={(num) => setEditForm({...editForm, phoneNumber: num})}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setClientToEdit(null)}>
                Cancel
              </Button>
              <Button 
                variant="gradient" 
                className="flex-1" 
                onClick={handleUpdateClient} 
                disabled={(editForm.clientType === "corporate" ? !editForm.companyName.trim() : !isPersonalClientValid(editForm)) || updateClientMutation.isPending}
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
      </div>
    </AppLayout>
  );
};

export default MigrationClients;
