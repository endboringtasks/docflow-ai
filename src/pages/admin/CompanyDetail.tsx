import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Briefcase,
  FileText,
  HardDrive,
  Calendar,
  Mail,
  Crown,
  Shield,
  User,
  UserMinus,
  UserCog,
  Loader2,
  Unlink,
  Folder,
  ExternalLink,
  Pencil,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { useImpersonation } from "@/hooks/useImpersonation";
import { toast } from "sonner";
import { useState } from "react";
import { Database } from "@/integrations/supabase/types";

type SubscriptionPlan = Database["public"]["Enums"]["subscription_plan"];

interface CompanyDetailProps {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS: SubscriptionPlan[] = ["free", "basic", "pro", "enterprise"];

const NICHES = ["migration", "audit", "hr"] as const;
const STATUSES = ["active", "trialing", "past_due", "canceled", "incomplete"] as const;

export function CompanyDetail({ companyId, open, onOpenChange }: CompanyDetailProps) {
  const queryClient = useQueryClient();
  const { startImpersonation, isLoading: impersonationLoading } = useImpersonation();
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    niche: "" as string,
    subscription_plan: "" as string,
    subscription_status: "" as string,
  });

  const { data: company, isLoading: companyLoading, isFetched } = useQuery({
    queryKey: ["admin-company-detail", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const startEdit = () => {
    if (!company) return;
    setForm({
      name: company.name ?? "",
      niche: company.niche ?? "",
      subscription_plan: company.subscription_plan ?? "",
      subscription_status: company.subscription_status ?? "",
    });
    setIsEditing(true);
  };

  const nameError =
    !form.name.trim()
      ? "Name is required"
      : form.name.trim().length > 120
      ? "Name must be 120 characters or fewer"
      : "";
  const isFormValid = !nameError && NICHES.includes(form.niche as typeof NICHES[number]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("admin-update-company", {
        body: {
          companyId,
          expectedUpdatedAt: (company as any)?.updated_at,
          updates: {
            name: form.name.trim(),
            niche: form.niche,
            subscription_plan: form.subscription_plan,
            subscription_status: form.subscription_status || null,
          },
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (error) {
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === "function") {
          const parsed = await ctx.json().catch(() => null);
          if (parsed?.message) throw new Error(parsed.message);
          if (parsed?.error) throw new Error(parsed.error);
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-company-detail", companyId] });
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success("Company updated");
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update company");
    },
  });


  const handleImpersonate = async (userId: string) => {
    setImpersonatingUserId(userId);
    await startImpersonation(userId);
    setImpersonatingUserId(null);
  };

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["admin-company-members", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_members")
        .select(`
          id,
          role,
          created_at,
          user_id
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profiles separately
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);

      return data.map(member => ({
        ...member,
        profile: profiles?.find(p => p.id === member.user_id) || null,
      }));
    },
    enabled: !!companyId && open,
  });

  const { data: driveConnection, isLoading: driveLoading } = useQuery({
    queryKey: ["admin-drive-connection", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("google_drive_connections")
        .select("id, connected_email, root_folder_name, root_folder_id, created_at")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const disconnectDriveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { error } = await supabase.functions.invoke("google-drive-disconnect", {
        body: { companyId },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-drive-connection", companyId] });
      toast.success("Google Drive disconnected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Google Drive");
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-company-stats", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [{ count: clientsCount }, { count: visaApplicationsCount }] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("visa_applications").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      ]);
      return { clients: clientsCount ?? 0, visaApplications: visaApplicationsCount ?? 0 };
    },
    enabled: !!companyId && open,
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case "admin":
        return <Shield className="w-4 h-4 text-blue-500" />;
      case "member":
        return <User className="w-4 h-4 text-muted-foreground" />;
      case "guest":
        return <UserMinus className="w-4 h-4 text-muted-foreground" />;
      default:
        return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isLoading = companyLoading || membersLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle className="flex items-center gap-2">
              {isLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                company?.name ?? "Company"
              )}
            </SheetTitle>
            {!isLoading && company && !isEditing && (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        {!isLoading && isFetched && !company ? (
          <div className="mt-10 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
            <Building2 className="w-8 h-8" />
            <p className="text-sm font-medium">Company not found</p>
            <p className="text-xs">This company may have been removed.</p>
          </div>
        ) : (
        <div className="mt-6 space-y-6">
          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Company Info</h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name">Name</Label>
                  <Input
                    id="company-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    maxLength={120}
                  />
                  {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Niche</Label>
                  <Select value={form.niche} onValueChange={(v) => setForm((f) => ({ ...f, niche: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select niche" /></SelectTrigger>
                    <SelectContent>
                      {NICHES.map((n) => (
                        <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select value={form.subscription_plan} onValueChange={(v) => setForm((f) => ({ ...f, subscription_plan: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((plan) => (
                        <SelectItem key={plan} value={plan} className="capitalize">{plan}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.subscription_status} onValueChange={(v) => setForm((f) => ({ ...f, subscription_status: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>ID: {company?.id}</div>
                  <div>Created {company?.created_at ? format(new Date(company.created_at), "MMM d, yyyy") : "N/A"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={!isFormValid || saveMutation.isPending}
                  >
                    {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={saveMutation.isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{company?.niche}</Badge>
                  <Badge variant={company?.subscription_status === "active" ? "default" : "destructive"} className="capitalize">
                    {company?.subscription_status || "N/A"}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">{company?.subscription_plan}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Created {company?.created_at ? format(new Date(company.created_at), "MMM d, yyyy") : "N/A"}
                </div>
                {(company as any)?.updated_at && (
                  <div className="text-xs text-muted-foreground">
                    Last updated {format(new Date((company as any).updated_at), "MMM d, yyyy HH:mm")}
                  </div>
                )}
              </div>
            )}
          </div>


          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-muted-foreground mb-1" />
              <span className="text-xl font-semibold">{members?.length ?? 0}</span>
              <span className="text-xs text-muted-foreground">Members</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
              <Briefcase className="w-5 h-5 text-muted-foreground mb-1" />
              <span className="text-xl font-semibold">{stats?.clients ?? 0}</span>
              <span className="text-xs text-muted-foreground">Clients</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
              <FileText className="w-5 h-5 text-muted-foreground mb-1" />
              <span className="text-xl font-semibold">{stats?.visaApplications ?? 0}</span>
              <span className="text-xs text-muted-foreground">Visa Applications</span>
            </div>
          </div>

          <Separator />

          {/* Google Drive */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Google Drive
            </h3>
            {driveLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : driveConnection ? (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {driveConnection.connected_email}
                    </div>
                    {driveConnection.root_folder_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Folder className="w-4 h-4" />
                        {driveConnection.root_folder_name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Connected {format(new Date(driveConnection.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disconnectDriveMutation.isPending}
                      >
                        {disconnectDriveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Unlink className="w-4 h-4 mr-1" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the Google Drive connection for <strong>{company?.name}</strong>.
                          Existing folder links will remain but no new folders can be created.
                          The company owner will need to reconnect from their Settings page.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => disconnectDriveMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                Not connected
              </div>
            )}
          </div>

          <Separator />

          {/* Members */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Team Members</h3>
            {membersLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {getRoleIcon(member.role)}
                      <div>
                        <div className="text-sm font-medium">
                          {member.profile?.display_name || member.profile?.email || "Unknown"}
                        </div>
                        {member.profile?.display_name && member.profile?.email && (
                          <div className="text-xs text-muted-foreground">{member.profile.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        {member.role}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={impersonationLoading && impersonatingUserId === member.user_id}
                          >
                            {impersonationLoading && impersonatingUserId === member.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCog className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Impersonate User</AlertDialogTitle>
                            <AlertDialogDescription>
                              You are about to impersonate{" "}
                              <strong>{member.profile?.display_name || member.profile?.email}</strong>.
                              This will log you in as this user for support purposes.
                              The session will expire after 1 hour.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleImpersonate(member.user_id)}>
                              Start Impersonation
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {members?.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No members
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Audit Logs Link */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Audit Logs
            </h3>
            <a
              href={`/admin/audit-logs?company=${companyId}`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
            >
              <span className="text-sm">View audit logs for this company</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </a>
          </div>
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
