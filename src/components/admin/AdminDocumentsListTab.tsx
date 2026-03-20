import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTableSort, SortableTableHead } from "@/hooks/useTableSort";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  FileText,
  Loader2,
  X,
  Plus,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentDefinition {
  id: string;
  company_id: string;
  category: string;
  document_name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

const defaultCategories = [
  "Identity", "Character", "Health", "Employment", "Skills",
  "English", "Education", "Financial", "Relationship", "Sponsor",
  "Insurance", "Nomination", "Other",
];

export default function AdminDocumentsListTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentDefinition | null>(null);
  const [toDelete, setToDelete] = useState<DocumentDefinition | null>(null);
  const [newDef, setNewDef] = useState({
    category: "",
    document_name: "",
    description: "",
  });
  const [customCategoryAdd, setCustomCategoryAdd] = useState("");
  const [customCategoryEdit, setCustomCategoryEdit] = useState("");

  // Fetch all companies for the filter
  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  // Fetch all document definitions across all companies
  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ["admin-document-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_definitions")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("sort_order")
        .order("document_name");
      if (error) throw error;
      return data as DocumentDefinition[];
    },
  });

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(definitions.map((d) => d.category));
    defaultCategories.forEach((c) => cats.add(c));
    return Array.from(cats).sort((a, b) => {
      const ai = defaultCategories.indexOf(a);
      const bi = defaultCategories.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [definitions]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = definitions;
    if (filterCategory && filterCategory !== "all") {
      list = list.filter((d) => d.category === filterCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.document_name.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [definitions, filterCategory, search]);

  const sortAccessors = useCallback(() => ({
    category: (d: DocumentDefinition) => d.category,
    document_name: (d: DocumentDefinition) => d.document_name,
  }), []);

  const { sortedData, sortColumn, sortDirection, handleSort } = useTableSort(filtered, sortAccessors());

  // Add mutation
  const addMutation = useMutation({
    mutationFn: async (def: { category: string; document_name: string; description: string | null }) => {
      // Auto-assign first company to satisfy DB constraint since documents are universal
      const firstCompany = companies[0];
      if (!firstCompany) throw new Error("No companies available");
      
      const { data, error } = await supabase
        .from("document_definitions")
        .insert({
          company_id: firstCompany.id,
          category: def.category,
          document_name: def.document_name,
          description: def.description,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-definitions"] });
      setIsAddOpen(false);
      setNewDef({ category: "", document_name: "", description: "" });
      toast.success("Document added to catalog");
    },
    onError: (error) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Document already exists in this category");
      } else {
        toast.error("Failed to add document", { description: error.message });
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (def: DocumentDefinition) => {
      const { data, error } = await supabase
        .from("document_definitions")
        .update({
          category: def.category,
          document_name: def.document_name,
          description: def.description,
        })
        .eq("id", def.id)
        .select()
        .single();
      if (error) throw error;

      const { data: syncCount } = await supabase.rpc("sync_definition_description_to_all", {
        p_definition_id: def.id,
        p_new_description: def.description || "",
      });

      return { data, syncCount: syncCount ?? 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-definitions"] });
      setEditing(null);
      if (result.syncCount > 0) {
        toast.success("Document updated", {
          description: `Description synced to ${result.syncCount} application checklist(s)`,
        });
      } else {
        toast.success("Document updated");
      }
    },
    onError: (error) => {
      toast.error("Failed to update document", { description: error.message });
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("document_definitions")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-definitions"] });
      setToDelete(null);
      toast.success("Document removed from catalog");
    },
    onError: (error) => {
      toast.error("Failed to remove document", { description: error.message });
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="gradient" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Document
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {search || filterCategory !== "all"
              ? "No documents match your filter"
              : "No document definitions found"}
          </h3>
          <p className="text-muted-foreground">
            {search || filterCategory !== "all"
              ? "Try a different search or category."
              : "Companies haven't created any document definitions yet."}
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="category" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Category</SortableTableHead>
                <SortableTableHead column="document_name" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Document Name</SortableTableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((def) => (
                <TableRow key={def.id}>
                  <TableCell>
                    <Badge variant="outline">{def.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{def.document_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">
                    {def.description || <span className="italic">No description</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(def)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setToDelete(def)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-sm text-muted-foreground">
            {sortedData.length} document{sortedData.length !== 1 ? "s" : ""}
            {sortedData.length !== definitions.length && ` (of ${definitions.length} total)`}
          </div>
        </>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document to Catalog</DialogTitle>
            <DialogDescription>
              Define a document that can be used across application checklists.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newDef.category === "__custom__" ? "__custom__" : newDef.category}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    setNewDef({ ...newDef, category: "__custom__" });
                    setCustomCategoryAdd("");
                  } else {
                    setNewDef({ ...newDef, category: v });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__custom__" className="text-primary font-medium">+ New Category</SelectItem>
                </SelectContent>
              </Select>
              {newDef.category === "__custom__" && (
                <Input
                  placeholder="Enter new category name"
                  value={customCategoryAdd}
                  onChange={(e) => setCustomCategoryAdd(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                value={newDef.document_name}
                onChange={(e) => setNewDef({ ...newDef, document_name: e.target.value })}
                placeholder="e.g., Passport (certified copy)"
              />
            </div>
            <div className="space-y-2">
              <Label>Description / Instructions</Label>
              <Textarea
                value={newDef.description}
                onChange={(e) => setNewDef({ ...newDef, description: e.target.value })}
                placeholder="Instructions shown to clients in the portal..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const resolvedCategory = newDef.category === "__custom__" ? customCategoryAdd.trim() : newDef.category;
                  addMutation.mutate({
                    category: resolvedCategory,
                    document_name: newDef.document_name.trim(),
                    description: newDef.description || null,
                  });
                }}
                disabled={(!newDef.category || (newDef.category === "__custom__" && !customCategoryAdd.trim())) || !newDef.document_name.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Changes to the description will sync to all application checklists.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editing.category === "__custom__" ? "__custom__" : editing.category}
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setEditing({ ...editing, category: "__custom__" });
                      setCustomCategoryEdit("");
                    } else {
                      setEditing({ ...editing, category: v });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="text-primary font-medium">+ New Category</SelectItem>
                  </SelectContent>
                </Select>
                {editing.category === "__custom__" && (
                  <Input
                    placeholder="Enter new category name"
                    value={customCategoryEdit}
                    onChange={(e) => setCustomCategoryEdit(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Document Name</Label>
                <Input
                  value={editing.document_name}
                  onChange={(e) => setEditing({ ...editing, document_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description / Instructions</Label>
                <Textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value || null })}
                  placeholder="Instructions shown to clients in the portal..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Updating this will automatically sync to all templates and application checklists.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!editing) return;
                    const resolvedCategory = editing.category === "__custom__" ? customCategoryEdit.trim() : editing.category;
                    updateMutation.mutate({ ...editing, category: resolvedCategory });
                  }}
                  disabled={!editing.document_name.trim() || (editing.category === "__custom__" && !customCategoryEdit.trim()) || updateMutation.isPending}
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{toDelete?.document_name}" from the catalog. Existing templates and application checklists won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
