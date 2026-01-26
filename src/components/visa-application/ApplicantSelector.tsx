import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Users } from "lucide-react";

interface RelatedApplicant {
  id: string;
  type: "partner" | "dependant" | "witness";
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  passport_number?: string;
  nationality?: string;
  relationship: string;
}

interface ApplicantType {
  id: string;
  code: string;
  name: string;
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

export interface ApplicantSelection {
  [applicantTypeId: string]: {
    enabled: boolean;
    clients: string[]; // Array of related applicant IDs
  };
}

interface ApplicantSelectorProps {
  categoryId: string;
  primaryClientId: string;
  selections: ApplicantSelection;
  onSelectionsChange: (selections: ApplicantSelection) => void;
}

const getApplicantName = (applicant: RelatedApplicant) => {
  return `${applicant.first_name} ${applicant.last_name}`;
};

const getPrimaryClientName = (data: { client_type: string; first_name: string | null; last_name: string | null; company_name: string | null }) => {
  if (data.client_type === "corporate") {
    return data.company_name || "Unnamed Company";
  }
  return data.last_name 
    ? `${data.first_name} ${data.last_name}` 
    : (data.first_name || "Unnamed Client");
};

export const ApplicantSelector = ({
  categoryId,
  primaryClientId,
  selections,
  onSelectionsChange,
}: ApplicantSelectorProps) => {
  // Fetch primary client's data including related_applicants
  const { data: primaryClientData, isLoading: isLoadingClient } = useQuery({
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

  // Fetch category applicant rules
  const { data: categoryApplicantRules = [], isLoading: isLoadingRules } = useQuery({
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

  // Filter out non-primary rules for UI
  const nonPrimaryRules = categoryApplicantRules.filter(
    rule => rule.applicant_type?.code !== "primary"
  );

  // Get primary rule
  const primaryRule = categoryApplicantRules.find(
    rule => rule.applicant_type?.code === "primary"
  );

  // Get available related applicants for a specific type
  const getAvailableApplicants = (typeCode: string, typeId: string, currentIndex: number) => {
    // Map applicant type code to related_applicants type
    const typeMapping: Record<string, string> = {
      partner: "partner",
      dependant: "dependant",
      witness: "witness",
    };
    
    const matchingType = typeMapping[typeCode.toLowerCase()];
    if (!matchingType) return [];
    
    // Filter related applicants by type
    const applicantsOfType = relatedApplicants.filter(a => a.type === matchingType);
    
    // Exclude already selected ones (except at current index)
    const selectedIds = selections[typeId]?.clients || [];
    return applicantsOfType.filter(a => {
      const indexOfApplicant = selectedIds.indexOf(a.id);
      return indexOfApplicant === -1 || indexOfApplicant === currentIndex;
    });
  };

  const handleToggle = (typeId: string, enabled: boolean) => {
    const rule = categoryApplicantRules.find(r => r.applicant_type_id === typeId);
    onSelectionsChange({
      ...selections,
      [typeId]: {
        enabled,
        clients: enabled ? (rule?.allow_multiple ? [""] : [""]) : [],
      },
    });
  };

  const handleCountChange = (typeId: string, count: number) => {
    const rule = categoryApplicantRules.find(r => r.applicant_type_id === typeId);
    const maxCount = rule?.max_count ?? 10;
    const validCount = Math.min(Math.max(0, count), maxCount);
    
    const currentClients = selections[typeId]?.clients || [];
    let newClients: string[];
    
    if (validCount > currentClients.length) {
      // Add empty slots
      newClients = [...currentClients, ...Array(validCount - currentClients.length).fill("")];
    } else {
      // Remove slots
      newClients = currentClients.slice(0, validCount);
    }
    
    onSelectionsChange({
      ...selections,
      [typeId]: {
        enabled: validCount > 0,
        clients: newClients,
      },
    });
  };

  const handleClientSelect = (typeId: string, index: number, clientId: string) => {
    const currentClients = [...(selections[typeId]?.clients || [])];
    currentClients[index] = clientId;
    
    onSelectionsChange({
      ...selections,
      [typeId]: {
        ...selections[typeId],
        enabled: true,
        clients: currentClients,
      },
    });
  };

  const isLoading = isLoadingClient || isLoadingRules;

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <div className="h-4 bg-muted animate-pulse rounded w-24" />
        <div className="h-10 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (categoryApplicantRules.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Applicants</Label>
      </div>

      {/* Primary Applicant - Read only */}
      {primaryRule && primaryClientData && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Primary Applicant</Label>
            <Badge variant="secondary" className="text-xs">Required</Badge>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{getPrimaryClientName(primaryClientData)}</span>
          </div>
        </div>
      )}

      {/* Other Applicant Types */}
      {nonPrimaryRules.map((rule) => {
        const typeId = rule.applicant_type_id;
        const selection = selections[typeId] || { enabled: false, clients: [] };
        const isRequired = rule.is_required;
        const allowMultiple = rule.allow_multiple;
        const maxCount = rule.max_count ?? 10;
        const currentCount = selection.clients.filter(c => c).length;

        return (
          <div key={rule.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm">
                  {rule.applicant_type?.name || "Unknown Type"}
                </Label>
                {isRequired && (
                  <Badge variant="secondary" className="text-xs">Required</Badge>
                )}
                {allowMultiple && maxCount > 1 && (
                  <span className="text-xs text-muted-foreground">
                    (max {maxCount})
                  </span>
                )}
              </div>
              
              {!isRequired && !allowMultiple && (
                <Switch
                  checked={selection.enabled}
                  onCheckedChange={(checked) => handleToggle(typeId, checked)}
                />
              )}
              
              {allowMultiple && (
                <Input
                  type="number"
                  min={isRequired ? rule.min_count : 0}
                  max={maxCount}
                  value={selection.clients.length}
                  onChange={(e) => handleCountChange(typeId, parseInt(e.target.value) || 0)}
                  className="w-20 h-8"
                />
              )}
            </div>

            {/* Applicant Selection Dropdowns */}
            {(selection.enabled || isRequired || selection.clients.length > 0) && (
              <div className="space-y-2 pl-4">
                {(selection.clients.length > 0 ? selection.clients : [""]).map((applicantId, index) => {
                  // Only show if enabled or required
                  if (!selection.enabled && !isRequired && selection.clients.length === 0) return null;
                  if (!selection.enabled && !isRequired && index >= selection.clients.length) return null;
                  
                  const typeCode = rule.applicant_type?.code || "";
                  const availableApplicants = getAvailableApplicants(typeCode, typeId, index);
                  
                  return (
                    <div key={index} className="flex items-center gap-2">
                      {allowMultiple && selection.clients.length > 1 && (
                        <span className="text-xs text-muted-foreground w-6">
                          #{index + 1}
                        </span>
                      )}
                      <Select
                        value={applicantId || ""}
                        onValueChange={(value) => handleClientSelect(typeId, index, value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={`Select ${rule.applicant_type?.name?.toLowerCase() || 'applicant'}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableApplicants.map((applicant) => (
                            <SelectItem key={applicant.id} value={applicant.id}>
                              {getApplicantName(applicant)} ({applicant.relationship})
                            </SelectItem>
                          ))}
                          {availableApplicants.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No {typeCode.toLowerCase()}s added to this client's profile
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ApplicantSelector;

