import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  FileText,
  Loader2,
  Trash2,
  Pencil,
  Save,
  Search,
  X,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface DocumentDefinition {
  id: string;
  company_id: string;
  category: string;
  document_name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface DocumentCategoryRow {
  name: string;
  sort_order: number;
}


export default function DocumentsListTab() {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
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

  // Fetch definitions
  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ["document-definitions", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("document_definitions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("category")
        .order("sort_order")
        .order("document_name");
      if (error) throw error;
      return data as DocumentDefinition[];
    },
    enabled: !!currentCompany?.id,
  });

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

  // Fetch managed global document categories
  const { data: managedCategories = [] } = useQuery({
    queryKey: ["admin-document-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_categories")
        .select("name, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DocumentCategoryRow[];
    },
  });

  // Build the category list from the managed list, plus any value already used
  // by existing documents (so legacy data stays filterable), preserving order.
  const categories = useMemo(() => {
    const ordered = managedCategories.map((c) => c.name);
    const known = new Set(ordered);
    const extras = Array.from(
      new Set(definitions.map((d) => d.category).filter((c) => c && !known.has(c))),
    ).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...extras];
  }, [managedCategories, definitions]);


  // Add mutation
  const addMutation = useMutation({
    mutationFn: async (def: { category: string; document_name: string; description: string | null }) => {
      if (!currentCompany?.id) throw new Error("No company");
      const { data, error } = await supabase
        .from("document_definitions")
        .insert({
          company_id: currentCompany.id,
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
      queryClient.invalidateQueries({ queryKey: ["document-definitions", currentCompany?.id] });
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

      // Sync description to all templates and application checklists
      const { data: syncCount } = await supabase.rpc("sync_definition_description_to_all", {
        p_definition_id: def.id,
        p_new_description: def.description || "",
      });

      return { data, syncCount: syncCount ?? 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["document-definitions", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
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
      queryClient.invalidateQueries({ queryKey: ["document-definitions", currentCompany?.id] });
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
        <div className="flex gap-3 items-center flex-1 w-full sm:w-auto">
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
      <div className="card-gradient rounded-xl border border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {search || filterCategory !== "all" ? "No documents match your filter" : "No documents defined yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {search || filterCategory !== "all"
                ? "Try a different search or category."
                : "Add documents to your catalog to use them in application checklists."}
            </p>
            {!search && filterCategory === "all" && (
              <Button variant="outline" onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Document
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Document Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((def) => (
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
        )}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border/50 text-sm text-muted-foreground">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== definitions.length && ` (of ${definitions.length} total)`}
          </div>
        )}
      </div>

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
              <Select value={newDef.category} onValueChange={(v) => setNewDef({ ...newDef, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                onClick={() =>
                  addMutation.mutate({
                    category: newDef.category,
                    document_name: newDef.document_name.trim(),
                    description: newDef.description || null,
                  })
                }
                disabled={!newDef.category || !newDef.document_name.trim() || addMutation.isPending}
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
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onClick={() => editing && updateMutation.mutate(editing)}
                  disabled={!editing.document_name.trim() || updateMutation.isPending}
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
              This will remove "{toDelete?.document_name}" from your catalog. Existing templates and application checklists won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
