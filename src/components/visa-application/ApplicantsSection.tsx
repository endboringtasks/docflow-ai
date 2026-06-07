import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, User, Users, X, Loader2, FileText, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
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
  created_at: string;
  applicant_type: ApplicantType;
  displayName: string;
  documentCount: number;
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
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedRelatedApplicantId, setSelectedRelatedApplicantId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<ApplicationApplicant | null>(null);

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

  // Fetch application applicants (excluding soft-deleted) with per-applicant document counts
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
          created_at,
          applicant_type:applicant_types(id, code, name)
        `)
        .eq("visa_application_id", visaApplicationId)
        .is("deleted_at", null)
        .order("sort_order");
      if (error) throw error;

      const applicantIds = (data || []).map((a) => a.id);
      const countByApplicant: Record<string, number> = {};
      if (applicantIds.length > 0) {
        const { data: docs } = await supabase
          .from("document_checklist")
          .select("application_applicant_id")
          .in("application_applicant_id", applicantIds);
        (docs || []).forEach((d) => {
          if (d.application_applicant_id) {
            countByApplicant[d.application_applicant_id] =
              (countByApplicant[d.application_applicant_id] || 0) + 1;
          }
        });
      }

      return (data || []).map((applicant) => {
        let displayName = "";
        if (applicant.is_primary) {
          displayName = getPrimaryClientName();
        } else if (applicant.related_applicant_id) {
          const relatedPerson = relatedApplicants.find(
            (ra) => ra.id === applicant.related_applicant_id
          );
          if (relatedPerson) {
            displayName = `${relatedPerson.first_name || ""} ${relatedPerson.last_name || ""}`.trim();
          }
        }
        return {
          ...applicant,
          displayName: displayName || applicant.applicant_type?.name || "Unknown",
          documentCount: countByApplicant[applicant.id] || 0,
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
      const rulesByType = new Map<string, (typeof rules)[0]>();
      rules
        .filter((r) => r.subcategory_id === null)
        .forEach((r) => rulesByType.set(r.applicant_type_id, r));
      rules
        .filter((r) => r.subcategory_id === subcategoryId)
        .forEach((r) => rulesByType.set(r.applicant_type_id, r));
      return Array.from(rulesByType.values()).sort((a, b) => a.sort_order - b.sort_order);
    },
    enabled: !!categoryId,
  });

  // Available applicant types (types that can still be added)
  const availableApplicantTypes = categoryRules.filter((rule) => {
    if (rule.applicant_type?.code === "primary") return false;
    const existingCount = applicationApplicants.filter(
      (a) => a.applicant_type_id === rule.applicant_type_id
    ).length;
    if (rule.max_count !== null && existingCount >= rule.max_count) return false;
    return true;
  });

  const getAvailableRelatedApplicants = () => {
    if (!selectedTypeId) return [];
    const rule = categoryRules.find((r) => r.applicant_type_id === selectedTypeId);
    if (!rule) return [];
    const typeMapping: Record<string, string> = {
      partner: "partner",
      dependant: "dependant",
      witness: "witness",
    };
    const typeCode = rule.applicant_type?.code?.toLowerCase() || "";
    const matchingType = typeMapping[typeCode];
    if (!matchingType) return [];
    const applicantsOfType = relatedApplicants.filter((a) => a.type === matchingType);
    const existingIds = applicationApplicants
      .filter((a) => a.applicant_type_id === selectedTypeId)
      .map((a) => a.related_applicant_id);
    return applicantsOfType.filter((a) => !existingIds.includes(a.id));
  };

  const writeTimeline = async (
    eventType: string,
    entityId: string | null,
    description: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ) => {
    await supabase.from("application_timeline").insert({
      visa_application_id: visaApplicationId,
      company_id: companyId,
      event_type: eventType,
      entity_type: "applicant",
      entity_id: entityId,
      actor_id: user?.id ?? null,
      description,
      old_values: oldValues as never,
      new_values: newValues as never,
    });
  };

  // Add applicant mutation
  const addApplicantMutation = useMutation({
    mutationFn: async ({
      relatedApplicantId,
      applicantTypeId,
    }: {
      relatedApplicantId: string;
      applicantTypeId: string;
    }) => {
      const typeName =
        categoryRules.find((r) => r.applicant_type_id === applicantTypeId)?.applicant_type?.name ||
        "Applicant";
      const person = relatedApplicants.find((p) => p.id === relatedApplicantId);
      const personName = person
        ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
        : typeName;

      const { data: inserted, error } = await supabase
        .from("application_applicants")
        .insert({
          visa_application_id: visaApplicationId,
          client_id: primaryClientId,
          applicant_type_id: applicantTypeId,
          is_primary: false,
          sort_order: (applicationApplicants.length + 1) * 10,
          related_applicant_id: relatedApplicantId,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await writeTimeline(
        "applicant_added",
        inserted.id,
        `Added ${personName} as ${typeName}`,
        null,
        { name: personName, applicant_type: typeName }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-applicants", visaApplicationId] });
      queryClient.invalidateQueries({ queryKey: ["application-timeline", visaApplicationId] });
      setIsAddOpen(false);
      setSelectedTypeId("");
      setSelectedRelatedApplicantId("");
      toast.success("Applicant added");
    },
    onError: (error: { message?: string }) => {
      const msg = error?.message || "";
      if (msg.includes("uniq_app_primary_applicant")) {
        toast.error("This application already has a Primary Applicant.");
      } else if (msg.includes("uniq_app_applicant_type")) {
        toast.error("This application already has this applicant type.");
      } else if (msg.includes("uniq_app_related_person")) {
        toast.error("This client is already added to this application.");
      } else {
        toast.error("Failed to add applicant", { description: msg });
      }
    },
  });

  // Remove applicant mutation (soft delete + guard)
  const removeApplicantMutation = useMutation({
    mutationFn: async (applicant: ApplicationApplicant) => {
      const typeName = applicant.applicant_type?.name || "Applicant";

      if (applicant.documentCount > 0) {
        await writeTimeline(
          "applicant_remove_blocked",
          applicant.id,
          `Blocked removal of ${applicant.displayName} (${typeName}) — ${applicant.documentCount} document(s) attached`,
          { name: applicant.displayName, applicant_type: typeName, document_count: applicant.documentCount },
          null
        );
        throw new Error("DOCUMENTS_ATTACHED");
      }

      const { error } = await supabase
        .from("application_applicants")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq("id", applicant.id);
      if (error) throw error;

      await writeTimeline(
        "applicant_removed",
        applicant.id,
        `Removed ${applicant.displayName} (${typeName})`,
        { name: applicant.displayName, applicant_type: typeName },
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-applicants", visaApplicationId] });
      queryClient.invalidateQueries({ queryKey: ["application-timeline", visaApplicationId] });
      setRemoveTarget(null);
      toast.success("Applicant removed");
    },
    onError: (error: { message?: string }) => {
      if (error?.message === "DOCUMENTS_ATTACHED") {
        queryClient.invalidateQueries({ queryKey: ["application-timeline", visaApplicationId] });
        toast.error("This applicant cannot be removed because documents are attached.");
        return;
      }
      toast.error("Failed to remove applicant", { description: error?.message });
    },
  });

  const handleAddApplicant = () => {
    if (!selectedTypeId) {
      toast.error("Please select an applicant type.");
      return;
    }
    if (!selectedRelatedApplicantId) {
      toast.error("Please select a client.");
      return;
    }
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

  // Group & order: Primary -> Partner -> Dependants (dependants by created_at)
  const rank = (a: ApplicationApplicant) => {
    const code = a.applicant_type?.code?.toLowerCase();
    if (a.is_primary || code === "primary") return 0;
    if (code === "partner") return 1;
    if (code === "dependant") return 2;
    return 3;
  };
  const orderedApplicants = [...applicationApplicants].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const removeHasDocuments = (removeTarget?.documentCount ?? 0) > 0;

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
          {orderedApplicants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No applicants added yet.</p>
          ) : (
            orderedApplicants.map((applicant) => (
              <div
                key={applicant.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{applicant.displayName}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {applicant.applicant_type?.name || "Unknown Type"}
                      </span>
                      {applicant.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {applicant.documentCount} doc{applicant.documentCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {applicant.created_at && !isNaN(new Date(applicant.created_at).getTime())
                          ? format(new Date(applicant.created_at), "dd MMM yyyy")
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                {!applicant.is_primary && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveTarget(applicant)}
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
                      No available{" "}
                      {categoryRules
                        .find((r) => r.applicant_type_id === selectedTypeId)
                        ?.applicant_type?.name?.toLowerCase() || "persons"}{" "}
                      in client's profile
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
              disabled={
                !selectedRelatedApplicantId || !selectedTypeId || addApplicantMutation.isPending
              }
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

      {/* Remove Applicant Confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeHasDocuments ? "Cannot remove applicant" : "Remove applicant"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removeHasDocuments ? (
                <span className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                  This applicant cannot be removed because documents are attached. Please remove or
                  reassign the documents first.
                </span>
              ) : (
                "Are you sure you want to remove this applicant from the application?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!removeHasDocuments && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (removeTarget) removeApplicantMutation.mutate(removeTarget);
                }}
                disabled={removeApplicantMutation.isPending}
              >
                {removeApplicantMutation.isPending ? "Removing..." : "Remove"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ApplicantsSection;
