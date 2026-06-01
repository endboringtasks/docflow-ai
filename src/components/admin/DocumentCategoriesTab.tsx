import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTableSort, SortableTableHead } from "@/hooks/useTableSort";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export default function DocumentCategoriesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentCategory | null>(null);
  const [toDelete, setToDelete] = useState<DocumentCategory | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", sort_order: 0, is_active: true });

  const accessors = useMemo(
    () => ({
      sort_order: (c: DocumentCategory) => c.sort_order,
      name: (c: DocumentCategory) => c.name,
      status: (c: DocumentCategory) => (c.is_active ? "Active" : "Inactive"),
    }),
    [],
  );

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-document-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DocumentCategory[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; sort_order: number; is_active: boolean }) => {
      const trimmed = data.name.trim();
      if (editing) {
        // If the name changed, re-label every document using the old name first.
        if (trimmed !== editing.name) {
          const { error: renameError } = await supabase.rpc("rename_document_category", {
            p_old_name: editing.name,
            p_new_name: trimmed,
          });
          if (renameError) throw renameError;
        }
        const { error } = await supabase
          .from("document_categories")
          .update({ name: trimmed, sort_order: data.sort_order, is_active: data.is_active })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("document_categories")
          .insert([{ name: trimmed, sort_order: data.sort_order, is_active: data.is_active }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-document-definitions"] });
      toast.success(editing ? "Category updated" : "Category created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (category: DocumentCategory) => {
      const { error } = await supabase
        .from("document_categories")
        .delete()
        .eq("id", category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-categories"] });
      toast.success("Category deleted");
      setToDelete(null);
      setDeleteUsage(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", sort_order: (categories?.length || 0) * 10, is_active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (category: DocumentCategory) => {
    setEditing(category);
    setForm({ name: category.name, sort_order: category.sort_order, is_active: category.is_active });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMutation.mutate(form);
  };

  const requestDelete = async (category: DocumentCategory) => {
    setToDelete(category);
    setDeleteUsage(null);
    const { data, error } = await supabase.rpc("count_document_category_usage", {
      p_name: category.name,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteUsage((data as number) ?? 0);
  };

  const { sortedData, sortColumn, sortDirection, handleSort } = useTableSort(categories, accessors);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const inUse = (deleteUsage ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Manage the global list of document categories used across all companies.
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead column="sort_order" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-12">Order</SortableTableHead>
            <SortableTableHead column="name" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Name</SortableTableHead>
            <SortableTableHead column="status" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Status</SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="text-muted-foreground">{category.sort_order}</TableCell>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell>
                <Badge variant={category.is_active ? "default" : "secondary"}>
                  {category.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => requestDelete(category)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sortedData.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No document categories yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Renaming this category will re-label every document that currently uses it."
                : "Add a new global document category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Identity"
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
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => { setToDelete(null); setDeleteUsage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUsage === null ? (
                "Checking whether this category is still in use…"
              ) : inUse ? (
                <>
                  The category "{toDelete?.name}" is currently used by {deleteUsage} document
                  {deleteUsage === 1 ? "" : "s"}. Reassign or rename those documents before deleting
                  this category.
                </>
              ) : (
                <>Are you sure you want to delete "{toDelete?.name}"? This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUsage === null || inUse || deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete)}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
