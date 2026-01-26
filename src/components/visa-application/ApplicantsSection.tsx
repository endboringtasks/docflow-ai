import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, User, Users, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Client {
  id: string;
  client_type: "personal" | "corporate";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface ApplicantType {
  id: string;
  code: string;
  name: string;
}

interface ApplicationApplicant {
  id: string;
  client_id: string;
  applicant_type_id: string;
  is_primary: boolean;
  sort_order: number;
  applicant_type: ApplicantType;
  client: Client;
}

interface CategoryApplicantRule {
  id: string;
  category_id: string;
  applicant_type_id: string;
  is_required: boolean;
  allow_multiple: boolean;
  min_count: number;
  max_count: number | null;
  sort_order: number;
  applicant_type: ApplicantType;
}

interface ApplicantsSectionProps {
  visaApplicationId: string;
  categoryId: string | null;
  companyId: string;
}

const getClientName = (client: Client) => {
  if (client.client_type === "corporate") {
    return client.company_name || "Unnamed Company";
  }
  return client.last_name 
    ? `${client.first_name} ${client.last_name}` 
    : (client.first_name || "Unnamed Client");
};

export const ApplicantsSection = ({
  visaApplicationId,
  categoryId,
  companyId,
}: ApplicantsSectionProps) => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  // Fetch application applicants
  const { data: applicationApplicants = [], isLoading: isLoadingApplicants } = useQuery({
    queryKey: ["application-applicants", visaApplicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_applicants")
        .select(`
          id, 
          client_id, 
          applicant_type_id,
          is_primary,
          sort_order,
          applicant_type:applicant_types(id, code, name),
          client:clients(id, first_name, last_name, company_name, client_type)
        `)
        .eq("visa_application_id", visaApplicationId)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as ApplicationApplicant[];
    },
    enabled: !!visaApplicationId,
  });

  // Fetch category applicant rules
  const { data: categoryRules = [] } = useQuery({
    queryKey: ["category-applicant-rules", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("category_applicant_types")
        .select("*, applicant_type:applicant_types(id, code, name)")
        .eq("category_id", categoryId)
        .order("sort_order");
      if (error) throw error;
      return data as CategoryApplicantRule[];
    },
    enabled: !!categoryId,
  });

  // Fetch all clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_clients_secure", { p_company_id: companyId });
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!companyId,
  });

  // Get available applicant types (types that can still be added)
  const availableApplicantTypes = categoryRules.filter(rule => {
    // Skip primary type (can't add more primary applicants)
    if (rule.applicant_type?.code === "primary") return false;
    
    // Count existing applicants of this type
    const existingCount = applicationApplicants.filter(
      a => a.applicant_type_id === rule.applicant_type_id
    ).length;
    
    // Check if max count reached
    if (rule.max_count !== null && existingCount >= rule.max_count) return false;
    
    return true;
  });

  // Get available clients (exclude already added clients for same type)
  const getAvailableClients = () => {
    if (!selectedTypeId) return clients;
    
    // Get client IDs already added for this type
    const existingClientIds = applicationApplicants
      .filter(a => a.applicant_type_id === selectedTypeId)
      .map(a => a.client_id);
    
    return clients.filter(c => !existingClientIds.includes(c.id));
  };

  // Add applicant mutation
  const addApplicantMutation = useMutation({
    mutationFn: async ({ clientId, applicantTypeId }: { 
      clientId: string; 
      applicantTypeId: string;
    }) => {
      const { error } = await supabase
        .from("application_applicants")
        .insert({
          visa_application_id: visaApplicationId,
          client_id: clientId,
          applicant_type_id: applicantTypeId,
          is_primary: false,
          sort_order: (applicationApplicants.length + 1) * 10,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-applicants", visaApplicationId] });
      setIsAddOpen(false);
      setSelectedTypeId("");
      setSelectedClientId("");
      toast.success("Applicant added");
    },
    onError: (error) => {
      toast.error("Failed to add applicant", { description: error.message });
    },
  });

  // Remove applicant mutation
  const removeApplicantMutation = useMutation({
    mutationFn: async (applicantId: string) => {
      const { error } = await supabase
        .from("application_applicants")
        .delete()
        .eq("id", applicantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-applicants", visaApplicationId] });
      toast.success("Applicant removed");
    },
    onError: (error) => {
      toast.error("Failed to remove applicant", { description: error.message });
    },
  });

  const handleAddApplicant = () => {
    if (!selectedClientId || !selectedTypeId) return;
    addApplicantMutation.mutate({
      clientId: selectedClientId,
      applicantTypeId: selectedTypeId,
    });
  };

  if (isLoadingApplicants) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Applicants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Applicants
            </CardTitle>
            {availableApplicantTypes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {applicationApplicants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No applicants added yet.
            </p>
          ) : (
            applicationApplicants.map((applicant) => (
              <div
                key={applicant.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {getClientName(applicant.client)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {applicant.applicant_type?.name || "Unknown Type"}
                      </span>
                      {applicant.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {!applicant.is_primary && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeApplicantMutation.mutate(applicant.id)}
                    disabled={removeApplicantMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Add Applicant Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Applicant</DialogTitle>
            <DialogDescription>
              Add an applicant to this application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Applicant Type</Label>
              <Select
                value={selectedTypeId}
                onValueChange={(value) => {
                  setSelectedTypeId(value);
                  setSelectedClientId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {availableApplicantTypes.map((rule) => (
                    <SelectItem key={rule.id} value={rule.applicant_type_id}>
                      {rule.applicant_type?.name || "Unknown Type"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                disabled={!selectedTypeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedTypeId ? "Select client..." : "Select type first"} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableClients().map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {getClientName(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddApplicant}
              disabled={!selectedClientId || !selectedTypeId || addApplicantMutation.isPending}
            >
              {addApplicantMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Applicant"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApplicantsSection;
