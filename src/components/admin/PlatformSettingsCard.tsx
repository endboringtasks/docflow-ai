import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Key,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

const PAGE_SIZE = 10;
const KEY_REGEX = /^[a-z0-9]+(\.[a-z0-9_]+)*$/;
const RESERVED_PREFIXES = ["auth.", "billing."];
const VALUE_MAX_LENGTH = 4096;
const KEY_MAX_LENGTH = 128;

type SecretFilter = "all" | "secret" | "non-secret";

interface SettingRow {
  id: string;
  key: string;
  value: any;
  description: string | null;
  is_secret: boolean;
  updated_at: string;
  updated_by: string | null;
}

function isReservedKey(key: string) {
  return RESERVED_PREFIXES.some((p) => key.startsWith(p));
}

function rawValue(value: any): string {
  const v = value?.value ?? value;
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function PlatformSettingsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [secretFilter, setSecretFilter] = useState<SecretFilter>("all");
  const [page, setPage] = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealConfirmId, setRevealConfirmId] = useState<string | null>(null);

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSetting, setNewSetting] = useState({ key: "", value: "", description: "", isSecret: false });
  const [createErrors, setCreateErrors] = useState<{ key?: string; value?: string }>({});

  // Edit dialog
  const [editRow, setEditRow] = useState<SettingRow | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSecret, setEditSecret] = useState(false);
  const [editReveal, setEditReveal] = useState(false);
  const [editError, setEditError] = useState<string | undefined>();

  const [deleteRow, setDeleteRow] = useState<SettingRow | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as SettingRow[];
    },
  });

  const updaterIds = useMemo(
    () => Array.from(new Set((settings ?? []).map((s) => s.updated_by).filter(Boolean))) as string[],
    [settings]
  );

  const { data: updaters } = useQuery({
    queryKey: ["admin-platform-settings-updaters", updaterIds],
    enabled: updaterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", updaterIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data || []) map[p.id] = (p as any).display_name || (p as any).email || "Unknown";
      return map;
    },
  });

  const filtered = useMemo(() => {
    let list = settings ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.key.toLowerCase().includes(q));
    }
    if (secretFilter === "secret") list = list.filter((s) => s.is_secret);
    if (secretFilter === "non-secret") list = list.filter((s) => !s.is_secret);
    return list;
  }, [settings, search, secretFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const createSetting = useMutation({
    mutationFn: async () => {
      const key = newSetting.key.trim();
      const errors: { key?: string; value?: string } = {};
      if (!key) errors.key = "Key is required";
      else if (key.length > KEY_MAX_LENGTH) errors.key = `Key must be at most ${KEY_MAX_LENGTH} characters`;
      else if (!KEY_REGEX.test(key)) errors.key = "Use lowercase, dot-separated keys (e.g. feature.flag)";
      else if (isReservedKey(key)) errors.key = "Reserved keys (auth.*, billing.*) cannot be created here";
      else if ((settings ?? []).some((s) => s.key === key)) errors.key = "A setting with this key already exists";

      if (!newSetting.value.trim()) errors.value = "Value is required";
      else if (newSetting.value.length > VALUE_MAX_LENGTH) errors.value = `Value must be at most ${VALUE_MAX_LENGTH} characters`;

      if (Object.keys(errors).length) {
        setCreateErrors(errors);
        throw new Error("validation");
      }
      setCreateErrors({});

      const { error } = await supabase.from("platform_settings").insert({
        key,
        value: { value: newSetting.value },
        description: newSetting.description || null,
        is_secret: newSetting.isSecret,
        updated_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      setIsCreateOpen(false);
      setNewSetting({ key: "", value: "", description: "", isSecret: false });
      toast.success("Setting created");
    },
    onError: (error: Error) => {
      if (error.message !== "validation") toast.error("Failed to create setting: " + error.message);
    },
  });

  const updateSetting = useMutation({
    mutationFn: async () => {
      if (!editRow) return;
      if (!editValue.trim()) {
        setEditError("Value is required");
        throw new Error("validation");
      }
      if (editValue.length > VALUE_MAX_LENGTH) {
        setEditError(`Value must be at most ${VALUE_MAX_LENGTH} characters`);
        throw new Error("validation");
      }
      setEditError(undefined);

      const { data, error } = await supabase
        .from("platform_settings")
        .update({
          value: { value: editValue },
          is_secret: editSecret,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editRow.id)
        .eq("updated_at", editRow.updated_at) // optimistic lock
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("This setting was changed by someone else. Please reopen and try again.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      setEditRow(null);
      toast.success("Setting updated");
    },
    onError: (error: Error) => {
      if (error.message !== "validation") toast.error(error.message);
    },
  });

  const deleteSetting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      setDeleteRow(null);
      toast.success("Setting deleted");
    },
    onError: (error: Error) => toast.error("Failed to delete setting: " + error.message),
  });

  const openEdit = (row: SettingRow) => {
    setEditRow(row);
    setEditValue(rawValue(row.value));
    setEditSecret(row.is_secret);
    setEditReveal(!row.is_secret);
    setEditError(undefined);
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updaterName = (id: string | null) => (id ? updaters?.[id] ?? "—" : "—");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Platform Settings
            </CardTitle>
            <CardDescription>Platform-wide key-value configuration and secrets</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setCreateErrors({}); setNewSetting({ key: "", value: "", description: "", isSecret: false }); setIsCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Setting
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by key..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={secretFilter} onValueChange={(v) => { setSecretFilter(v as SecretFilter); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All settings</SelectItem>
              <SelectItem value="secret">Secret only</SelectItem>
              <SelectItem value="non-secret">Non-secret</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {settings && settings.length > 0 ? "No settings match your filters." : "No settings configured yet."}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Secret</TableHead>
                  <TableHead>Updated at</TableHead>
                  <TableHead>Updated by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((setting) => {
                  const reserved = isReservedKey(setting.key);
                  const isShown = !setting.is_secret || revealed.has(setting.id);
                  return (
                    <TableRow key={setting.id}>
                      <TableCell className="font-mono text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          {reserved && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                          {setting.key}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[280px]">
                          <span className="text-sm text-muted-foreground truncate">
                            {isShown ? rawValue(setting.value) || "—" : "••••••••"}
                          </span>
                          {setting.is_secret && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() =>
                                revealed.has(setting.id) ? toggleReveal(setting.id) : setRevealConfirmId(setting.id)
                              }
                            >
                              {revealed.has(setting.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5 max-w-[320px]">
                          <span className="text-sm text-muted-foreground">
                            {setting.description || "—"}
                          </span>
                          <span className="shrink-0 pt-0.5">
                            <SettingGuidancePopover settingKey={setting.key} />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={setting.is_secret ? "secondary" : "outline"}>
                          {setting.is_secret ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(setting.updated_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{updaterName(setting.updated_by)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(setting)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={reserved}
                            onClick={() => setDeleteRow(setting)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {pageCount > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage + 1} of {pageCount} · {filtered.length} settings
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Setting</DialogTitle>
            <DialogDescription>Create a platform-wide configuration key.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-key">Key</Label>
              <Input
                id="new-key"
                placeholder="e.g. feature.new_dashboard"
                value={newSetting.key}
                onChange={(e) => setNewSetting((p) => ({ ...p, key: e.target.value }))}
              />
              {createErrors.key && <p className="text-sm text-destructive">{createErrors.key}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-value">Value</Label>
              <Input
                id="new-value"
                type={newSetting.isSecret ? "password" : "text"}
                placeholder="Value"
                value={newSetting.value}
                onChange={(e) => setNewSetting((p) => ({ ...p, value: e.target.value }))}
              />
              {createErrors.value && <p className="text-sm text-destructive">{createErrors.value}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-desc">Description (optional)</Label>
              <Input
                id="new-desc"
                placeholder="What is this setting for?"
                value={newSetting.description}
                onChange={(e) => setNewSetting((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="new-secret">Secret</Label>
                <p className="text-xs text-muted-foreground">Mask this value in the UI</p>
              </div>
              <Switch
                id="new-secret"
                checked={newSetting.isSecret}
                onCheckedChange={(c) => setNewSetting((p) => ({ ...p, isSecret: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createSetting.mutate()} disabled={createSetting.isPending}>
              {createSetting.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting</DialogTitle>
            <DialogDescription>Update the value of this platform setting.</DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Key</Label>
                <Input value={editRow.key} readOnly disabled className="font-mono" />
              </div>
              {isReservedKey(editRow.key) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Reserved key — value is read-only.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-value">Value</Label>
                <div className="relative">
                  <Input
                    id="edit-value"
                    type={editSecret && !editReveal ? "password" : "text"}
                    value={editValue}
                    disabled={isReservedKey(editRow.key)}
                    onChange={(e) => setEditValue(e.target.value)}
                    className={editSecret ? "pr-10" : undefined}
                  />
                  {editSecret && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setEditReveal((r) => !r)}
                    >
                      {editReveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
                {editError && <p className="text-sm text-destructive">{editError}</p>}
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="edit-secret">Secret</Label>
                  <p className="text-xs text-muted-foreground">Mask this value in the UI</p>
                </div>
                <Switch id="edit-secret" checked={editSecret} onCheckedChange={setEditSecret} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={() => updateSetting.mutate()} disabled={updateSetting.isPending}>
              {updateSetting.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal confirmation */}
      <AlertDialog open={!!revealConfirmId} onOpenChange={(o) => !o && setRevealConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reveal secret value?</AlertDialogTitle>
            <AlertDialogDescription>
              This will display a sensitive value in plain text. Make sure no one else can see your screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revealConfirmId) toggleReveal(revealConfirmId);
                setRevealConfirmId(null);
              }}
            >
              Reveal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete setting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-mono">{deleteRow?.key}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRow && deleteSetting.mutate(deleteRow.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
