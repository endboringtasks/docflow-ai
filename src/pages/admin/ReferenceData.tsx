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
  GripVertical,
  Layers,
  Copy,
  CheckSquare,
  Users,
  Languages,
  Settings2,
} from "lucide-react";
import { CategoryApplicantRulesTab } from "@/components/admin/CategoryApplicantRulesTab";
import AdminDocumentsListTab from "@/components/admin/AdminDocumentsListTab";
import ApplicationChecklistTab from "@/components/admin/ApplicationChecklistTab";
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

type DocumentRequirementType = 'required' | 'conditional' | 'optional';

interface DocumentTemplate {
  id: string;
  document_name: string;
  category: string | null;
  visa_type_id: string | null;
  country_id: string | null;
  is_required: boolean;
  requirement_type: DocumentRequirementType;
  applicability_condition: string | null;
  sort_order: number;
  applicant_type_id: string | null;
  age_condition: string | null;
  description: string | null;
  min_files: number;
  max_files: number | null;
  requires_translation: boolean;
  translation_target_language: string | null;
  translation_certification_type_id: string | null;
  translation_notes: string | null;
  country?: Country;
  visa_type?: ApplicationType;
  applicant_type?: { id: string; name: string; code: string } | null;
  translation_certification_type?: TranslationCertificationType | null;
  document_template_applications?: { visa_type: ApplicationType }[];
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
            <TableHead className="w-12">Order</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applicantTypes?.map((type) => (
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

interface SortableDocumentRowProps {
  doc: DocumentTemplate;
  onEdit: (doc: DocumentTemplate) => void;
  onDuplicate: (doc: DocumentTemplate) => void;
  onDelete: (doc: DocumentTemplate) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

function SortableDocumentRow({ doc, onEdit, onDuplicate, onDelete, isSelected, onToggleSelect }: SortableDocumentRowProps) {
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
    <TableRow ref={setNodeRef} style={style} className={isSelected ? "bg-muted/50" : ""}>
      <TableCell>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(doc.id)}
            className="h-4 w-4 rounded border-input"
          />
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
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
        {doc.document_template_applications && doc.document_template_applications.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {doc.document_template_applications.map((app) => (
              <Badge key={app.visa_type.id} variant="secondary">{app.visa_type.name}</Badge>
            ))}
          </div>
        ) : doc.visa_type ? (
          <Badge variant="secondary">{doc.visa_type.name}</Badge>
        ) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {doc.applicant_type ? (
            <Badge variant="outline">{doc.applicant_type.name}</Badge>
          ) : "—"}
          {doc.age_condition && (
            <Badge variant="secondary" className="text-xs">{doc.age_condition}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge 
          variant={doc.requirement_type === "required" ? "default" : doc.requirement_type === "conditional" ? "outline" : "secondary"}
          className={doc.requirement_type === "conditional" ? "border-amber-500 text-amber-600 dark:text-amber-400" : ""}
        >
          {doc.requirement_type === "required" ? "Required" : doc.requirement_type === "conditional" ? "If Applicable" : "Optional"}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {doc.min_files === doc.max_files 
            ? doc.min_files
            : `${doc.min_files}–${doc.max_files ?? '∞'}`}
        </span>
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

function DocumentsTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentTemplate | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentTemplate | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignIds, setBulkAssignIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    document_name: "",
    category: "",
    country_id: "",
    visa_type_ids: [] as string[],
    is_required: true,
    requirement_type: "required" as DocumentRequirementType,
    applicability_condition: "",
    sort_order: 0,
    applicant_type_id: "",
    age_condition: "",
    description: "",
    min_files: 1,
    max_files: 1,
    requires_translation: false,
    translation_target_language: "English",
    translation_certification_type_id: "",
    translation_notes: "",
  });
  const [dialogCategoryFilter, setDialogCategoryFilter] = useState<string>("");
  const [dialogSubcategoryFilter, setDialogSubcategoryFilter] = useState<string>("");

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

  const { data: applicantTypes } = useQuery({
    queryKey: ["admin-applicant-types-for-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Categories for dialog filter
  const { data: dialogCategories } = useQuery({
    queryKey: ["admin-categories-for-dialog", form.country_id],
    queryFn: async () => {
      let query = supabase.from("application_categories").select("*").eq("is_active", true).order("sort_order");
      if (form.country_id) query = query.eq("country_id", form.country_id);
      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationCategory[];
    },
    enabled: isDialogOpen,
  });

  // Subcategories for dialog filter
  const { data: dialogSubcategories } = useQuery({
    queryKey: ["admin-subcategories-for-dialog", dialogCategoryFilter],
    queryFn: async () => {
      let query = supabase.from("application_subcategories").select("*").eq("is_active", true).order("sort_order");
      if (dialogCategoryFilter) query = query.eq("category_id", dialogCategoryFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationSubcategory[];
    },
    enabled: isDialogOpen,
  });

  // Visa types filtered by form.country_id, category, and subcategory for the dialog
  const { data: dialogVisaTypes } = useQuery({
    queryKey: ["admin-visa-types-for-dialog", form.country_id, dialogCategoryFilter, dialogSubcategoryFilter],
    queryFn: async () => {
      let query = supabase.from("visa_types").select("*").eq("is_active", true).order("name");
      if (form.country_id) query = query.eq("country_id", form.country_id);
      if (dialogCategoryFilter) query = query.eq("category_id", dialogCategoryFilter);
      if (dialogSubcategoryFilter) query = query.eq("subcategory_id", dialogSubcategoryFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as ApplicationType[];
    },
    enabled: isDialogOpen,
  });

  const { data: certificationTypes } = useQuery({
    queryKey: ["admin-translation-cert-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("translation_certification_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as TranslationCertificationType[];
    },
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["admin-doc-templates", filterCountry, filterCategory],
    queryFn: async () => {
      // Only fetch global templates (company_id IS NULL)
      let query = supabase
        .from("document_checklist_templates")
        .select("*, country:countries(*), applicant_type:applicant_types(*), translation_certification_type:translation_certification_types(*), document_template_applications(visa_type:visa_types(*))")
        .is("company_id", null)
        .order("sort_order");

      if (filterCountry) query = query.eq("country_id", filterCountry);
      if (filterCategory) query = query.eq("category", filterCategory);

      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentTemplate[];
    },
  });

  // Fetch document definitions from the master catalog
  const { data: documentDefinitions } = useQuery({
    queryKey: ["admin-document-definitions-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_definitions")
        .select("id, category, document_name")
        .eq("is_active", true)
        .order("category")
        .order("document_name");
      if (error) throw error;
      return data as { id: string; category: string; document_name: string }[];
    },
  });

  // Get unique categories from definitions + existing templates
  const documentCategories = [...new Set([
    ...(documentDefinitions?.map((d) => d.category) || []),
    ...(documents?.map((d) => d.category).filter(Boolean) || [])
  ])].sort();

  // Get document names for the selected category
  const getDocumentNamesForCategory = (category: string) => {
    const fromDefinitions = documentDefinitions?.filter(d => d.category === category).map(d => d.document_name) || [];
    const existing = documents?.filter(d => d.category === category).map(d => d.document_name) || [];
    return [...new Set([...fromDefinitions, ...existing])].sort();
  };

  // Get all document names (for when no category is selected)
  const getAllDocumentNames = () => {
    const fromDefinitions = documentDefinitions?.map(d => d.document_name) || [];
    const existing = documents?.map(d => d.document_name).filter(Boolean) || [];
    return [...new Set([...fromDefinitions, ...existing])].sort();
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const { visa_type_ids, ...rest } = data;
      const payload = {
        document_name: rest.document_name,
        country_id: rest.country_id || null,
        category: rest.category || null,
        is_required: rest.requirement_type === 'required',
        requirement_type: rest.requirement_type,
        applicability_condition: rest.requirement_type === 'conditional' ? (rest.applicability_condition || null) : null,
        sort_order: rest.sort_order,
        company_id: null, // Global template
        visa_type_id: null, // No longer used, using junction table
        applicant_type_id: rest.applicant_type_id || null,
        age_condition: rest.age_condition || null,
        description: rest.description || null,
        min_files: rest.min_files,
        max_files: rest.max_files || null,
        requires_translation: rest.requires_translation,
        translation_target_language: rest.requires_translation ? (rest.translation_target_language || "English") : null,
        translation_certification_type_id: rest.requires_translation ? (rest.translation_certification_type_id || null) : null,
        translation_notes: rest.requires_translation ? (rest.translation_notes || null) : null,
      };
      
      let templateId: string;
      
      if (editingDoc) {
        const { error } = await supabase
          .from("document_checklist_templates")
          .update(payload)
          .eq("id", editingDoc.id);
        if (error) throw error;
        templateId = editingDoc.id;
        
        // Delete existing junction records
        const { error: deleteError } = await supabase
          .from("document_template_applications")
          .delete()
          .eq("document_template_id", editingDoc.id);
        if (deleteError) throw deleteError;
      } else {
        const { data: inserted, error } = await supabase
          .from("document_checklist_templates")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        templateId = inserted.id;
      }
      
      // Insert new junction records
      if (visa_type_ids.length > 0) {
        const junctionRecords = visa_type_ids.map(vtId => ({
          document_template_id: templateId,
          visa_type_id: vtId,
        }));
        const { error: junctionError } = await supabase
          .from("document_template_applications")
          .insert(junctionRecords);
        if (junctionError) throw junctionError;
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from("document_checklist_templates").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doc-templates"] });
      toast.success(`${selectedIds.length} documents deleted`);
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ docIds, appIds }: { docIds: string[]; appIds: string[] }) => {
      for (const docId of docIds) {
        // Delete existing junction records
        const { error: deleteError } = await supabase
          .from("document_template_applications")
          .delete()
          .eq("document_template_id", docId);
        if (deleteError) throw deleteError;
        
        // Insert new junction records
        if (appIds.length > 0) {
          const junctionRecords = appIds.map(vtId => ({
            document_template_id: docId,
            visa_type_id: vtId,
          }));
          const { error: junctionError } = await supabase
            .from("document_template_applications")
            .insert(junctionRecords);
          if (junctionError) throw junctionError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doc-templates"] });
      toast.success(`Applications assigned to ${selectedIds.length} documents`);
      setSelectedIds([]);
      setIsBulkAssignOpen(false);
      setBulkAssignIds([]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (documents) {
      if (selectedIds.length === documents.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(documents.map(d => d.id));
      }
    }
  };

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
      visa_type_ids: [],
      is_required: true,
      requirement_type: "required" as DocumentRequirementType,
      applicability_condition: "",
      sort_order: (documents?.length || 0) * 10,
      applicant_type_id: "",
      age_condition: "",
      description: "",
      min_files: 1,
      max_files: 1,
      requires_translation: false,
      translation_target_language: "English",
      translation_certification_type_id: "",
      translation_notes: "",
    });
    setDialogCategoryFilter("");
    setDialogSubcategoryFilter("");
    setIsDialogOpen(true);
  };

  const openEdit = (doc: DocumentTemplate) => {
    setEditingDoc(doc);
    // Get visa_type_ids from junction table or fallback to legacy visa_type_id
    const visaTypeIds = doc.document_template_applications?.map(app => app.visa_type.id) || 
                        (doc.visa_type_id ? [doc.visa_type_id] : []);
    setForm({
      document_name: doc.document_name,
      category: doc.category || "",
      country_id: doc.country_id || "",
      visa_type_ids: visaTypeIds,
      is_required: doc.is_required,
      requirement_type: (doc.requirement_type || "required") as DocumentRequirementType,
      applicability_condition: doc.applicability_condition || "",
      sort_order: doc.sort_order,
      applicant_type_id: doc.applicant_type_id || "",
      age_condition: doc.age_condition || "",
      description: doc.description || "",
      min_files: doc.min_files ?? 1,
      max_files: doc.max_files ?? 1,
      requires_translation: doc.requires_translation ?? false,
      translation_target_language: doc.translation_target_language || "English",
      translation_certification_type_id: doc.translation_certification_type_id || "",
      translation_notes: doc.translation_notes || "",
    });
    setDialogCategoryFilter("");
    setDialogSubcategoryFilter("");
    setIsDialogOpen(true);
  };

  const duplicateDoc = (doc: DocumentTemplate) => {
    setEditingDoc(null);
    const visaTypeIds = doc.document_template_applications?.map(app => app.visa_type.id) || 
                        (doc.visa_type_id ? [doc.visa_type_id] : []);
    setForm({
      document_name: `${doc.document_name} (Copy)`,
      category: doc.category || "",
      country_id: doc.country_id || "",
      visa_type_ids: visaTypeIds,
      is_required: doc.is_required,
      requirement_type: (doc.requirement_type || "required") as DocumentRequirementType,
      applicability_condition: doc.applicability_condition || "",
      sort_order: (documents?.length || 0) * 10,
      applicant_type_id: doc.applicant_type_id || "",
      age_condition: doc.age_condition || "",
      description: doc.description || "",
      min_files: doc.min_files ?? 1,
      max_files: doc.max_files ?? 1,
      requires_translation: doc.requires_translation ?? false,
      translation_target_language: doc.translation_target_language || "English",
      translation_certification_type_id: doc.translation_certification_type_id || "",
      translation_notes: doc.translation_notes || "",
    });
    setDialogCategoryFilter("");
    setDialogSubcategoryFilter("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingDoc(null);
    setDialogCategoryFilter("");
    setDialogSubcategoryFilter("");
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
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsBulkAssignOpen(true)}
              >
                Assign Applications
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setIsBulkDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Link Document
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">
                <input
                  type="checkbox"
                  checked={documents ? selectedIds.length === documents.length && documents.length > 0 : false}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-input"
                />
              </TableHead>
              <TableHead>Document Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Application Name</TableHead>
              <TableHead>Applicant Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Files</TableHead>
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
                  isSelected={selectedIds.includes(doc.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </SortableContext>
            {documents?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
            <DialogTitle>{editingDoc ? "Edit Document" : "Link Document"}</DialogTitle>
            <DialogDescription>
              {editingDoc ? "Update document details" : "Link an existing document to the checklist"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category || ""}
                  onValueChange={(value) => setForm({ ...form, category: value, document_name: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentCategories.sort().map((cat) => (
                      <SelectItem key={cat} value={cat!}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Document Name</Label>
                <Select
                  value={form.document_name || ""}
                  onValueChange={(value) => setForm({ ...form, document_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a document name" />
                  </SelectTrigger>
                  <SelectContent>
                    {(form.category ? getDocumentNamesForCategory(form.category) : getAllDocumentNames()).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onValueChange={(value) => {
                    setForm({ ...form, country_id: value === "__none__" ? "" : value, visa_type_ids: [] });
                    setDialogCategoryFilter("");
                    setDialogSubcategoryFilter("");
                  }}
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
                <Label>Filter by Category</Label>
                <Select
                  value={dialogCategoryFilter || "__none__"}
                  onValueChange={(value) => {
                    setDialogCategoryFilter(value === "__none__" ? "" : value);
                    setDialogSubcategoryFilter("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Categories</SelectItem>
                    {dialogCategories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filter by Sub-category</Label>
                <Select
                  value={dialogSubcategoryFilter || "__none__"}
                  onValueChange={(value) => setDialogSubcategoryFilter(value === "__none__" ? "" : value)}
                  disabled={!dialogCategoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={dialogCategoryFilter ? "All sub-categories" : "Select a category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Sub-categories</SelectItem>
                    {dialogSubcategories?.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Application Names (Optional)</Label>
                  {dialogVisaTypes && dialogVisaTypes.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setForm({ ...form, visa_type_ids: dialogVisaTypes.map(vt => vt.id) })}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setForm({ ...form, visa_type_ids: [] })}
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                  {dialogVisaTypes?.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No application names available
                      {form.country_id || dialogCategoryFilter || dialogSubcategoryFilter ? " for the selected filters" : ""}
                    </p>
                  ) : (
                    dialogVisaTypes?.map((vt) => (
                      <label
                        key={vt.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.visa_type_ids.includes(vt.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, visa_type_ids: [...form.visa_type_ids, vt.id] });
                            } else {
                              setForm({ ...form, visa_type_ids: form.visa_type_ids.filter(id => id !== vt.id) });
                            }
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">{vt.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {form.visa_type_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground">{form.visa_type_ids.length} selected</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Applicant Type</Label>
                <Select
                  value={form.applicant_type_id || "__none__"}
                  onValueChange={(value) => setForm({ ...form, applicant_type_id: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select applicant type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No specific type</SelectItem>
                    {applicantTypes?.map((at) => (
                      <SelectItem key={at.id} value={at.id}>
                        {at.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Age Condition</Label>
                <Input
                  value={form.age_condition}
                  onChange={(e) => setForm({ ...form, age_condition: e.target.value })}
                  placeholder="e.g., +16yrs, Under 18"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Files Required</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.min_files}
                  onChange={(e) => setForm({ ...form, min_files: Math.max(1, parseInt(e.target.value) || 1) })}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum number of files clients must upload
                </p>
              </div>
              <div className="space-y-2">
                <Label>Max Files Allowed</Label>
                <Input
                  type="number"
                  min={form.min_files}
                  value={form.max_files}
                  onChange={(e) => setForm({ ...form, max_files: Math.max(form.min_files, parseInt(e.target.value) || 1) })}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of files clients can upload
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Requirement Type</Label>
              <Select
                value={form.requirement_type}
                onValueChange={(value: DocumentRequirementType) => setForm({ ...form, requirement_type: value, is_required: value === 'required' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select requirement type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="conditional">If Applicable</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.requirement_type === 'required' && "Document is mandatory for all applications"}
                {form.requirement_type === 'conditional' && "Document is only required in specific situations"}
                {form.requirement_type === 'optional' && "Document is not required but may support the application"}
              </p>
            </div>
            {form.requirement_type === 'conditional' && (
              <div className="space-y-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <Label className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                  When is this document required?
                </Label>
                <Select
                  value={form.applicability_condition || "__custom__"}
                  onValueChange={(value) => setForm({ ...form, applicability_condition: value === "__custom__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type a condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">+ Custom Condition</SelectItem>
                    <SelectItem value="If previously married">If previously married</SelectItem>
                    <SelectItem value="If spouse/partner deceased">If spouse/partner deceased</SelectItem>
                    <SelectItem value="If divorced">If divorced</SelectItem>
                    <SelectItem value="If widowed">If widowed</SelectItem>
                    <SelectItem value="If changed name">If changed name</SelectItem>
                    <SelectItem value="If self-employed">If self-employed</SelectItem>
                    <SelectItem value="If has children">If has children</SelectItem>
                    <SelectItem value="If served in armed forces">If served in armed forces</SelectItem>
                    <SelectItem value="If adopted">If adopted</SelectItem>
                    <SelectItem value="If custody arrangements exist">If custody arrangements exist</SelectItem>
                    <SelectItem value="If owns property">If owns property</SelectItem>
                    <SelectItem value="If previously refused visa">If previously refused visa</SelectItem>
                  </SelectContent>
                </Select>
                {(form.applicability_condition === "" || ![
                  "If previously married", "If spouse/partner deceased", "If divorced", "If widowed",
                  "If changed name", "If self-employed", "If has children", "If served in armed forces",
                  "If adopted", "If custody arrangements exist", "If owns property", "If previously refused visa"
                ].includes(form.applicability_condition)) && (
                  <Input
                    value={form.applicability_condition}
                    onChange={(e) => setForm({ ...form, applicability_condition: e.target.value })}
                    placeholder="e.g., If previously married"
                    className="mt-2"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  This condition will be shown to staff and clients to indicate when this document is needed
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={form.requires_translation}
                onCheckedChange={(checked) => setForm({ ...form, requires_translation: checked })}
              />
              <Label>Requires Translation</Label>
            </div>
            {form.requires_translation && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  Translation Requirements
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Language</Label>
                    <Select
                      value={form.translation_target_language || "English"}
                      onValueChange={(value) => setForm({ ...form, translation_target_language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="Portuguese">Portuguese</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                        <SelectItem value="German">German</SelectItem>
                        <SelectItem value="Italian">Italian</SelectItem>
                        <SelectItem value="Chinese">Chinese</SelectItem>
                        <SelectItem value="Japanese">Japanese</SelectItem>
                        <SelectItem value="Korean">Korean</SelectItem>
                        <SelectItem value="Arabic">Arabic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Certification Type</Label>
                    <Select
                      value={form.translation_certification_type_id || "__none__"}
                      onValueChange={(value) => setForm({ ...form, translation_certification_type_id: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select certification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Any Certified Translator</SelectItem>
                        {certificationTypes?.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>
                            {ct.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Translation Notes / Instructions</Label>
                  <Textarea
                    value={form.translation_notes}
                    onChange={(e) => setForm({ ...form, translation_notes: e.target.value })}
                    placeholder="e.g., Translation must be on letterhead with translator credentials..."
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Special instructions that will be shown to clients for the translation document.
                  </p>
                </div>
              </div>
            )}
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

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} selected documents? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
            >
              {bulkDeleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {selectedIds.length} Documents
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assign Applications Dialog */}
      <Dialog open={isBulkAssignOpen} onOpenChange={(open) => {
        setIsBulkAssignOpen(open);
        if (!open) setBulkAssignIds([]);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Applications to {selectedIds.length} Documents</DialogTitle>
            <DialogDescription>
              Select the application names to assign to the selected documents. This will replace any existing assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Application Names</Label>
              {visaTypes && visaTypes.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setBulkAssignIds(visaTypes.map(vt => vt.id))}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setBulkAssignIds([])}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>
            <div className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
              {visaTypes?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">No application names available</p>
              ) : (
                visaTypes?.map((vt) => (
                  <label
                    key={vt.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={bulkAssignIds.includes(vt.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkAssignIds([...bulkAssignIds, vt.id]);
                        } else {
                          setBulkAssignIds(bulkAssignIds.filter(id => id !== vt.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">{vt.name}</span>
                  </label>
                ))
              )}
            </div>
            {bulkAssignIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{bulkAssignIds.length} applications selected</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkAssignMutation.mutate({ docIds: selectedIds, appIds: bulkAssignIds })}
              disabled={bulkAssignMutation.isPending}
            >
              {bulkAssignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign to {selectedIds.length} Documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <TabsTrigger value="category-applicant-rules" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Category Rules
            </TabsTrigger>
            <TabsTrigger value="translation-certs" className="gap-2">
              <Languages className="w-4 h-4" />
              Translation Certifications
            </TabsTrigger>
            <TabsTrigger value="documents-list" className="gap-2">
              <FileText className="w-4 h-4" />
              Documents List
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <CheckSquare className="w-4 h-4" />
              Document Checklist
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

              <TabsContent value="category-applicant-rules" className="mt-0">
                <CategoryApplicantRulesTab />
              </TabsContent>

              <TabsContent value="translation-certs" className="mt-0">
                <TranslationCertificationsTab />
              </TabsContent>

              <TabsContent value="documents-list" className="mt-0">
                <AdminDocumentsListTab />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <DocumentsTab />
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
