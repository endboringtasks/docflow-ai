import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Globe,
  FolderTree,
  FileType,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Layers,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { getCountryFlag } from "@/lib/countryFlags";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Types
interface Country {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  default_language_code: string | null;
}

interface ApplicationCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  country_id: string | null;
  is_active: boolean;
  sort_order: number;
  country?: Country;
}

interface ApplicationSubcategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string;
  is_active: boolean;
  sort_order: number;
  category?: ApplicationCategory;
}

interface ApplicationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  country_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  is_active: boolean;
  sort_order: number;
  country?: Country;
  category?: ApplicationCategory;
  subcategory?: ApplicationSubcategory;
}

interface DocumentTemplate {
  id: string;
  document_name: string;
  category: string | null;
  visa_type_id: string | null;
  country_id: string | null;
  is_required: boolean;
  sort_order: number;
  country?: Country;
  visa_type?: ApplicationType;
}

// Countries Tab Component
function CountriesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [deleteCountry, setDeleteCountry] = useState<Country | null>(null);
  const [form, setForm] = useState({ code: "", name: "", is_active: true, sort_order: 0 });

  const { data: countries, isLoading } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Country[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; is_active: boolean; sort_order: number }) => {
      if (editingCountry) {
        const { error } = await supabase
          .from("countries")
          .update(data)
          .eq("id", editingCountry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("countries").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-countries"] });
      toast.success(editingCountry ? "Country updated" : "Country created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("countries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-countries"] });
      toast.success("Country deleted");
      setDeleteCountry(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingCountry(null);
    setForm({ code: "", name: "", is_active: true, sort_order: (countries?.length || 0) * 10 });
    setIsDialogOpen(true);
  };

  const openEdit = (country: Country) => {
    setEditingCountry(country);
    setForm({
      code: country.code,
      name: country.name,
      is_active: country.is_active,
      sort_order: country.sort_order,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCountry(null);
  };

  const handleSave = () => {
    if (!form.code || !form.name) {
      toast.error("Code and name are required");
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Manage countries available for applications
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Country
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Order</TableHead>
            <TableHead>Flag</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {countries?.map((country) => (
            <TableRow key={country.id}>
              <TableCell className="text-muted-foreground">{country.sort_order}</TableCell>
              <TableCell>{getCountryFlag(country.code)}</TableCell>
              <TableCell className="font-mono">{country.code}</TableCell>
              <TableCell>{country.name}</TableCell>
              <TableCell>
                <Badge variant={country.is_active ? "default" : "secondary"}>
                  {country.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(country)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleteCountry(country)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCountry ? "Edit Country" : "Add Country"}</DialogTitle>
            <DialogDescription>
              {editingCountry ? "Update country details" : "Add a new country to the system"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="AU"
                  maxLength={2}
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
            <div className="space-y-2">
              <Label>Country Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Australia"
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

      <AlertDialog open={!!deleteCountry} onOpenChange={() => setDeleteCountry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Country</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCountry?.name}"? This may affect existing
              applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCountry && deleteMutation.mutate(deleteCountry.id)}
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

// Application Categories Tab Component
function CategoriesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApplicationCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<ApplicationCategory | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    icon: "",
    country_id: "",
    is_active: true,
    sort_order: 0,
  });

  const { data: countries } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Country[];
    },
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_categories")
        .select("*, country:countries(*)")
        .order("sort_order");
      if (error) throw error;
      return data as ApplicationCategory[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        country_id: data.country_id || null,
        description: data.description || null,
        icon: data.icon || null,
      };
      if (editingCategory) {
        const { error } = await supabase
          .from("application_categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("application_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success(editingCategory ? "Category updated" : "Category created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("application_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success("Category deleted");
      setDeleteCategory(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingCategory(null);
    setForm({
      code: "",
      name: "",
      description: "",
      icon: "",
      country_id: "",
      is_active: true,
      sort_order: (categories?.length || 0) * 10,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (category: ApplicationCategory) => {
    setEditingCategory(category);
    setForm({
      code: category.code,
      name: category.name,
      description: category.description || "",
      icon: category.icon || "",
      country_id: category.country_id || "",
      is_active: category.is_active,
      sort_order: category.sort_order,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  const handleSave = () => {
    if (!form.code || !form.name) {
      toast.error("Code and name are required");
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Manage application categories (Visa, Skill Assessment, etc.)
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Order</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories?.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="text-muted-foreground">{category.sort_order}</TableCell>
              <TableCell className="font-mono">{category.code}</TableCell>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell>
                {category.country ? (
                  <span className="flex items-center gap-2">
                    {getCountryFlag(category.country.code)} {category.country.name}
                  </span>
                ) : (
                  <Badge variant="outline">All Countries</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-48 truncate">
                {category.description || "—"}
              </TableCell>
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
                    onClick={() => setDeleteCategory(category)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update category details" : "Add a new application category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  placeholder="skill_assessment"
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
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Skill Assessment"
              />
            </div>
            <div className="space-y-2">
              <Label>Country (Optional)</Label>
              <Select
                value={form.country_id || "__none__"}
                onValueChange={(value) => setForm({ ...form, country_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All Countries</SelectItem>
                  {countries?.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {getCountryFlag(country.code)} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this category..."
                rows={2}
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

      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCategory?.name}"? This may affect existing
              application types.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
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

// Application Subcategories Tab Component
function SubcategoriesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<ApplicationSubcategory | null>(null);
  const [deleteSubcategory, setDeleteSubcategory] = useState<ApplicationSubcategory | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    icon: "",
    category_id: "",
    is_active: true,
    sort_order: 0,
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_categories")
        .select("*, country:countries(*)")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ApplicationCategory[];
    },
  });

  const { data: subcategories, isLoading } = useQuery({
    queryKey: ["admin-subcategories", filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("application_subcategories")
        .select("*, category:application_categories(*, country:countries(*))")
        .order("sort_order");

      if (filterCategory) query = query.eq("category_id", filterCategory);

      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationSubcategory[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        description: data.description || null,
        icon: data.icon || null,
      };
      if (editingSubcategory) {
        const { error } = await supabase
          .from("application_subcategories")
          .update(payload)
          .eq("id", editingSubcategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("application_subcategories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subcategories"] });
      toast.success(editingSubcategory ? "Subcategory updated" : "Subcategory created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("application_subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subcategories"] });
      toast.success("Subcategory deleted");
      setDeleteSubcategory(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingSubcategory(null);
    setForm({
      code: "",
      name: "",
      description: "",
      icon: "",
      category_id: filterCategory || "",
      is_active: true,
      sort_order: (subcategories?.length || 0) * 10,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (subcategory: ApplicationSubcategory) => {
    setEditingSubcategory(subcategory);
    setForm({
      code: subcategory.code,
      name: subcategory.name,
      description: subcategory.description || "",
      icon: subcategory.icon || "",
      category_id: subcategory.category_id,
      is_active: subcategory.is_active,
      sort_order: subcategory.sort_order,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingSubcategory(null);
  };

  const handleSave = () => {
    if (!form.code || !form.name || !form.category_id) {
      toast.error("Code, name, and category are required");
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <Select value={filterCategory || "__all__"} onValueChange={(v) => setFilterCategory(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.country ? `${getCountryFlag(cat.country.code)} ` : ""}{cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Subcategory
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Order</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subcategories?.map((subcategory) => (
            <TableRow key={subcategory.id}>
              <TableCell className="text-muted-foreground">{subcategory.sort_order}</TableCell>
              <TableCell className="font-mono">{subcategory.code}</TableCell>
              <TableCell className="font-medium">{subcategory.name}</TableCell>
              <TableCell>
                {subcategory.category ? (
                  <Badge variant="secondary">{subcategory.category.name}</Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {subcategory.category?.country ? (
                  <span className="flex items-center gap-2">
                    {getCountryFlag(subcategory.category.country.code)} {subcategory.category.country.name}
                  </span>
                ) : (
                  <Badge variant="outline">All</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-48 truncate">
                {subcategory.description || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={subcategory.is_active ? "default" : "secondary"}>
                  {subcategory.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(subcategory)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleteSubcategory(subcategory)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {subcategories?.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No subcategories found. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
            <DialogDescription>
              {editingSubcategory ? "Update subcategory details" : "Add a new subcategory under a category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={form.category_id || "__none__"}
                onValueChange={(value) => setForm({ ...form, category_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select a category</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.country ? `${getCountryFlag(cat.country.code)} ` : ""}{cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  placeholder="temporary_work"
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
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Temporary Work"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this subcategory..."
                rows={2}
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

      <AlertDialog open={!!deleteSubcategory} onOpenChange={() => setDeleteSubcategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subcategory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSubcategory?.name}"? This may affect existing
              application types.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSubcategory && deleteMutation.mutate(deleteSubcategory.id)}
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

// Application Types Tab Component
function TypesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ApplicationType | null>(null);
  const [deleteType, setDeleteType] = useState<ApplicationType | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    country_id: "",
    category_id: "",
    subcategory_id: "",
    is_active: true,
    sort_order: 0,
  });

  const { data: countries } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Country[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ApplicationCategory[];
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ["admin-subcategories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_subcategories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ApplicationSubcategory[];
    },
  });

  // Filtered subcategories for the filter dropdown
  const filteredSubcategories = filterCategory 
    ? subcategories?.filter(s => s.category_id === filterCategory) 
    : subcategories;

  const { data: types, isLoading } = useQuery({
    queryKey: ["admin-types", filterCountry, filterCategory, filterSubcategory],
    queryFn: async () => {
      let query = supabase
        .from("visa_types")
        .select("*, country:countries(*), category:application_categories(*), subcategory:application_subcategories(*)")
        .order("sort_order");

      if (filterCountry) query = query.eq("country_id", filterCountry);
      if (filterCategory) query = query.eq("category_id", filterCategory);
      if (filterSubcategory) query = query.eq("subcategory_id", filterSubcategory);

      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationType[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        country_id: data.country_id || null,
        category_id: data.category_id || null,
        subcategory_id: data.subcategory_id || null,
        description: data.description || null,
      };
      if (editingType) {
        const { error } = await supabase.from("visa_types").update(payload).eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("visa_types").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-types"] });
      toast.success(editingType ? "Type updated" : "Type created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visa_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-types"] });
      toast.success("Type deleted");
      setDeleteType(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingType(null);
    setForm({
      code: "",
      name: "",
      description: "",
      country_id: filterCountry || "",
      category_id: filterCategory || "",
      subcategory_id: filterSubcategory || "",
      is_active: true,
      sort_order: (types?.length || 0) * 10,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (type: ApplicationType) => {
    setEditingType(type);
    setForm({
      code: type.code,
      name: type.name,
      description: type.description || "",
      country_id: type.country_id || "",
      category_id: type.category_id || "",
      subcategory_id: type.subcategory_id || "",
      is_active: type.is_active,
      sort_order: type.sort_order,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
  };

  const handleSave = () => {
    if (!form.code || !form.name) {
      toast.error("Code and name are required");
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <Select value={filterCountry || "__all__"} onValueChange={(v) => setFilterCountry(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Countries</SelectItem>
              {countries?.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {getCountryFlag(country.code)} {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory || "__all__"} onValueChange={(v) => { setFilterCategory(v === "__all__" ? "" : v); setFilterSubcategory(""); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterCategory && filteredSubcategories && filteredSubcategories.length > 0 && (
            <Select value={filterSubcategory || "__all__"} onValueChange={(v) => setFilterSubcategory(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Subcategories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Subcategories</SelectItem>
                {filteredSubcategories?.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Type
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Order</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Subcategory</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {types?.map((type) => (
            <TableRow key={type.id}>
              <TableCell className="text-muted-foreground">{type.sort_order}</TableCell>
              <TableCell className="font-mono">{type.code}</TableCell>
              <TableCell className="font-medium">{type.name}</TableCell>
              <TableCell>
                {type.country ? (
                  <span className="flex items-center gap-2">
                    {getCountryFlag(type.country.code)} {type.country.name}
                  </span>
                ) : (
                  <Badge variant="outline">All</Badge>
                )}
              </TableCell>
              <TableCell>
                {type.category ? (
                  <Badge variant="secondary">{type.category.name}</Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {type.subcategory ? (
                  <Badge variant="outline">{type.subcategory.name}</Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Badge variant={type.is_active ? "default" : "secondary"}>
                  {type.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(type)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleteType(type)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {types?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No application types found. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Application Type" : "Add Application Type"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update type details" : "Add a new application type (e.g., Subclass 482, VETASSESS)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="482"
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
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Temporary Skill Shortage"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select
                  value={form.country_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, country_id: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Countries</SelectItem>
                    {countries?.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {getCountryFlag(country.code)} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, category_id: value === "__none__" ? "" : value, subcategory_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.category_id && subcategories && subcategories.filter(s => s.category_id === form.category_id).length > 0 && (
              <div className="space-y-2">
                <Label>Subcategory (Optional)</Label>
                <Select
                  value={form.subcategory_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, subcategory_id: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {subcategories?.filter(s => s.category_id === form.category_id).map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
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

      <AlertDialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteType?.name}"? This may affect existing applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteType && deleteMutation.mutate(deleteType.id)}
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

// Sortable Document Row Component
interface SortableDocumentRowProps {
  doc: DocumentTemplate;
  onEdit: (doc: DocumentTemplate) => void;
  onDuplicate: (doc: DocumentTemplate) => void;
  onDelete: (doc: DocumentTemplate) => void;
}

function SortableDocumentRow({ doc, onEdit, onDuplicate, onDelete }: SortableDocumentRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{doc.document_name}</TableCell>
      <TableCell>
        {doc.category ? <Badge variant="outline">{doc.category}</Badge> : "—"}
      </TableCell>
      <TableCell>
        {doc.country ? (
          <span className="flex items-center gap-2">
            {getCountryFlag(doc.country.code)} {doc.country.name}
          </span>
        ) : (
          <Badge variant="outline">All</Badge>
        )}
      </TableCell>
      <TableCell>
        {doc.visa_type ? <Badge variant="secondary">{doc.visa_type.name}</Badge> : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={doc.is_required ? "default" : "secondary"}>
          {doc.is_required ? "Required" : "Optional"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDuplicate(doc)} title="Duplicate">
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => onDelete(doc)}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Document Checklist Tab Component
function DocumentsTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentTemplate | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentTemplate | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [form, setForm] = useState({
    document_name: "",
    category: "",
    country_id: "",
    visa_type_id: "",
    is_required: true,
    sort_order: 0,
  });

  const { data: countries } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Country[];
    },
  });

  const { data: visaTypes } = useQuery({
    queryKey: ["admin-visa-types-for-docs", filterCountry],
    queryFn: async () => {
      let query = supabase.from("visa_types").select("*").eq("is_active", true).order("name");
      if (filterCountry) query = query.eq("country_id", filterCountry);
      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationType[];
    },
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["admin-doc-templates", filterCountry, filterCategory],
    queryFn: async () => {
      // Only fetch global templates (company_id IS NULL)
      let query = supabase
        .from("document_checklist_templates")
        .select("*, country:countries(*), visa_type:visa_types(*)")
        .is("company_id", null)
        .order("sort_order");

      if (filterCountry) query = query.eq("country_id", filterCountry);
      if (filterCategory) query = query.eq("category", filterCategory);

      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentTemplate[];
    },
  });

  // Predefined document names by category
  const predefinedDocuments: Record<string, string[]> = {
    "Identity Documents": [
      "Passport",
      "Birth Certificate",
      "National ID Card",
      "Driver's License",
      "Marriage Certificate",
      "Divorce Certificate",
      "Name Change Certificate",
    ],
    "Financial Documents": [
      "Bank Statements",
      "Tax Returns",
      "Pay Slips",
      "Proof of Assets",
      "Investment Statements",
      "Credit Card Statements",
      "Loan Documents",
    ],
    "Employment Records": [
      "Employment Contract",
      "Reference Letters",
      "Resume/CV",
      "Job Offer Letter",
      "Salary Certificate",
      "Employment Verification Letter",
      "Work Experience Letters",
    ],
    "Educational Documents": [
      "Degree Certificate",
      "Transcripts",
      "Diploma",
      "Academic Records",
      "Professional Certifications",
      "Skills Assessment",
      "English Test Results",
    ],
    "Health & Medical": [
      "Medical Examination",
      "Vaccination Records",
      "Health Insurance",
      "Medical Clearance",
      "Chest X-Ray",
      "Blood Test Results",
    ],
    "Legal Documents": [
      "Police Clearance Certificate",
      "Character Reference",
      "Court Records",
      "Statutory Declaration",
      "Power of Attorney",
      "Affidavit",
    ],
    "Travel Documents": [
      "Previous Visas",
      "Travel History",
      "Flight Itinerary",
      "Hotel Bookings",
      "Travel Insurance",
    ],
    "Supporting Evidence": [
      "Photographs",
      "Relationship Evidence",
      "Sponsor Documents",
      "Accommodation Proof",
      "Business Registration",
    ],
  };

  // Predefined categories (keys from predefinedDocuments)
  const predefinedCategories = Object.keys(predefinedDocuments);

  // Get unique categories from documents, merged with predefined ones
  const documentCategories = [...new Set([
    ...predefinedCategories,
    ...(documents?.map((d) => d.category).filter(Boolean) || [])
  ])];

  // Get document names for the selected category (predefined + existing from DB)
  const getDocumentNamesForCategory = (category: string) => {
    const predefined = predefinedDocuments[category] || [];
    const existing = documents?.filter(d => d.category === category).map(d => d.document_name) || [];
    return [...new Set([...predefined, ...existing])].sort();
  };

  // Get all document names (for when no category is selected)
  const getAllDocumentNames = () => {
    const allPredefined = Object.values(predefinedDocuments).flat();
    const existing = documents?.map(d => d.document_name).filter(Boolean) || [];
    return [...new Set([...allPredefined, ...existing])].sort();
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        country_id: data.country_id || null,
        visa_type_id: data.visa_type_id || null,
        category: data.category || null,
        company_id: null, // Global template
      };
      if (editingDoc) {
        const { error } = await supabase
          .from("document_checklist_templates")
          .update(payload)
          .eq("id", editingDoc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_checklist_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doc-templates"] });
      toast.success(editingDoc ? "Document updated" : "Document created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_checklist_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doc-templates"] });
      toast.success("Document deleted");
      setDeleteDoc(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      // Update each item's sort order
      for (const item of items) {
        const { error } = await supabase
          .from("document_checklist_templates")
          .update({ sort_order: item.sort_order })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doc-templates"] });
      toast.success("Order updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && documents) {
      const oldIndex = documents.findIndex((doc) => doc.id === active.id);
      const newIndex = documents.findIndex((doc) => doc.id === over.id);

      const newOrder = arrayMove(documents, oldIndex, newIndex);
      const updates = newOrder.map((doc, index) => ({
        id: doc.id,
        sort_order: index * 10,
      }));

      reorderMutation.mutate(updates);
    }
  };

  const openCreate = () => {
    setEditingDoc(null);
    setForm({
      document_name: "",
      category: filterCategory || "",
      country_id: filterCountry || "",
      visa_type_id: "",
      is_required: true,
      sort_order: (documents?.length || 0) * 10,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (doc: DocumentTemplate) => {
    setEditingDoc(doc);
    setForm({
      document_name: doc.document_name,
      category: doc.category || "",
      country_id: doc.country_id || "",
      visa_type_id: doc.visa_type_id || "",
      is_required: doc.is_required,
      sort_order: doc.sort_order,
    });
    setIsDialogOpen(true);
  };

  const duplicateDoc = (doc: DocumentTemplate) => {
    setEditingDoc(null);
    setForm({
      document_name: `${doc.document_name} (Copy)`,
      category: doc.category || "",
      country_id: doc.country_id || "",
      visa_type_id: doc.visa_type_id || "",
      is_required: doc.is_required,
      sort_order: (documents?.length || 0) * 10,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingDoc(null);
  };

  const handleSave = () => {
    if (!form.document_name) {
      toast.error("Document name is required");
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <Select value={filterCountry || "__all__"} onValueChange={(v) => setFilterCountry(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Countries</SelectItem>
              {countries?.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {getCountryFlag(country.code)} {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory || "__all__"} onValueChange={(v) => setFilterCategory(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {documentCategories.map((cat) => (
                <SelectItem key={cat} value={cat!}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Document
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Document Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Visa Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext
              items={documents?.map((doc) => doc.id) || []}
              strategy={verticalListSortingStrategy}
            >
              {documents?.map((doc) => (
                <SortableDocumentRow
                  key={doc.id}
                  doc={doc}
                  onEdit={openEdit}
                  onDuplicate={duplicateDoc}
                  onDelete={setDeleteDoc}
                />
              ))}
            </SortableContext>
            {documents?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No document checklist items found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit Document" : "Add Document"}</DialogTitle>
            <DialogDescription>
              {editingDoc ? "Update document details" : "Add a new document to the checklist"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category || "__custom__"}
                  onValueChange={(value) => setForm({ ...form, category: value === "__custom__" ? "" : value, document_name: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">+ Add Custom Category</SelectItem>
                    {documentCategories.sort().map((cat) => (
                      <SelectItem key={cat} value={cat!}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(form.category === "" || !documentCategories.includes(form.category)) && (
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Enter custom category"
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Document Name</Label>
                <Select
                  value={form.document_name || "__custom__"}
                  onValueChange={(value) => setForm({ ...form, document_name: value === "__custom__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type a document name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">+ Add Custom Name</SelectItem>
                    {(form.category ? getDocumentNamesForCategory(form.category) : getAllDocumentNames()).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(form.document_name === "" || ![...getAllDocumentNames()].includes(form.document_name)) && (
                  <Input
                    value={form.document_name}
                    onChange={(e) => setForm({ ...form, document_name: e.target.value })}
                    placeholder="Enter custom document name"
                    className="mt-2"
                  />
                )}
              </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select
                  value={form.country_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, country_id: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Countries</SelectItem>
                    {countries?.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {getCountryFlag(country.code)} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visa Type (Optional)</Label>
                <Select
                  value={form.visa_type_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, visa_type_id: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Types</SelectItem>
                    {visaTypes?.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id}>
                        {vt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_required}
                onCheckedChange={(checked) => setForm({ ...form, is_required: checked })}
              />
              <Label>Required Document</Label>
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

      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDoc?.document_name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
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

// Main Component
export default function AdminReferenceData() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reference Data</h1>
          <p className="text-muted-foreground">
            Manage countries, application categories, types, and document checklist
          </p>
        </div>

        <Tabs defaultValue="countries" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="countries" className="gap-2">
              <Globe className="w-4 h-4" />
              Countries
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="subcategories" className="gap-2">
              <Layers className="w-4 h-4" />
              Subcategories
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2">
              <FileType className="w-4 h-4" />
              Application Types
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="w-4 h-4" />
              Document Checklist
            </TabsTrigger>
          </TabsList>

          <Card>
            <CardContent className="pt-6">
              <TabsContent value="countries" className="mt-0">
                <CountriesTab />
              </TabsContent>

              <TabsContent value="categories" className="mt-0">
                <CategoriesTab />
              </TabsContent>

              <TabsContent value="subcategories" className="mt-0">
                <SubcategoriesTab />
              </TabsContent>

              <TabsContent value="types" className="mt-0">
                <TypesTab />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <DocumentsTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
