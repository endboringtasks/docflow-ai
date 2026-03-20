import { useState, useMemo, useCallback } from "react";
import { useTableSort, SortableTableHead } from "@/hooks/useTableSort";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EditDocumentSettingsDialog } from "./EditDocumentSettingsDialog";
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
import { Loader2, Plus, Trash2, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// ── List Mode ──────────────────────────────────────────────────────────

function ApplicationListView({
  onSelect,
}: {
  onSelect: (id: string, name: string) => void;
}) {
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");

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
    queryKey: ["admin-categories", countryFilter],
    queryFn: async () => {
      let q = supabase
        .from("application_categories")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order");
      if (countryFilter) q = q.eq("country_id", countryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ["admin-subcategories-filter", categoryFilter],
    enabled: !!categoryFilter,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_subcategories")
        .select("id, name, code")
        .eq("category_id", categoryFilter)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: visaTypes, isLoading } = useQuery({
    queryKey: [
      "admin-visa-types-list",
      countryFilter,
      categoryFilter,
      subcategoryFilter,
    ],
    queryFn: async () => {
      let q = supabase
        .from("visa_types")
        .select("id, name, code, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (countryFilter) q = q.eq("country_id", countryFilter);
      if (categoryFilter) q = q.eq("category_id", categoryFilter);
      if (subcategoryFilter) q = q.eq("subcategory_id", subcategoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select
          value={countryFilter || "all"}
          onValueChange={(v) => {
            setCountryFilter(v === "all" ? "" : v);
            setCategoryFilter("");
            setSubcategoryFilter("");
          }}
        >
          <SelectTrigger className="w-48">
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

        <Select
          value={categoryFilter || "all"}
          onValueChange={(v) => {
            setCategoryFilter(v === "all" ? "" : v);
            setSubcategoryFilter("");
          }}
        >
          <SelectTrigger className="w-48">
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
          value={subcategoryFilter || "all"}
          onValueChange={(v) => setSubcategoryFilter(v === "all" ? "" : v)}
          disabled={!categoryFilter}
        >
          <SelectTrigger className="w-48">
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !visaTypes?.length ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          No applications found.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead className="w-32">Code</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visaTypes.map((vt: any) => (
              <TableRow
                key={vt.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(vt.id, `${vt.name} (${vt.code})`)}
              >
                <TableCell className="text-muted-foreground">
                  {vt.sort_order ?? 0}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{vt.code}</Badge>
                </TableCell>
                <TableCell className="font-medium">{vt.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Detail Mode ────────────────────────────────────────────────────────

function ApplicationDetailView({
  visaTypeId,
  visaTypeName,
  onBack,
}: {
  visaTypeId: string;
  visaTypeName: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

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

  const applicantTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    applicantTypes?.forEach((at) => m.set(at.id, at.name));
    return m;
  }, [applicantTypes]);

  const { data: linkedDocs, isLoading: linkedLoading } = useQuery({
    queryKey: ["app-checklist-linked", visaTypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_template_applications")
        .select(
          `id, document_template_id,
           document_checklist_templates (
             id, document_name, category, applicant_type_id, requirement_type, description,
             age_condition, applicability_condition, min_files, max_files,
             requires_translation, translation_target_language,
             translation_certification_type_id, translation_notes, sort_order
           )`
        )
        .eq("visa_type_id", visaTypeId);
      if (error) throw error;
      return data;
    },
  });

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

  const alreadyLinkedTemplateIds = useMemo(
    () => new Set(linkedDocs?.map((d) => d.document_template_id) ?? []),
    [linkedDocs]
  );

  const filteredDefinitions = useMemo(() => {
    if (!definitions) return [];
    if (!addSearch) return definitions;
    const s = addSearch.toLowerCase();
    return definitions.filter(
      (d) =>
        d.document_name.toLowerCase().includes(s) ||
        d.category.toLowerCase().includes(s)
    );
  }, [definitions, addSearch]);

  const groupedDefinitions = useMemo(() => {
    const groups: Record<string, typeof filteredDefinitions> = {};
    filteredDefinitions.forEach((d) => {
      if (!groups[d.category]) groups[d.category] = [];
      groups[d.category].push(d);
    });
    return groups;
  }, [filteredDefinitions]);

  const addDocsMutation = useMutation({
    mutationFn: async (definitionIds: string[]) => {
      if (!definitions) return;
      const selectedDefs = definitions.filter((d) =>
        definitionIds.includes(d.id)
      );
      for (const def of selectedDefs) {
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
        if (alreadyLinkedTemplateIds.has(templateId)) continue;
        const { error: linkErr } = await supabase
          .from("document_template_applications")
          .insert({ document_template_id: templateId, visa_type_id: visaTypeId });
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["app-checklist-linked", visaTypeId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-doc-counts"] });
      setAddDialogOpen(false);
      setAddSelected(new Set());
      setAddSearch("");
      toast.success("Documents added to application");
    },
    onError: (err: any) => toast.error("Failed to add documents: " + err.message),
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
      queryClient.invalidateQueries({
        queryKey: ["app-checklist-linked", visaTypeId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-doc-counts"] });
      setSelectedIds(new Set());
      toast.success("Documents removed from application");
    },
    onError: (err: any) => toast.error("Failed to remove: " + err.message),
  });

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllSelected = () => {
    if (!linkedDocs) return;
    setSelectedIds(
      selectedIds.size === linkedDocs.length
        ? new Set()
        : new Set(linkedDocs.map((d) => d.id))
    );
  };

  const toggleAddItem = (defId: string) =>
    setAddSelected((prev) => {
      const next = new Set(prev);
      next.has(defId) ? next.delete(defId) : next.add(defId);
      return next;
    });

  const detailAccessors = useMemo(() => ({
    document_name: (row: any) => (row.document_checklist_templates as any)?.document_name ?? "",
    category: (row: any) => (row.document_checklist_templates as any)?.category ?? "",
    applicant_type: (row: any) => {
      const id = (row.document_checklist_templates as any)?.applicant_type_id;
      return id ? (applicantTypeMap.get(id) ?? "") : "";
    },
    requirement_type: (row: any) => (row.document_checklist_templates as any)?.requirement_type ?? "required",
  }), [applicantTypeMap]);

  const { sortedData: sortedDocs, sortColumn, sortDirection, handleSort } = useTableSort(linkedDocs, detailAccessors);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h3 className="text-lg font-semibold">{visaTypeName}</h3>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setAddDialogOpen(true);
            setAddSelected(new Set());
            setAddSearch("");
          }}
        >
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

      {linkedLoading ? (
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
              <SortableTableHead column="document_name" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Document Name</SortableTableHead>
              <SortableTableHead column="category" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Category</SortableTableHead>
              <SortableTableHead column="applicant_type" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Applicant Type</SortableTableHead>
              <SortableTableHead column="requirement_type" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Requirement</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDocs?.map((row) => {
              const tmpl = row.document_checklist_templates as any;
              if (!tmpl) return null;
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setEditingTemplate(tmpl)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={() => toggleSelected(row.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {tmpl.document_name}
                  </TableCell>
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
              Select documents from the master catalog to link to this
              application.
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
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  {category}
                </h4>
                <div className="space-y-1">
                  {defs.map((def) => {
                    const isAlreadyLinked = linkedDocs?.some((ld) => {
                      const t = ld.document_checklist_templates as any;
                      return (
                        t?.document_name === def.document_name &&
                        t?.category === def.category
                      );
                    });
                    return (
                      <label
                        key={def.id}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer ${
                          isAlreadyLinked
                            ? "opacity-50 pointer-events-none"
                            : ""
                        }`}
                      >
                        <Checkbox
                          checked={addSelected.has(def.id) || !!isAlreadyLinked}
                          disabled={!!isAlreadyLinked}
                          onCheckedChange={() => toggleAddItem(def.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">
                            {def.document_name}
                          </span>
                          {isAlreadyLinked && (
                            <Badge
                              variant="secondary"
                              className="ml-2 text-xs"
                            >
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
              {addDocsMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              )}
              Add {addSelected.size} Document
              {addSelected.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditDocumentSettingsDialog
        open={!!editingTemplate}
        onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}
        template={editingTemplate}
        visaTypeId={visaTypeId}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function ApplicationChecklistTab() {
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (selected) {
    return (
      <ApplicationDetailView
        visaTypeId={selected.id}
        visaTypeName={selected.name}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <ApplicationListView
      onSelect={(id, name) => setSelected({ id, name })}
    />
  );
}
