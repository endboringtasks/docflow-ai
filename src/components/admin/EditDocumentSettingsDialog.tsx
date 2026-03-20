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
import { Loader2 } from "lucide-react";
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

export function EditDocumentSettingsDialog({
  open,
  onOpenChange,
  template,
  visaTypeId,
}: EditDocumentSettingsDialogProps) {
  const queryClient = useQueryClient();

  const [applicantTypeId, setApplicantTypeId] = useState<string>("all");
  const [requirementType, setRequirementType] = useState("required");
  const [ageCondition, setAgeCondition] = useState("");
  const [applicabilityCondition, setApplicabilityCondition] = useState("");
  const [minFiles, setMinFiles] = useState(1);
  const [maxFiles, setMaxFiles] = useState(1);
  const [requiresTranslation, setRequiresTranslation] = useState(false);
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState("English");
  const [translationCertTypeId, setTranslationCertTypeId] = useState<string>("none");
  const [translationNotes, setTranslationNotes] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (template) {
      setApplicantTypeId(template.applicant_type_id || "all");
      setRequirementType(template.requirement_type || "required");
      setAgeCondition(template.age_condition || "");
      setApplicabilityCondition(template.applicability_condition || "");
      setMinFiles(template.min_files ?? 1);
      setMaxFiles(template.max_files ?? 1);
      setRequiresTranslation(template.requires_translation ?? false);
      setTranslationTargetLanguage(template.translation_target_language || "English");
      setTranslationCertTypeId(template.translation_certification_type_id || "none");
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
          applicant_type_id: applicantTypeId === "all" ? null : applicantTypeId,
          requirement_type: requirementType as any,
          age_condition: ageCondition || null,
          applicability_condition: applicabilityCondition || null,
          min_files: minFiles,
          max_files: maxFiles,
          requires_translation: requiresTranslation,
          translation_target_language: requiresTranslation ? translationTargetLanguage || null : null,
          translation_certification_type_id: requiresTranslation && translationCertTypeId !== "none" ? translationCertTypeId : null,
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

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Document Settings</DialogTitle>
          <DialogDescription>
            {template.document_name}
            {template.category ? ` — ${template.category}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Applicant Type</Label>
              <Select value={applicantTypeId} onValueChange={setApplicantTypeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {applicantTypes?.map((at) => (
                    <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Requirement Type</Label>
              <Select value={requirementType} onValueChange={setRequirementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Age Condition</Label>
              <Input
                placeholder="e.g. under_18, over_18"
                value={ageCondition}
                onChange={(e) => setAgeCondition(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Applicability Condition</Label>
              <Input
                placeholder="e.g. married, has_children"
                value={applicabilityCondition}
                onChange={(e) => setApplicabilityCondition(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Min Files</Label>
              <Input
                type="number"
                min={0}
                value={minFiles}
                onChange={(e) => setMinFiles(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Files</Label>
              <Input
                type="number"
                min={1}
                value={maxFiles}
                onChange={(e) => setMaxFiles(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={requiresTranslation}
              onCheckedChange={setRequiresTranslation}
            />
            <Label>Requires Translation</Label>
          </div>

          {requiresTranslation && (
            <div className="space-y-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Language</Label>
                  <Input
                    value={translationTargetLanguage}
                    onChange={(e) => setTranslationTargetLanguage(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Certification Type</Label>
                  <Select value={translationCertTypeId} onValueChange={setTranslationCertTypeId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {certTypes?.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Translation Notes</Label>
                <Textarea
                  placeholder="Additional notes about translation requirements..."
                  value={translationNotes}
                  onChange={(e) => setTranslationNotes(e.target.value)}
                  rows={2}
                />
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
