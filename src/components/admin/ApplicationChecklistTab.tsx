import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export default function ApplicationChecklistTab() {
  const queryClient = useQueryClient();

  // Filter state
  const [countryId, setCountryId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [visaTypeId, setVisaTypeId] = useState<string>("");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());

  // --- Queries ---

  const { data: countries } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories", countryId],
    queryFn: async () => {
      let q = supabase
        .from("application_categories")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order");
      if (countryId) q = q.eq("country_id", countryId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ["admin-subcategories", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_subcategories")
        .select("id, name, code")
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: visaTypes } = useQuery({
    queryKey: ["admin-visa-types-filtered", countryId, categoryId, subcategoryId],
    queryFn: async () => {
      let q = supabase
        .from("visa_types")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (countryId) q = q.eq("country_id", countryId);
      if (categoryId) q = q.eq("category_id", categoryId);
      if (subcategoryId) q = q.eq("subcategory_id", subcategoryId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Linked documents for selected visa type
  const { data: linkedDocs, isLoading: linkedLoading } = useQuery({
    queryKey: ["app-checklist-linked", visaTypeId],
    enabled: !!visaTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_template_applications")
        .select(`
          id,
          document_template_id,
          document_checklist_templates (
            id,
            document_name,
            category,
            applicant_type_id,
            requirement_type,
            description
          )
        `)
        .eq("visa_type_id", visaTypeId);
      if (error) throw error;
      return data;
    },
  });

  // Applicant types for display
  const { data: applicantTypes } = useQuery({
    queryKey: ["admin-applicant-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_types")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Document definitions for the add dialog
  const { data: definitions } = useQuery({
    queryKey: ["admin-doc-definitions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_definitions")
        .select("id, document_name, category, description")
        .eq("is_active", true)
        .order("category")
        .order("document_name");
      if (error) throw error;
      return data;
    },
  });

  const applicantTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    applicantTypes?.forEach((at) => m.set(at.id, at.name));
    return m;
  }, [applicantTypes]);

  // Already-linked template IDs (to filter out in add dialog)
  const alreadyLinkedTemplateIds = useMemo(
    () => new Set(linkedDocs?.map((d) => d.document_template_id) ?? []),
    [linkedDocs]
  );

  // Filtered definitions for add dialog
  const filteredDefinitions = useMemo(() => {
    if (!definitions) return [];
    let filtered = definitions;
    if (addSearch) {
      const s = addSearch.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.document_name.toLowerCase().includes(s) ||
          d.category.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [definitions, addSearch]);

  // Group definitions by category for display
  const groupedDefinitions = useMemo(() => {
    const groups: Record<string, typeof filteredDefinitions> = {};
    filteredDefinitions.forEach((d) => {
      if (!groups[d.category]) groups[d.category] = [];
      groups[d.category].push(d);
    });
    return groups;
  }, [filteredDefinitions]);

  // --- Mutations ---

  const addDocsMutation = useMutation({
    mutationFn: async (definitionIds: string[]) => {
      if (!visaTypeId || !definitions) return;

      const selectedDefs = definitions.filter((d) => definitionIds.includes(d.id));

      for (const def of selectedDefs) {
        // Find or create a global template
        let templateId: string;
        const { data: existing } = await supabase
          .from("document_checklist_templates")
          .select("id")
          .is("company_id", null)
          .eq("document_name", def.document_name)
          .eq("category", def.category)
          .maybeSingle();

        if (existing) {
          templateId = existing.id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from("document_checklist_templates")
            .insert({
              document_name: def.document_name,
              category: def.category,
              description: def.description,
              company_id: null,
            })
            .select("id")
            .single();
          if (createErr) throw createErr;
          templateId = created.id;
        }

        // Check if already linked
        if (alreadyLinkedTemplateIds.has(templateId)) continue;

        // Link to visa type
        const { error: linkErr } = await supabase
          .from("document_template_applications")
          .insert({
            document_template_id: templateId,
            visa_type_id: visaTypeId,
          });
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-checklist-linked", visaTypeId] });
      setAddDialogOpen(false);
      setAddSelected(new Set());
      setAddSearch("");
      toast.success("Documents added to application");
    },
    onError: (err: any) => {
      toast.error("Failed to add documents: " + err.message);
    },
  });

  const removeDocsMutation = useMutation({
    mutationFn: async (junctionIds: string[]) => {
      const { error } = await supabase
        .from("document_template_applications")
        .delete()
        .in("id", junctionIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-checklist-linked", visaTypeId] });
      setSelectedIds(new Set());
      toast.success("Documents removed from application");
    },
    onError: (err: any) => {
      toast.error("Failed to remove: " + err.message);
    },
  });

  // --- Handlers ---

  const handleCountryChange = (val: string) => {
    setCountryId(val === "all" ? "" : val);
    setCategoryId("");
    setSubcategoryId("");
    setVisaTypeId("");
    setSelectedIds(new Set());
  };

  const handleCategoryChange = (val: string) => {
    setCategoryId(val === "all" ? "" : val);
    setSubcategoryId("");
    setVisaTypeId("");
    setSelectedIds(new Set());
  };

  const handleSubcategoryChange = (val: string) => {
    setSubcategoryId(val === "all" ? "" : val);
    setVisaTypeId("");
    setSelectedIds(new Set());
  };

  const handleVisaTypeChange = (val: string) => {
    setVisaTypeId(val);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelected = () => {
    if (!linkedDocs) return;
    if (selectedIds.size === linkedDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(linkedDocs.map((d) => d.id)));
    }
  };

  const toggleAddItem = (defId: string) => {
    setAddSelected((prev) => {
      const next = new Set(prev);
      if (next.has(defId)) next.delete(defId);
      else next.add(defId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select value={countryId || "all"} onValueChange={handleCountryChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryId || "all"} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={subcategoryId || "all"}
            onValueChange={handleSubcategoryChange}
            disabled={!categoryId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcategories</SelectItem>
              {subcategories?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={visaTypeId || ""} onValueChange={handleVisaTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select Application..." />
            </SelectTrigger>
            <SelectContent>
              {visaTypes?.map((vt) => (
                <SelectItem key={vt.id} value={vt.id}>
                  {vt.name} ({vt.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        {visaTypeId && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setAddDialogOpen(true); setAddSelected(new Set()); setAddSearch(""); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Documents
            </Button>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeDocsMutation.mutate(Array.from(selectedIds))}
                disabled={removeDocsMutation.isPending}
              >
                {removeDocsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Remove Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Linked documents table */}
      {!visaTypeId ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Select an application to view its document checklist.
        </p>
      ) : linkedLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !linkedDocs?.length ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          No documents linked to this application yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === linkedDocs.length}
                  onCheckedChange={toggleAllSelected}
                />
              </TableHead>
              <TableHead>Document Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Applicant Type</TableHead>
              <TableHead>Requirement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedDocs.map((row) => {
              const tmpl = row.document_checklist_templates as any;
              if (!tmpl) return null;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={() => toggleSelected(row.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{tmpl.document_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tmpl.category || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    {tmpl.applicant_type_id
                      ? applicantTypeMap.get(tmpl.applicant_type_id) || "—"
                      : "All"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {tmpl.requirement_type?.replace("_", " ") || "required"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Add Documents Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Documents to Application</DialogTitle>
            <DialogDescription>
              Select documents from the master catalog to link to this application.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-4">
            {Object.entries(groupedDefinitions).map(([category, defs]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">{category}</h4>
                <div className="space-y-1">
                  {defs.map((def) => {
                    // Check if already linked via template
                    const isAlreadyLinked = linkedDocs?.some((ld) => {
                      const tmpl = ld.document_checklist_templates as any;
                      return (
                        tmpl?.document_name === def.document_name &&
                        tmpl?.category === def.category
                      );
                    });
                    return (
                      <label
                        key={def.id}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer ${
                          isAlreadyLinked ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <Checkbox
                          checked={addSelected.has(def.id) || !!isAlreadyLinked}
                          disabled={!!isAlreadyLinked}
                          onCheckedChange={() => toggleAddItem(def.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{def.document_name}</span>
                          {isAlreadyLinked && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Already linked
                            </Badge>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(groupedDefinitions).length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No documents found.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={addSelected.size === 0 || addDocsMutation.isPending}
              onClick={() => addDocsMutation.mutate(Array.from(addSelected))}
            >
              {addDocsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Add {addSelected.size} Document{addSelected.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
