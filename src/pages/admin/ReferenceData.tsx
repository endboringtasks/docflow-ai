import { useState, useMemo } from "react";
import { useTableSort, SortableTableHead } from "@/hooks/useTableSort";
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
  Layers,
  Users,
  Languages,
  Tags,
} from "lucide-react";

import AdminDocumentsListTab from "@/components/admin/AdminDocumentsListTab";
import DocumentCategoriesTab from "@/components/admin/DocumentCategoriesTab";
import ApplicationChecklistTab from "@/components/admin/ApplicationChecklistTab";
import { toast } from "sonner";
import { getCountryFlag } from "@/lib/countryFlags";

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
  country_id: string | null;
  is_active: boolean;
  sort_order: number;
  category?: ApplicationCategory;
  country?: Country;
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

interface TranslationCertificationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  country_id: string | null;
  is_active: boolean;
  sort_order: number;
  country?: Country;
}



// Countries Tab Component
function CountriesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [deleteCountry, setDeleteCountry] = useState<Country | null>(null);
  const [form, setForm] = useState({ code: "", name: "", is_active: true, sort_order: 0 });

  const countryAccessors = useMemo(() => ({
    sort_order: (c: Country) => c.sort_order,
    code: (c: Country) => c.code,
    name: (c: Country) => c.name,
    status: (c: Country) => c.is_active ? "Active" : "Inactive",
  }), []);

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

  const { sortedData: sortedCountries, sortColumn, sortDirection, handleSort } = useTableSort(countries, countryAccessors);

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
            <SortableTableHead column="sort_order" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-12">Order</SortableTableHead>
            <TableHead>Flag</TableHead>
            <SortableTableHead column="code" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Code</SortableTableHead>
            <SortableTableHead column="name" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Name</SortableTableHead>
            <SortableTableHead column="status" currentSort={sortColumn} direction={sortDirection} onSort={handleSort}>Status</SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCountries.map((country) => (
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

  const catAccessors = useMemo(() => ({
    sort_order: (c: ApplicationCategory) => c.sort_order,
    code: (c: ApplicationCategory) => c.code,
    name: (c: ApplicationCategory) => c.name,
    country: (c: ApplicationCategory) => c.country?.name ?? "All Countries",
    status: (c: ApplicationCategory) => c.is_active ? "Active" : "Inactive",
  }), []);

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

  const { sortedData: sortedCategories, sortColumn: catSortCol, sortDirection: catSortDir, handleSort: handleCatSort } = useTableSort(categories, catAccessors);

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
            <SortableTableHead column="sort_order" currentSort={catSortCol} direction={catSortDir} onSort={handleCatSort} className="w-12">Order</SortableTableHead>
            <SortableTableHead column="code" currentSort={catSortCol} direction={catSortDir} onSort={handleCatSort}>Code</SortableTableHead>
            <SortableTableHead column="name" currentSort={catSortCol} direction={catSortDir} onSort={handleCatSort}>Name</SortableTableHead>
            <SortableTableHead column="country" currentSort={catSortCol} direction={catSortDir} onSort={handleCatSort}>Country</SortableTableHead>
            <TableHead>Description</TableHead>
            <SortableTableHead column="status" currentSort={catSortCol} direction={catSortDir} onSort={handleCatSort}>Status</SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCategories.map((category) => (
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
              application names.
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
    country_id: "" as string | null,
    is_active: true,
    sort_order: 0,
  });

  const subAccessors = useMemo(() => ({
    sort_order: (s: ApplicationSubcategory) => s.sort_order,
    code: (s: ApplicationSubcategory) => s.code,
    name: (s: ApplicationSubcategory) => s.name,
    category: (s: ApplicationSubcategory) => s.category?.name ?? "",
    country: (s: ApplicationSubcategory) => s.country?.name ?? s.category?.country?.name ?? "All",
    status: (s: ApplicationSubcategory) => s.is_active ? "Active" : "Inactive",
  }), []);

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

  const { data: countries } = useQuery({
    queryKey: ["admin-countries-for-subcats"],
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

  const { data: subcategories, isLoading } = useQuery({
    queryKey: ["admin-subcategories", filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("application_subcategories")
        .select("*, category:application_categories(*, country:countries(*)), country:countries(*)")
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
        country_id: data.country_id || null,
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
      country_id: null,
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
      country_id: subcategory.country_id,
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

  const { sortedData: sortedSubs, sortColumn: subSortCol, sortDirection: subSortDir, handleSort: handleSubSort } = useTableSort(subcategories, subAccessors);

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
            <SortableTableHead column="sort_order" currentSort={subSortCol} direction={subSortDir} onSort={handleSubSort} className="w-12">Order</SortableTableHead>
            <SortableTableHead column="code" currentSort={subSortCol} direction={subSortDir} onSort={handleSubSort}>Code</SortableTableHead>
            <SortableTableHead column="name" currentSort={subSortCol} direction={subSortDir} onSort={handleSubSort}>Name</SortableTableHead>
            <SortableTableHead column="category" currentSort={subSortCol} direction={subSortDir} onSort={handleSubSort}>Category</SortableTableHead>
            <SortableTableHead column="country" currentSort={subSortCol} direction={subSortDir} onSort={handleSubSort}>Country</SortableTableHead>
            <TableHead>Description</TableHead>
            <SortableTableHead column="status" currentSort={subSortCol} direction={subSortDir} onSort={handleSubSort}>Status</SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSubs.map((subcategory) => (
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
                {subcategory.country ? (
                  <span className="flex items-center gap-2">
                    {getCountryFlag(subcategory.country.code)} {subcategory.country.name}
                  </span>
                ) : subcategory.category?.country ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {getCountryFlag(subcategory.category.country.code)} {subcategory.category.country.name} (inherited)
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
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={form.country_id || "__all__"}
                onValueChange={(value) => setForm({ ...form, country_id: value === "__all__" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country (optional)" />
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
              application names.
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

// Applicant Types Tab Component
function ApplicantTypesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<{ id: string; name: string; code: string; sort_order: number; is_active: boolean } | null>(null);
  const [deleteType, setDeleteType] = useState<{ id: string; name: string; code: string; sort_order: number; is_active: boolean } | null>(null);
  const [form, setForm] = useState({ code: "", name: "", is_active: true, sort_order: 0 });

  const atAccessors = useMemo(() => ({
    sort_order: (t: any) => t.sort_order as number,
    code: (t: any) => t.code as string,
    name: (t: any) => t.name as string,
    status: (t: any) => t.is_active ? "Active" : "Inactive",
  }), []);

  const { data: applicantTypes, isLoading } = useQuery({
    queryKey: ["admin-applicant-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_types")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; is_active: boolean; sort_order: number }) => {
      if (editingType) {
        const { error } = await supabase
          .from("applicant_types")
          .update(data)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("applicant_types").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applicant-types"] });
      toast.success(editingType ? "Applicant type updated" : "Applicant type created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applicant_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applicant-types"] });
      toast.success("Applicant type deleted");
      setDeleteType(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingType(null);
    setForm({ code: "", name: "", is_active: true, sort_order: (applicantTypes?.length || 0) * 10 });
    setIsDialogOpen(true);
  };

  const openEdit = (type: { id: string; name: string; code: string; sort_order: number; is_active: boolean }) => {
    setEditingType(type);
    setForm({
      code: type.code,
      name: type.name,
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

  const { sortedData: sortedAT, sortColumn: atSortCol, sortDirection: atSortDir, handleSort: handleATSort } = useTableSort(applicantTypes, atAccessors);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Manage applicant types (Primary Applicant, Partner, Dependant, Sponsor)
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Applicant Type
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead column="sort_order" currentSort={atSortCol} direction={atSortDir} onSort={handleATSort} className="w-12">Order</SortableTableHead>
            <SortableTableHead column="code" currentSort={atSortCol} direction={atSortDir} onSort={handleATSort}>Code</SortableTableHead>
            <SortableTableHead column="name" currentSort={atSortCol} direction={atSortDir} onSort={handleATSort}>Name</SortableTableHead>
            <SortableTableHead column="status" currentSort={atSortCol} direction={atSortDir} onSort={handleATSort}>Status</SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAT.map((type) => (
            <TableRow key={type.id}>
              <TableCell className="text-muted-foreground">{type.sort_order}</TableCell>
              <TableCell className="font-mono">{type.code}</TableCell>
              <TableCell>{type.name}</TableCell>
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
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Applicant Type" : "Add Applicant Type"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update applicant type details" : "Add a new applicant type"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  placeholder="primary"
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
                placeholder="Primary Applicant"
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
            <AlertDialogTitle>Delete Applicant Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteType?.name}"? This may affect existing document templates.
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

// Application Names Tab Component
function TypesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ApplicationType | null>(null);
  const [deleteType, setDeleteType] = useState<ApplicationType | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
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

  const typesAccessors = useMemo(() => ({
    sort_order: (t: ApplicationType) => t.sort_order,
    code: (t: ApplicationType) => t.code,
    name: (t: ApplicationType) => t.name,
    country: (t: ApplicationType) => t.country?.name ?? "All",
    category: (t: ApplicationType) => t.category?.name ?? "",
    subcategory: (t: ApplicationType) => t.subcategory?.name ?? "",
    status: (t: ApplicationType) => t.is_active ? "Active" : "Inactive",
  }), []);

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
      toast.success(editingType ? "Application name updated" : "Application name created");
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
      toast.success("Application name deleted");
      setDeleteType(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("visa_types").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-types"] });
      toast.success(`${selectedTypes.size} application names deleted`);
      setSelectedTypes(new Set());
      setShowBulkDeleteDialog(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSelectType = (id: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTypes(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTypes.size === (types?.length || 0)) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(types?.map(t => t.id) || []));
    }
  };

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

  const { sortedData: sortedTypes, sortColumn: typesSortCol, sortDirection: typesSortDir, handleSort: handleTypesSort } = useTableSort(types, typesAccessors);

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
        <div className="flex gap-2">
          {selectedTypes.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedTypes.size} Selected
            </Button>
          )}
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Application Name
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={types && types.length > 0 && selectedTypes.size === types.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-input"
              />
            </TableHead>
            <SortableTableHead column="sort_order" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort} className="w-12">Order</SortableTableHead>
            <SortableTableHead column="code" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort}>Code</SortableTableHead>
            <SortableTableHead column="name" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort}>Name</SortableTableHead>
            <SortableTableHead column="country" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort}>Country</SortableTableHead>
            <SortableTableHead column="category" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort}>Category</SortableTableHead>
            <SortableTableHead column="subcategory" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort}>Subcategory</SortableTableHead>
            <SortableTableHead column="status" currentSort={typesSortCol} direction={typesSortDir} onSort={handleTypesSort}>Status</SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTypes.map((type) => (
            <TableRow key={type.id} className={selectedTypes.has(type.id) ? "bg-muted/50" : ""}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type.id)}
                  onChange={() => toggleSelectType(type.id)}
                  className="h-4 w-4 rounded border-input"
                />
              </TableCell>
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
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No application names found. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Application Name" : "Add Application Name"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update application name details" : "Add a new application name (e.g., Subclass 482, VETASSESS)"}
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
                    <SelectItem value="__none__">All Subcategories</SelectItem>
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
            <AlertDialogTitle>Delete Application Name</AlertDialogTitle>
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

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Application Names</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTypes.size} application names? This action cannot be undone and may affect existing applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedTypes))}
            >
              {bulkDeleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {selectedTypes.size} Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Translation Certifications Tab Component
function TranslationCertificationsTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TranslationCertificationType | null>(null);
  const [deleteType, setDeleteType] = useState<TranslationCertificationType | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", country_id: "", is_active: true, sort_order: 0 });

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

  const { data: certTypes, isLoading } = useQuery({
    queryKey: ["admin-translation-cert-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("translation_certification_types")
        .select("*, country:countries(*)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as TranslationCertificationType[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description: string; country_id: string; is_active: boolean; sort_order: number }) => {
      const payload = {
        ...data,
        country_id: data.country_id || null,
        description: data.description || null,
      };
      if (editingType) {
        const { error } = await supabase
          .from("translation_certification_types")
          .update(payload)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("translation_certification_types").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-translation-cert-types"] });
      toast.success(editingType ? "Certification type updated" : "Certification type created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("translation_certification_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-translation-cert-types"] });
      toast.success("Certification type deleted");
      setDeleteType(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingType(null);
    setForm({ code: "", name: "", description: "", country_id: "", is_active: true, sort_order: (certTypes?.length || 0) * 10 });
    setIsDialogOpen(true);
  };

  const openEdit = (type: TranslationCertificationType) => {
    setEditingType(type);
    setForm({
      code: type.code,
      name: type.name,
      description: type.description || "",
      country_id: type.country_id || "",
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
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Certification Type
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certTypes?.map((type) => (
            <TableRow key={type.id}>
              <TableCell className="font-mono">{type.code}</TableCell>
              <TableCell className="font-medium">{type.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{type.description || "—"}</TableCell>
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
          {certTypes?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No certification types found. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Certification Type" : "Add Certification Type"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update the certification type details" : "Add a new translation certification type"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., naati"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., NAATI Certified"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this certification type..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
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
            <AlertDialogTitle>Delete Certification Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteType?.name}"? This may affect document templates using this certification type.
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
              Application Names
            </TabsTrigger>
            <TabsTrigger value="applicant-types" className="gap-2">
              <Users className="w-4 h-4" />
              Applicant Types
            </TabsTrigger>
            <TabsTrigger value="translation-certs" className="gap-2">
              <Languages className="w-4 h-4" />
              Translation Certifications
            </TabsTrigger>
            <TabsTrigger value="documents-list" className="gap-2">
              <FileText className="w-4 h-4" />
              Documents List
            </TabsTrigger>
            <TabsTrigger value="app-checklist" className="gap-2">
              <Layers className="w-4 h-4" />
              Application Checklist
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

              <TabsContent value="applicant-types" className="mt-0">
                <ApplicantTypesTab />
              </TabsContent>


              <TabsContent value="translation-certs" className="mt-0">
                <TranslationCertificationsTab />
              </TabsContent>

              <TabsContent value="documents-list" className="mt-0">
                <AdminDocumentsListTab />
              </TabsContent>


              <TabsContent value="app-checklist" className="mt-0">
                <ApplicationChecklistTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
