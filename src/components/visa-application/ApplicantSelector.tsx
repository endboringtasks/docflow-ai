import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Users } from "lucide-react";

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
    clients: string[]; // Array of client IDs
  };
}

interface ApplicantSelectorProps {
  categoryId: string;
  primaryClientId: string;
  clients: Client[];
  selections: ApplicantSelection;
  onSelectionsChange: (selections: ApplicantSelection) => void;
}

const getClientName = (client: Client) => {
  if (client.client_type === "corporate") {
    return client.company_name || "Unnamed Company";
  }
  return client.last_name 
    ? `${client.first_name} ${client.last_name}` 
    : (client.first_name || "Unnamed Client");
};

export const ApplicantSelector = ({
  categoryId,
  primaryClientId,
  clients,
  selections,
  onSelectionsChange,
}: ApplicantSelectorProps) => {
  // Fetch category applicant rules
  const { data: categoryApplicantRules = [], isLoading } = useQuery({
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

  // Get primary client object
  const primaryClient = clients.find(c => c.id === primaryClientId);

  // Filter out non-primary rules for UI
  const nonPrimaryRules = categoryApplicantRules.filter(
    rule => rule.applicant_type?.code !== "primary"
  );

  // Get primary rule
  const primaryRule = categoryApplicantRules.find(
    rule => rule.applicant_type?.code === "primary"
  );

  // Get available clients (exclude already selected ones for the current type)
  const getAvailableClients = (typeId: string, currentIndex: number) => {
    const selectedInType = selections[typeId]?.clients || [];
    return clients.filter(c => {
      // Don't show primary client in other selections
      if (c.id === primaryClientId) return false;
      // Don't show if already selected at a different index in this type
      const indexOfClient = selectedInType.indexOf(c.id);
      return indexOfClient === -1 || indexOfClient === currentIndex;
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
      {primaryRule && primaryClient && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Primary Applicant</Label>
            <Badge variant="secondary" className="text-xs">Required</Badge>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{getClientName(primaryClient)}</span>
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

            {/* Client Selection Dropdowns */}
            {(selection.enabled || isRequired || selection.clients.length > 0) && (
              <div className="space-y-2 pl-4">
                {(selection.clients.length > 0 ? selection.clients : [""]).map((clientId, index) => {
                  // Only show if enabled or required
                  if (!selection.enabled && !isRequired && selection.clients.length === 0) return null;
                  if (!selection.enabled && !isRequired && index >= selection.clients.length) return null;
                  
                  const availableClients = getAvailableClients(typeId, index);
                  
                  return (
                    <div key={index} className="flex items-center gap-2">
                      {allowMultiple && selection.clients.length > 1 && (
                        <span className="text-xs text-muted-foreground w-6">
                          #{index + 1}
                        </span>
                      )}
                      <Select
                        value={clientId || ""}
                        onValueChange={(value) => handleClientSelect(typeId, index, value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={`Select ${rule.applicant_type?.name?.toLowerCase() || 'client'}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {getClientName(client)}
                            </SelectItem>
                          ))}
                          {availableClients.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No available clients
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

