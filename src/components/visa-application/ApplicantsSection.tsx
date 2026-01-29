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

interface RelatedApplicant {
  id: string;
  type: "partner" | "dependant" | "witness";
  first_name: string;
  last_name: string;
  relationship: string;
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
  related_applicant_id: string | null;
  applicant_type: ApplicantType;
  displayName: string;
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
  subcategoryId?: string | null;
  companyId: string;
  primaryClientId: string;
}

export const ApplicantsSection = ({
  visaApplicationId,
  categoryId,
  subcategoryId,
  companyId,
  primaryClientId,
}: ApplicantsSectionProps) => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedRelatedApplicantId, setSelectedRelatedApplicantId] = useState("");

  // Fetch primary client's related applicants from JSONB
  const { data: primaryClientData } = useQuery({
    queryKey: ["client-related-applicants", primaryClientId],
    queryFn: async () => {
      if (!primaryClientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("first_name, last_name, company_name, client_type, related_applicants")
        .eq("id", primaryClientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!primaryClientId,
  });

  const relatedApplicants = Array.isArray(primaryClientData?.related_applicants) 
    ? (primaryClientData.related_applicants as unknown as RelatedApplicant[])
    : [];

  const getPrimaryClientName = () => {
    if (!primaryClientData) return "Primary Applicant";
    if (primaryClientData.client_type === "corporate") {
      return primaryClientData.company_name || "Unnamed Company";
    }
    return `${primaryClientData.first_name || ""} ${primaryClientData.last_name || ""}`.trim() || "Primary Applicant";
  };

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
          related_applicant_id,
          applicant_type:applicant_types(id, code, name)
        `)
        .eq("visa_application_id", visaApplicationId)
        .order("sort_order");
      if (error) throw error;
      
      // Transform to include display names
      return (data || []).map(applicant => {
        let displayName = "";
        
        if (applicant.is_primary) {
          displayName = getPrimaryClientName();
        } else if (applicant.related_applicant_id) {
          const relatedPerson = relatedApplicants.find(
            ra => ra.id === applicant.related_applicant_id
          );
          if (relatedPerson) {
            displayName = `${relatedPerson.first_name || ""} ${relatedPerson.last_name || ""}`.trim();
          }
        }
        
        return {
          ...applicant,
          displayName: displayName || applicant.applicant_type?.name || "Unknown",
        } as ApplicationApplicant;
      });
    },
    enabled: !!visaApplicationId && !!primaryClientData,
  });

  // Fetch category applicant rules (with subcategory support)
  const { data: categoryRules = [] } = useQuery({
    queryKey: ["category-applicant-rules", categoryId, subcategoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("category_applicant_types")
        .select("*, applicant_type:applicant_types(id, code, name)")
        .eq("category_id", categoryId)
        .order("sort_order");
      if (error) throw error;
      
      const rules = data as (CategoryApplicantRule & { subcategory_id: string | null })[];

      // Merge rules: fallback first, then override with specific subcategory rules
      const rulesByType = new Map<string, (typeof rules)[0]>();

      // Add fallback rules (subcategory_id = null)
      rules
        .filter(r => r.subcategory_id === null)
        .forEach(r => rulesByType.set(r.applicant_type_id, r));

      // Override with specific subcategory rules
      rules
        .filter(r => r.subcategory_id === subcategoryId)
        .forEach(r => rulesByType.set(r.applicant_type_id, r));

      // Return merged rules sorted by sort_order
      return Array.from(rulesByType.values())
        .sort((a, b) => a.sort_order - b.sort_order);
    },
    enabled: !!categoryId,
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

  // Get available related applicants for a specific type
  const getAvailableRelatedApplicants = () => {
    if (!selectedTypeId) return [];
    
    const rule = categoryRules.find(r => r.applicant_type_id === selectedTypeId);
    if (!rule) return [];
    
    // Map applicant type code to related_applicants type
    const typeMapping: Record<string, string> = {
      partner: "partner",
      dependant: "dependant",
      witness: "witness",
    };
    
    const typeCode = rule.applicant_type?.code?.toLowerCase() || "";
    const matchingType = typeMapping[typeCode];
    if (!matchingType) return [];
    
    // Filter related applicants by type
    const applicantsOfType = relatedApplicants.filter(a => a.type === matchingType);
    
    // Exclude already added ones
    const existingIds = applicationApplicants
      .filter(a => a.applicant_type_id === selectedTypeId)
      .map(a => a.related_applicant_id);
    
    return applicantsOfType.filter(a => !existingIds.includes(a.id));
  };

  // Add applicant mutation
  const addApplicantMutation = useMutation({
    mutationFn: async ({ relatedApplicantId, applicantTypeId }: { 
      relatedApplicantId: string; 
      applicantTypeId: string;
    }) => {
      const { error } = await supabase
        .from("application_applicants")
        .insert({
          visa_application_id: visaApplicationId,
          client_id: primaryClientId, // Always references primary client
          applicant_type_id: applicantTypeId,
          is_primary: false,
          sort_order: (applicationApplicants.length + 1) * 10,
          related_applicant_id: relatedApplicantId, // Reference to JSONB entry
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-applicants", visaApplicationId] });
      setIsAddOpen(false);
      setSelectedTypeId("");
      setSelectedRelatedApplicantId("");
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
    if (!selectedRelatedApplicantId || !selectedTypeId) return;
    addApplicantMutation.mutate({
      relatedApplicantId: selectedRelatedApplicantId,
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

  const availableForSelectedType = getAvailableRelatedApplicants();

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
                      {applicant.displayName}
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
              Add an applicant from the primary client's related persons.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Applicant Type</Label>
              <Select
                value={selectedTypeId}
                onValueChange={(value) => {
                  setSelectedTypeId(value);
                  setSelectedRelatedApplicantId("");
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
              <Label>Person</Label>
              <Select
                value={selectedRelatedApplicantId}
                onValueChange={setSelectedRelatedApplicantId}
                disabled={!selectedTypeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedTypeId ? "Select person..." : "Select type first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableForSelectedType.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                      {person.relationship && ` (${person.relationship})`}
                    </SelectItem>
                  ))}
                  {availableForSelectedType.length === 0 && selectedTypeId && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No available {categoryRules.find(r => r.applicant_type_id === selectedTypeId)?.applicant_type?.name?.toLowerCase() || "persons"} in client's profile
                    </div>
                  )}
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
              disabled={!selectedRelatedApplicantId || !selectedTypeId || addApplicantMutation.isPending}
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
