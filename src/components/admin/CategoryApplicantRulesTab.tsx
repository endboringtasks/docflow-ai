import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus, Trash2, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface ApplicationCategory {
  id: string;
  code: string;
  name: string;
  country_id: string | null;
}

interface ApplicationSubcategory {
  id: string;
  code: string;
  name: string;
  category_id: string;
}

interface ApplicantType {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface CategoryApplicantType {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  applicant_type_id: string;
  is_required: boolean;
  allow_multiple: boolean;
  min_count: number;
  max_count: number | null;
  sort_order: number;
  applicant_type?: ApplicantType;
}

export function CategoryApplicantRulesTab() {
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CategoryApplicantType | null>(null);
  const [deleteRule, setDeleteRule] = useState<CategoryApplicantType | null>(null);
  const [form, setForm] = useState({
    applicant_type_id: "",
    is_required: false,
    allow_multiple: false,
    min_count: 0,
    max_count: null as number | null,
    sort_order: 0,
  });

  // Fetch categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ["admin-categories-for-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_categories")
        .select("id, code, name, country_id")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ApplicationCategory[];
    },
  });

  // Fetch subcategories for selected category
  const { data: subcategories = [] } = useQuery({
    queryKey: ["admin-subcategories-for-rules", selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return [];
      const { data, error } = await supabase
        .from("application_subcategories")
        .select("id, code, name, category_id")
        .eq("category_id", selectedCategoryId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ApplicationSubcategory[];
    },
    enabled: !!selectedCategoryId,
  });

  // Fetch applicant types
  const { data: applicantTypes = [], isLoading: isLoadingTypes } = useQuery({
    queryKey: ["admin-applicant-types-for-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_types")
        .select("id, code, name, is_active")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ApplicantType[];
    },
  });

  // Fetch category applicant rules for selected category/subcategory
  const { data: rules = [], isLoading: isLoadingRules } = useQuery({
    queryKey: ["category-applicant-rules-admin", selectedCategoryId, selectedSubcategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return [];
      
      let query = supabase
        .from("category_applicant_types")
        .select("*, applicant_type:applicant_types(id, code, name, is_active)")
        .eq("category_id", selectedCategoryId)
        .order("sort_order");
      
      // Filter by subcategory - either exact match or null for "all subcategories"
      if (selectedSubcategoryId === null) {
        query = query.is("subcategory_id", null);
      } else {
        query = query.eq("subcategory_id", selectedSubcategoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CategoryApplicantType[];
    },
    enabled: !!selectedCategoryId,
  });

  // Available applicant types (not yet added to this category)
  const availableTypes = applicantTypes.filter(
    (at) => !rules.some((r) => r.applicant_type_id === at.id)
  );

  const saveMutation = useMutation({
    mutationFn: async (data: {
      category_id: string;
      subcategory_id: string | null;
      applicant_type_id: string;
      is_required: boolean;
      allow_multiple: boolean;
      min_count: number;
      max_count: number | null;
      sort_order: number;
    }) => {
      if (editingRule) {
        const { error } = await supabase
          .from("category_applicant_types")
          .update({
            is_required: data.is_required,
            allow_multiple: data.allow_multiple,
            min_count: data.min_count,
            max_count: data.max_count,
            sort_order: data.sort_order,
          })
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("category_applicant_types").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-applicant-rules-admin", selectedCategoryId, selectedSubcategoryId] });
      toast.success(editingRule ? "Rule updated" : "Applicant type added to category");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_applicant_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-applicant-rules-admin", selectedCategoryId, selectedSubcategoryId] });
      toast.success("Applicant type removed from category");
      setDeleteRule(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CategoryApplicantType> }) => {
      const { error } = await supabase
        .from("category_applicant_types")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-applicant-rules-admin", selectedCategoryId, selectedSubcategoryId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openAddDialog = () => {
    setEditingRule(null);
    setForm({
      applicant_type_id: availableTypes[0]?.id || "",
      is_required: false,
      allow_multiple: false,
      min_count: 0,
      max_count: null,
      sort_order: (rules.length || 0) * 10,
    });
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (rule: CategoryApplicantType) => {
    setEditingRule(rule);
    setForm({
      applicant_type_id: rule.applicant_type_id,
      is_required: rule.is_required,
      allow_multiple: rule.allow_multiple,
      min_count: rule.min_count,
      max_count: rule.max_count,
      sort_order: rule.sort_order,
    });
    setIsAddDialogOpen(true);
  };

  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditingRule(null);
  };

  const handleSave = () => {
    if (!editingRule && !form.applicant_type_id) {
      toast.error("Please select an applicant type");
      return;
    }
    saveMutation.mutate({
      category_id: selectedCategoryId,
      subcategory_id: selectedSubcategoryId,
      applicant_type_id: form.applicant_type_id,
      is_required: form.is_required,
      allow_multiple: form.allow_multiple,
      min_count: form.min_count,
      max_count: form.max_count,
      sort_order: form.sort_order,
    });
  };

  const handleToggleRequired = (rule: CategoryApplicantType) => {
    updateRuleMutation.mutate({
      id: rule.id,
      updates: { 
        is_required: !rule.is_required,
        min_count: !rule.is_required ? 1 : 0,
      },
    });
  };

  const handleToggleMultiple = (rule: CategoryApplicantType) => {
    updateRuleMutation.mutate({
      id: rule.id,
      updates: { allow_multiple: !rule.allow_multiple },
    });
  };

  if (isLoadingCategories || isLoadingTypes) {
    return <Skeleton className="h-64 w-full" />;
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find((s) => s.id === selectedSubcategoryId);
  const scopeLabel = selectedSubcategoryId 
    ? `${selectedCategory?.name} → ${selectedSubcategory?.name}`
    : `${selectedCategory?.name} (all subcategories)`;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Configure which applicant types are required or optional for each application category and subcategory.
          </p>
          <p className="text-xs text-muted-foreground">
            Select "All Subcategories" to set default rules for the category. Rules for specific subcategories override the defaults.
          </p>
        </div>
      </div>

      {/* Category and Subcategory Selectors */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-64">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Category</Label>
          <Select 
            value={selectedCategoryId} 
            onValueChange={(value) => {
              setSelectedCategoryId(value);
              setSelectedSubcategoryId(null); // Reset subcategory when category changes
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {selectedCategoryId && (
          <div className="w-64">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Subcategory</Label>
            <Select 
              value={selectedSubcategoryId ?? "__all__"} 
              onValueChange={(value) => setSelectedSubcategoryId(value === "__all__" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subcategory..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  All Subcategories (default)
                </SelectItem>
                {subcategories.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {selectedCategoryId && (
          <div className="flex items-end">
            <Button onClick={openAddDialog} size="sm" disabled={availableTypes.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add Applicant Type
            </Button>
          </div>
        )}
      </div>

      {/* Rules Table */}
      {selectedCategoryId ? (
        isLoadingRules ? (
          <Skeleton className="h-48 w-full" />
        ) : rules.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <Settings2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No Applicant Types Configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add applicant types to define which roles are required or optional for{" "}
              <strong>{scopeLabel}</strong>.
            </p>
            {availableTypes.length > 0 ? (
              <Button onClick={openAddDialog} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add First Applicant Type
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                No applicant types available. Create some in the "Applicant Types" tab first.
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Order</TableHead>
                <TableHead>Applicant Type</TableHead>
                <TableHead className="w-24 text-center">Required</TableHead>
                <TableHead className="w-32 text-center">Allow Multiple</TableHead>
                <TableHead className="w-20 text-center">Min</TableHead>
                <TableHead className="w-20 text-center">Max</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="text-muted-foreground">{rule.sort_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.applicant_type?.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {rule.applicant_type?.code}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.is_required}
                      onCheckedChange={() => handleToggleRequired(rule)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.allow_multiple}
                      onCheckedChange={() => handleToggleMultiple(rule)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      value={rule.min_count}
                      onChange={(e) =>
                        updateRuleMutation.mutate({
                          id: rule.id,
                          updates: { min_count: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-16 h-8 text-center"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      value={rule.max_count ?? ""}
                      placeholder="∞"
                      onChange={(e) =>
                        updateRuleMutation.mutate({
                          id: rule.id,
                          updates: { max_count: e.target.value ? parseInt(e.target.value) : null },
                        })
                      }
                      className="w-16 h-8 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteRule(rule)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : (
        <div className="border rounded-lg p-8 text-center">
          <Settings2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Select a Category</h3>
          <p className="text-sm text-muted-foreground">
            Choose an application category above to configure its required applicant types.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Applicant Type Rule" : "Add Applicant Type to Category"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? `Update settings for ${editingRule.applicant_type?.name}`
                : `Configure how this applicant type applies to ${scopeLabel}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingRule && (
              <div className="space-y-2">
                <Label>Applicant Type</Label>
                <Select
                  value={form.applicant_type_id}
                  onValueChange={(value) => setForm({ ...form, applicant_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select applicant type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_required}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_required: checked, min_count: checked ? 1 : 0 })
                  }
                />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.allow_multiple}
                  onCheckedChange={(checked) => setForm({ ...form, allow_multiple: checked })}
                />
                <Label>Allow Multiple</Label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Min Count</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_count}
                  onChange={(e) => setForm({ ...form, min_count: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Count</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={form.max_count ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, max_count: e.target.value ? parseInt(e.target.value) : null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRule ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRule} onOpenChange={() => setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Applicant Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteRule?.applicant_type?.name}" from{" "}
              {selectedCategory?.name}? This will not affect existing applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRule && deleteMutation.mutate(deleteRule.id)}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
