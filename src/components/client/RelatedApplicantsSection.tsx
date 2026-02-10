import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Trash2, Calendar, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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
import AddRelatedApplicantDialog from "./AddRelatedApplicantDialog";

export interface RelatedApplicant {
  id: string;
  type: "partner" | "dependant" | "witness";
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  passport_number?: string;
  nationality?: string;
  relationship: string;
}

interface RelatedApplicantsSectionProps {
  clientId: string;
  relatedApplicants: RelatedApplicant[];
  companyId?: string;
}

const getTypeColor = (type: RelatedApplicant["type"]) => {
  switch (type) {
    case "partner":
      return "default";
    case "dependant":
      return "secondary";
    case "witness":
      return "outline";
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const RelatedApplicantsSection = ({
  clientId,
  relatedApplicants,
  companyId,
}: RelatedApplicantsSectionProps) => {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [applicantToDelete, setApplicantToDelete] = useState<RelatedApplicant | null>(null);
  const [applicantToEdit, setApplicantToEdit] = useState<RelatedApplicant | null>(null);

  // Remove related applicant mutation
  const removeApplicantMutation = useMutation({
    mutationFn: async (applicantId: string) => {
      const updatedApplicants = relatedApplicants.filter(a => a.id !== applicantId);
      
      const { error } = await supabase
        .from("clients")
        .update({ related_applicants: updatedApplicants as unknown as Json })
        .eq("id", clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ["clients", companyId] });
      }
      setApplicantToDelete(null);
      toast.success("Related applicant removed");
    },
    onError: (error) => {
      toast.error("Failed to remove applicant", {
        description: error.message,
      });
    },
  });

  // Add related applicant mutation
  const addApplicantMutation = useMutation({
    mutationFn: async (newApplicant: RelatedApplicant) => {
      const updatedApplicants = [...relatedApplicants, newApplicant];
      
      const { error } = await supabase
        .from("clients")
        .update({ related_applicants: updatedApplicants as unknown as Json })
        .eq("id", clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ["clients", companyId] });
      }
      setIsAddDialogOpen(false);
      toast.success("Related applicant added");
    },
    onError: (error) => {
      toast.error("Failed to add applicant", {
        description: error.message,
      });
    },
  });

  // Edit related applicant mutation
  const editApplicantMutation = useMutation({
    mutationFn: async (updatedApplicant: RelatedApplicant) => {
      const updatedApplicants = relatedApplicants.map(a =>
        a.id === updatedApplicant.id ? updatedApplicant : a
      );

      const { error } = await supabase
        .from("clients")
        .update({ related_applicants: updatedApplicants as unknown as Json })
        .eq("id", clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ["clients", companyId] });
      }
      setApplicantToEdit(null);
      toast.success("Related applicant updated");
    },
    onError: (error) => {
      toast.error("Failed to update applicant", {
        description: error.message,
      });
    },
  });

  const handleAddApplicant = (applicant: Omit<RelatedApplicant, "id">) => {
    const newApplicant: RelatedApplicant = {
      ...applicant,
      id: crypto.randomUUID(),
    };
    addApplicantMutation.mutate(newApplicant);
  };

  const handleEditApplicant = (applicant: Omit<RelatedApplicant, "id">) => {
    if (!applicantToEdit) return;
    editApplicantMutation.mutate({ ...applicant, id: applicantToEdit.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Related Applicants</h2>
        <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      {relatedApplicants.length === 0 ? (
        <div className="card-gradient rounded-xl border border-border/50 p-6 text-center">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">No Related Applicants</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add partner, dependants, or witnesses to this client's profile.
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Applicant
          </Button>
        </div>
      ) : (
        <div className="card-gradient rounded-xl border border-border/50 divide-y divide-border/50">
          {relatedApplicants.map((applicant) => (
            <div key={applicant.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {applicant.first_name} {applicant.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getTypeColor(applicant.type)} className="capitalize text-xs">
                      {applicant.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{applicant.relationship}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    {applicant.date_of_birth && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(applicant.date_of_birth)}
                      </span>
                    )}
                    {applicant.passport_number && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {applicant.passport_number}
                      </span>
                    )}
                    {applicant.nationality && (
                      <span>{applicant.nationality}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                  onClick={() => setApplicantToEdit(applicant)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => setApplicantToDelete(applicant)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <AddRelatedApplicantDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddApplicant}
        isLoading={addApplicantMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!applicantToDelete} onOpenChange={() => setApplicantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Related Applicant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {applicantToDelete?.first_name} {applicantToDelete?.last_name} from this client's profile? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => applicantToDelete && removeApplicantMutation.mutate(applicantToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeApplicantMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RelatedApplicantsSection;
