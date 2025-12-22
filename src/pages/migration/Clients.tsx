import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Trash2
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
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface Client {
  id: string;
  client_type: "personal" | "corporate";
  full_name: string;
  email: string | null;
  phone: string | null;
  drive_folder_id: string | null;
  created_at: string;
  matters_count: number;
}

const MigrationClients = () => {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({
    clientType: "personal" as "personal" | "corporate",
    fullName: "",
    email: "",
    phone: "",
  });

  // Fetch clients with matters count
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
      if (clientsError) throw clientsError;

      // Get matters count for each client
      const { data: mattersData, error: mattersError } = await supabase
        .from("matters")
        .select("client_id")
        .eq("company_id", currentCompany.id);
      
      if (mattersError) throw mattersError;

      const mattersCounts = (mattersData || []).reduce((acc, matter) => {
        acc[matter.client_id] = (acc[matter.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (clientsData || []).map(client => ({
        ...client,
        matters_count: mattersCounts[client.id] || 0,
      })) as Client[];
    },
    enabled: !!currentCompany?.id,
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: {
      client_type: "personal" | "corporate";
      full_name: string;
      email: string | null;
      phone: string | null;
    }) => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      const { data, error } = await supabase
        .from("clients")
        .insert({
          company_id: currentCompany.id,
          client_type: clientData.client_type,
          full_name: clientData.full_name,
          email: clientData.email,
          phone: clientData.phone,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setIsCreateOpen(false);
      setNewClient({ clientType: "personal", fullName: "", email: "", phone: "" });
      toast.success("Client created!", {
        description: "A webhook can be configured to create the Google Drive folder.",
      });
    },
    onError: (error) => {
      toast.error("Failed to create client", {
        description: error.message,
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", currentCompany?.id] });
      setClientToDelete(null);
      toast.success("Client deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete client", {
        description: error.message,
      });
    },
  });

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClient = () => {
    if (!newClient.fullName.trim()) return;
    
    createClientMutation.mutate({
      client_type: newClient.clientType,
      full_name: newClient.fullName.trim(),
      email: newClient.email.trim() || null,
      phone: newClient.phone.trim() || null,
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
              
              <div className="space-y-4 py-4">
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

                <div className="space-y-2">
                  <Label>{newClient.clientType === "personal" ? "Full Name" : "Company Name"}</Label>
                  <Input
                    value={newClient.fullName}
                    onChange={(e) => setNewClient({...newClient, fullName: e.target.value})}
                    placeholder={newClient.clientType === "personal" ? "John Smith" : "Acme Corp Pty Ltd"}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    placeholder="email@example.com"
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    placeholder="+61 400 123 456"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="gradient" 
                  className="flex-1" 
                  onClick={handleCreateClient} 
                  disabled={!newClient.fullName.trim() || createClientMutation.isPending}
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
              </div>
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
                      <td className="p-4">
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
                            <p className="font-medium">{client.full_name}</p>
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
                        {client.drive_folder_id ? (
                          <Badge variant="success" className="gap-1">
                            <FolderOpen className="w-3 h-3" />
                            Linked
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{client.matters_count}</Badge>
                      </td>
                      <td className="p-4">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setClientToDelete(client)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                Are you sure you want to delete "{clientToDelete?.full_name}"? This action cannot be undone.
                {clientToDelete && clientToDelete.matters_count > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    Warning: This client has {clientToDelete.matters_count} associated application(s) that must be deleted first.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clientToDelete && deleteClientMutation.mutate(clientToDelete.id)}
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
      </div>
    </AppLayout>
  );
};

export default MigrationClients;
