import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { NationalitySelect } from "@/components/ui/nationality-select";

interface RelatedApplicantFormData {
  type: "partner" | "dependant" | "witness";
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  passport_number?: string;
  nationality?: string;
  relationship: string;
}

interface AddRelatedApplicantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (applicant: RelatedApplicantFormData) => void;
  isLoading?: boolean;
  mode?: "add" | "edit";
  initialData?: RelatedApplicantFormData;
}

const RELATIONSHIP_OPTIONS: Record<"partner" | "dependant" | "witness", string[]> = {
  partner: ["Spouse", "De facto partner"],
  dependant: ["Child", "Step-child", "Adopted child"],
  witness: ["Witness"],
};

const DEFAULT_FORM: RelatedApplicantFormData = {
  type: "partner",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  passport_number: "",
  nationality: "",
  relationship: "Spouse",
};

const AddRelatedApplicantDialog = ({
  open,
  onOpenChange,
  onAdd,
  isLoading = false,
  mode = "add",
  initialData,
}: AddRelatedApplicantDialogProps) => {
  const [form, setForm] = useState<RelatedApplicantFormData>(DEFAULT_FORM);

  // Reset form when dialog opens — pre-fill if editing
  useEffect(() => {
    if (open) {
      setForm(initialData ?? DEFAULT_FORM);
    }
  }, [open, initialData]);

  // Update relationship when type changes
  const handleTypeChange = (type: "partner" | "dependant" | "witness") => {
    const defaultRelationship = RELATIONSHIP_OPTIONS[type][0];
    setForm(prev => ({
      ...prev,
      type,
      relationship: defaultRelationship,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.first_name.trim() || !form.last_name.trim()) return;

    onAdd({
      type: form.type,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || undefined,
      passport_number: form.passport_number?.trim() || undefined,
      nationality: form.nationality?.trim() || undefined,
      relationship: form.relationship,
    });
  };

  const isValid = form.first_name.trim() && form.last_name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Related Applicant" : "Add Related Applicant"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the details for this related applicant."
              : "Add a partner, dependant, or witness to this client's profile."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => handleTypeChange(v as "partner" | "dependant" | "witness")}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="dependant">Dependant</SelectItem>
                <SelectItem value="witness">Witness</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* First Name */}
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input
              value={form.first_name}
              onChange={(e) => setForm(prev => ({ ...prev, first_name: e.target.value }))}
              placeholder="Enter first name"
              className="bg-secondary border-border"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input
              value={form.last_name}
              onChange={(e) => setForm(prev => ({ ...prev, last_name: e.target.value }))}
              placeholder="Enter last name"
              className="bg-secondary border-border"
            />
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
              className="bg-secondary border-border"
            />
          </div>

          {/* Passport Number */}
          <div className="space-y-2">
            <Label>Passport Number</Label>
            <Input
              value={form.passport_number}
              onChange={(e) => setForm(prev => ({ ...prev, passport_number: e.target.value }))}
              placeholder="Enter passport number"
              className="bg-secondary border-border"
            />
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <Label>Nationality</Label>
            <NationalitySelect
              value={form.nationality}
              onValueChange={(value) => setForm(prev => ({ ...prev, nationality: value }))}
              placeholder="Select nationality..."
            />
          </div>

          {/* Relationship */}
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select value={form.relationship} onValueChange={(v) => setForm(prev => ({ ...prev, relationship: v }))}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS[form.type].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "edit" ? "Save Changes" : "Add Applicant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddRelatedApplicantDialog;
