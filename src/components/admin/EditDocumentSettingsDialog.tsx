import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Loader2, Languages, CheckSquare } from "lucide-react";
import { toast } from "sonner";

interface DocumentTemplate {
  id: string;
  document_name: string;
  category: string | null;
  applicant_type_id: string | null;
  requirement_type: string;
  age_condition: string | null;
  applicability_condition: string | null;
  min_files: number;
  max_files: number | null;
  requires_translation: boolean;
  translation_target_language: string | null;
  translation_certification_type_id: string | null;
  translation_notes: string | null;
  sort_order: number | null;
}

interface EditDocumentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: DocumentTemplate | null;
  visaTypeId: string;
}

const PRESET_CONDITIONS = [
  "If previously married",
  "If spouse/partner deceased",
  "If divorced",
  "If widowed",
  "If changed name",
  "If self-employed",
  "If has children",
  "If served in armed forces",
  "If adopted",
  "If custody arrangements exist",
  "If owns property",
  "If previously refused visa",
];

export function EditDocumentSettingsDialog({
  open,
  onOpenChange,
  template,
  visaTypeId,
}: EditDocumentSettingsDialogProps) {
  const queryClient = useQueryClient();

  const [applicantTypeId, setApplicantTypeId] = useState<string>("__none__");
  const [requirementType, setRequirementType] = useState("required");
  const [ageCondition, setAgeCondition] = useState("");
  const [applicabilityCondition, setApplicabilityCondition] = useState("");
  const [minFiles, setMinFiles] = useState(1);
  const [maxFiles, setMaxFiles] = useState(1);
  const [requiresTranslation, setRequiresTranslation] = useState(false);
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState("English");
  const [translationCertTypeId, setTranslationCertTypeId] = useState<string>("__none__");
  const [translationNotes, setTranslationNotes] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (template) {
      setApplicantTypeId(template.applicant_type_id || "__none__");
      setRequirementType(template.requirement_type || "required");
      setAgeCondition(template.age_condition || "");
      setApplicabilityCondition(template.applicability_condition || "");
      setMinFiles(template.min_files ?? 1);
      setMaxFiles(template.max_files ?? 1);
      setRequiresTranslation(template.requires_translation ?? false);
      setTranslationTargetLanguage(template.translation_target_language || "English");
      setTranslationCertTypeId(template.translation_certification_type_id || "__none__");
      setTranslationNotes(template.translation_notes || "");
      setSortOrder(template.sort_order ?? 0);
    }
  }, [template]);

  const { data: applicantTypes } = useQuery({
    queryKey: ["admin-applicant-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_types")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: certTypes } = useQuery({
    queryKey: ["admin-cert-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("translation_certification_types")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!template) return;
      const { error } = await supabase
        .from("document_checklist_templates")
        .update({
          applicant_type_id: applicantTypeId === "__none__" ? null : applicantTypeId,
          requirement_type: requirementType as any,
          age_condition: ageCondition || null,
          applicability_condition: applicabilityCondition || null,
          min_files: minFiles,
          max_files: maxFiles,
          requires_translation: requiresTranslation,
          translation_target_language: requiresTranslation ? translationTargetLanguage || null : null,
          translation_certification_type_id: requiresTranslation && translationCertTypeId !== "__none__" ? translationCertTypeId : null,
          translation_notes: requiresTranslation ? translationNotes || null : null,
          sort_order: sortOrder,
        })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-checklist-linked", visaTypeId] });
      onOpenChange(false);
      toast.success("Document settings updated");
    },
    onError: (err: any) => toast.error("Failed to update: " + err.message),
  });

  const isCustomCondition = applicabilityCondition !== "" && !PRESET_CONDITIONS.includes(applicabilityCondition);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Document Settings</DialogTitle>
          <DialogDescription>
            Configure rules for this document template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only: Category + Document Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={template.category || "—"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input value={template.document_name} disabled />
            </div>
          </div>

          {/* Sort Order */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Applicant Type + Age Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Applicant Type</Label>
              <Select value={applicantTypeId} onValueChange={setApplicantTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select applicant type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific type</SelectItem>
                  {applicantTypes?.map((at) => (
                    <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age Condition</Label>
              <Input
                value={ageCondition}
                onChange={(e) => setAgeCondition(e.target.value)}
                placeholder="e.g., +16yrs, Under 18"
              />
            </div>
          </div>

          {/* Min Files / Max Files */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Files Required</Label>
              <Input
                type="number"
                min={1}
                value={minFiles}
                onChange={(e) => setMinFiles(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground">
                Minimum number of files clients must upload
              </p>
            </div>
            <div className="space-y-2">
              <Label>Max Files Allowed</Label>
              <Input
                type="number"
                min={minFiles}
                value={maxFiles}
                onChange={(e) => setMaxFiles(Math.max(minFiles, parseInt(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of files clients can upload
              </p>
            </div>
          </div>

          {/* Requirement Type */}
          <div className="space-y-2">
            <Label>Requirement Type</Label>
            <Select value={requirementType} onValueChange={setRequirementType}>
              <SelectTrigger>
                <SelectValue placeholder="Select requirement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="conditional">If Applicable</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {requirementType === "required" && "Document is mandatory for all applications"}
              {requirementType === "conditional" && "Document is only required in specific situations"}
              {requirementType === "optional" && "Document is not required but may support the application"}
            </p>
          </div>

          {/* Conditional: Applicability Condition */}
          {requirementType === "conditional" && (
            <div className="space-y-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <Label className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-600" />
                When is this document required?
              </Label>
              <Select
                value={PRESET_CONDITIONS.includes(applicabilityCondition) ? applicabilityCondition : "__custom__"}
                onValueChange={(value) => setApplicabilityCondition(value === "__custom__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or type a condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">+ Custom Condition</SelectItem>
                  {PRESET_CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(applicabilityCondition === "" || isCustomCondition) && (
                <Input
                  value={applicabilityCondition}
                  onChange={(e) => setApplicabilityCondition(e.target.value)}
                  placeholder="e.g., If previously married"
                  className="mt-2"
                />
              )}
              <p className="text-xs text-muted-foreground">
                This condition will be shown to staff and clients to indicate when this document is needed
              </p>
            </div>
          )}

          {/* Translation toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={requiresTranslation}
              onCheckedChange={setRequiresTranslation}
            />
            <Label>Requires Translation</Label>
          </div>

          {/* Translation section */}
          {requiresTranslation && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium flex items-center gap-2">
                <Languages className="w-4 h-4" />
                Translation Requirements
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Language</Label>
                  <Select value={translationTargetLanguage} onValueChange={setTranslationTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                      <SelectItem value="Portuguese">Portuguese</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                      <SelectItem value="German">German</SelectItem>
                      <SelectItem value="Italian">Italian</SelectItem>
                      <SelectItem value="Chinese">Chinese</SelectItem>
                      <SelectItem value="Japanese">Japanese</SelectItem>
                      <SelectItem value="Korean">Korean</SelectItem>
                      <SelectItem value="Arabic">Arabic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Certification Type</Label>
                  <Select value={translationCertTypeId} onValueChange={setTranslationCertTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select certification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any Certified Translator</SelectItem>
                      {certTypes?.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Translation Notes / Instructions</Label>
                <Textarea
                  value={translationNotes}
                  onChange={(e) => setTranslationNotes(e.target.value)}
                  placeholder="Any specific translation requirements..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  These notes will be visible to staff managing document collection
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
