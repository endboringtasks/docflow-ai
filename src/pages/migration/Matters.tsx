import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  User
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Matter {
  id: string;
  clientId: string;
  clientName: string;
  matterName: string;
  visaSubclass: string;
  status: "draft" | "active" | "done";
  driveFolderId: string | null;
  createdAt: string;
  progress: number;
}

const mockClients = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Sarah Chen" },
  { id: "3", name: "Tech Solutions Pty Ltd" },
  { id: "4", name: "Ahmed Hassan" },
  { id: "5", name: "Maria Garcia" },
];

const mockMatters: Matter[] = [
  { id: "1", clientId: "1", clientName: "John Smith", matterName: "Skilled Worker Application", visaSubclass: "482", status: "active", driveFolderId: "folder_1", createdAt: "2024-01-20", progress: 75 },
  { id: "2", clientId: "2", clientName: "Sarah Chen", matterName: "Partner Visa Application", visaSubclass: "820", status: "active", driveFolderId: "folder_2", createdAt: "2024-01-25", progress: 45 },
  { id: "3", clientId: "4", clientName: "Ahmed Hassan", matterName: "Student Visa Application", visaSubclass: "500", status: "draft", driveFolderId: null, createdAt: "2024-02-10", progress: 20 },
  { id: "4", clientId: "5", clientName: "Maria Garcia", matterName: "Business Innovation Visa", visaSubclass: "188", status: "done", driveFolderId: "folder_4", createdAt: "2024-01-15", progress: 100 },
  { id: "5", clientId: "1", clientName: "John Smith", matterName: "ENS Nomination", visaSubclass: "186", status: "active", driveFolderId: "folder_5", createdAt: "2024-02-05", progress: 60 },
];

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

const MigrationMatters = () => {
  const [matters, setMatters] = useState<Matter[]>(mockMatters);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "done">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [newMatter, setNewMatter] = useState({
    clientId: "",
    matterName: "",
    visaSubclass: "",
  });

  const filteredMatters = matters.filter(matter => {
    const matchesSearch = matter.matterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matter.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matter.visaSubclass.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || matter.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateMatter = () => {
    if (!newMatter.clientId || !newMatter.matterName.trim() || !newMatter.visaSubclass) return;
    
    const client = mockClients.find(c => c.id === newMatter.clientId);
    const matter: Matter = {
      id: Date.now().toString(),
      clientId: newMatter.clientId,
      clientName: client?.name || "",
      matterName: newMatter.matterName,
      visaSubclass: newMatter.visaSubclass,
      status: "draft",
      driveFolderId: null,
      createdAt: new Date().toISOString().split("T")[0],
      progress: 0,
    };
    
    setMatters([matter, ...matters]);
    setIsCreateOpen(false);
    setNewMatter({ clientId: "", matterName: "", visaSubclass: "" });
    
    toast.success("Visa application created!", {
      description: "A webhook has been triggered to create the matter folder.",
    });
  };

  const getStatusIcon = (status: Matter["status"]) => {
    switch (status) {
      case "draft": return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "active": return <AlertCircle className="w-4 h-4 text-warning" />;
      case "done": return <CheckCircle className="w-4 h-4 text-success" />;
    }
  };

  const getStatusColor = (status: Matter["status"]) => {
    switch (status) {
      case "draft": return "secondary";
      case "active": return "default";
      case "done": return "success";
    }
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
              <Button variant="gradient">
                <Plus className="w-4 h-4 mr-2" />
                New Application
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Visa Application</DialogTitle>
                <DialogDescription>
                  Start a new visa application for an existing client. A folder structure will be created in Google Drive.
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
                      {mockClients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
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
                  disabled={!newMatter.clientId || !newMatter.matterName.trim() || !newMatter.visaSubclass}
                >
                  Create Application
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

        {/* Matters Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatters.map((matter, index) => (
            <motion.div
              key={matter.id}
              className="card-gradient rounded-xl border border-border/50 p-6 hover:border-primary/50 transition-all cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedMatter(matter)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <Badge variant={getStatusColor(matter.status)}>
                  {matter.status}
                </Badge>
              </div>
              
              <h3 className="font-semibold mb-1 line-clamp-1">{matter.matterName}</h3>
              <p className="text-sm text-primary mb-2">Subclass {matter.visaSubclass}</p>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <User className="w-4 h-4" />
                {matter.clientName}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{matter.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full rounded-full gradient-bg transition-all duration-500"
                    style={{ width: `${matter.progress}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredMatters.length === 0 && (
          <div className="card-gradient rounded-xl border border-border/50 p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No applications found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all" ? "Try different filters" : "Create your first visa application"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button variant="gradient" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Application
              </Button>
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
                    <Badge variant="outline">Subclass {selectedMatter.visaSubclass}</Badge>
                  </div>
                  <DialogTitle className="text-2xl">{selectedMatter.matterName}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedMatter.clientName}
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="overview" className="mt-6">
                  <TabsList className="grid w-full grid-cols-3 bg-secondary">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="validation">Validation</TabsTrigger>
                    <TabsTrigger value="forms">Forms</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Created</p>
                        <p className="font-medium">{selectedMatter.createdAt}</p>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Progress</p>
                        <p className="font-medium">{selectedMatter.progress}%</p>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Drive Folder</p>
                        <p className="font-medium">{selectedMatter.driveFolderId ? "Linked" : "Pending"}</p>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                        <p className="font-medium capitalize">{selectedMatter.status}</p>
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
      </div>
    </AppLayout>
  );
};

export default MigrationMatters;
