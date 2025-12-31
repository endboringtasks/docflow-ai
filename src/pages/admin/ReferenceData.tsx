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
} from "lucide-react";
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

interface ApplicationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  country_id: string | null;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
  country?: Country;
  category?: ApplicationCategory;
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
                value={form.country_id}
                onValueChange={(value) => setForm({ ...form, country_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Countries</SelectItem>
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

// Application Types Tab Component
function TypesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ApplicationType | null>(null);
  const [deleteType, setDeleteType] = useState<ApplicationType | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    country_id: "",
    category_id: "",
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

  const { data: types, isLoading } = useQuery({
    queryKey: ["admin-types", filterCountry, filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("visa_types")
        .select("*, country:countries(*), category:application_categories(*)")
        .order("sort_order");

      if (filterCountry) query = query.eq("country_id", filterCountry);
      if (filterCategory) query = query.eq("category_id", filterCategory);

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
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Countries</SelectItem>
              {countries?.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {getCountryFlag(country.code)} {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  value={form.country_id}
                  onValueChange={(value) => setForm({ ...form, country_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Countries</SelectItem>
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
                  value={form.category_id}
                  onValueChange={(value) => setForm({ ...form, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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

// Document Templates Tab Component
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

  // Get unique categories from documents
  const documentCategories = [...new Set(documents?.map((d) => d.category).filter(Boolean) || [])];

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
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Countries</SelectItem>
              {countries?.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {getCountryFlag(country.code)} {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Order</TableHead>
            <TableHead>Document Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Visa Type</TableHead>
            <TableHead>Required</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents?.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="text-muted-foreground">{doc.sort_order}</TableCell>
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
                  <Button variant="ghost" size="icon" onClick={() => openEdit(doc)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleteDoc(doc)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {documents?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No document templates found. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit Document Template" : "Add Document Template"}</DialogTitle>
            <DialogDescription>
              {editingDoc ? "Update document details" : "Add a new document template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input
                value={form.document_name}
                onChange={(e) => setForm({ ...form, document_name: e.target.value })}
                placeholder="Passport"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Identity Documents"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select
                  value={form.country_id}
                  onValueChange={(value) => setForm({ ...form, country_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Countries</SelectItem>
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
                  value={form.visa_type_id}
                  onValueChange={(value) => setForm({ ...form, visa_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
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
            <AlertDialogTitle>Delete Document Template</AlertDialogTitle>
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
            Manage countries, application categories, types, and document templates
          </p>
        </div>

        <Tabs defaultValue="countries" className="space-y-4">
          <TabsList>
            <TabsTrigger value="countries" className="gap-2">
              <Globe className="w-4 h-4" />
              Countries
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2">
              <FileType className="w-4 h-4" />
              Application Types
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="w-4 h-4" />
              Document Templates
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
