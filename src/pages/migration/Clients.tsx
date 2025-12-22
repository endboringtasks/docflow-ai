import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  User,
  Users,
  Building2,
  Mail,
  Phone,
  FolderOpen
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Client {
  id: string;
  clientType: "personal" | "corporate";
  fullName: string;
  email: string | null;
  phone: string | null;
  driveFolderId: string | null;
  createdAt: string;
  mattersCount: number;
}

const mockClients: Client[] = [
  { id: "1", clientType: "personal", fullName: "John Smith", email: "john@email.com", phone: "+61 400 123 456", driveFolderId: "folder_abc", createdAt: "2024-01-15", mattersCount: 2 },
  { id: "2", clientType: "personal", fullName: "Sarah Chen", email: "sarah.chen@email.com", phone: "+61 400 234 567", driveFolderId: "folder_def", createdAt: "2024-01-20", mattersCount: 1 },
  { id: "3", clientType: "corporate", fullName: "Tech Solutions Pty Ltd", email: "contact@techsolutions.com", phone: "+61 2 9876 5432", driveFolderId: null, createdAt: "2024-02-01", mattersCount: 3 },
  { id: "4", clientType: "personal", fullName: "Ahmed Hassan", email: "ahmed.h@email.com", phone: null, driveFolderId: "folder_ghi", createdAt: "2024-02-10", mattersCount: 1 },
  { id: "5", clientType: "personal", fullName: "Maria Garcia", email: "maria.garcia@email.com", phone: "+61 400 345 678", driveFolderId: "folder_jkl", createdAt: "2024-02-15", mattersCount: 1 },
];

const MigrationClients = () => {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    clientType: "personal" as "personal" | "corporate",
    fullName: "",
    email: "",
    phone: "",
  });

  const filteredClients = clients.filter(client => 
    client.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClient = () => {
    if (!newClient.fullName.trim()) return;
    
    const client: Client = {
      id: Date.now().toString(),
      clientType: newClient.clientType,
      fullName: newClient.fullName,
      email: newClient.email || null,
      phone: newClient.phone || null,
      driveFolderId: null,
      createdAt: new Date().toISOString().split("T")[0],
      mattersCount: 0,
    };
    
    setClients([client, ...clients]);
    setIsCreateOpen(false);
    setNewClient({ clientType: "personal", fullName: "", email: "", phone: "" });
    
    toast.success("Client created!", {
      description: "A webhook has been triggered to create the Google Drive folder.",
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
                  Add a new visa applicant to your practice. A Google Drive folder will be created automatically.
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
                <Button variant="gradient" className="flex-1" onClick={handleCreateClient} disabled={!newClient.fullName.trim()}>
                  Create Client
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

        {/* Clients Table */}
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
                          client.clientType === "corporate" ? "bg-accent/20" : "bg-primary/20"
                        }`}>
                          {client.clientType === "corporate" 
                            ? <Building2 className="w-5 h-5 text-accent" />
                            : <User className="w-5 h-5 text-primary" />
                          }
                        </div>
                        <div>
                          <p className="font-medium">{client.fullName}</p>
                          <p className="text-sm text-muted-foreground">Added {client.createdAt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <Badge variant={client.clientType === "corporate" ? "secondary" : "outline"}>
                        {client.clientType}
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
                      {client.driveFolderId ? (
                        <Badge variant="success" className="gap-1">
                          <FolderOpen className="w-3 h-3" />
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{client.mattersCount}</Badge>
                    </td>
                    <td className="p-4">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
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
      </div>
    </AppLayout>
  );
};

export default MigrationClients;
