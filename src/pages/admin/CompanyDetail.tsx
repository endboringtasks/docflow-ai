import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { format } from "date-fns";

interface CompanyDetailProps {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyDetail({ companyId, open, onOpenChange }: CompanyDetailProps) {
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["admin-company-detail", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

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

  const { data: driveConnection } = useQuery({
    queryKey: ["admin-drive-connection", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("google_drive_connections")
        .select("id, connected_email, root_folder_name, created_at")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-company-stats", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [{ count: clientsCount }, { count: mattersCount }] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("matters").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      ]);
      return { clients: clientsCount ?? 0, matters: mattersCount ?? 0 };
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
          <SheetTitle className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              company?.name
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Company Info</h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{company?.niche}</Badge>
                  <Badge variant="secondary" className="capitalize">{company?.subscription_plan}</Badge>
                  <Badge variant={company?.subscription_status === "active" ? "default" : "destructive"} className="capitalize">
                    {company?.subscription_status || "N/A"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Created {company?.created_at ? format(new Date(company.created_at), "MMM d, yyyy") : "N/A"}
                </div>
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
              <span className="text-xl font-semibold">{stats?.matters ?? 0}</span>
              <span className="text-xs text-muted-foreground">Matters</span>
            </div>
          </div>

          <Separator />

          {/* Google Drive */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Google Drive
            </h3>
            {driveConnection ? (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {driveConnection.connected_email}
                </div>
                {driveConnection.root_folder_name && (
                  <div className="text-sm text-muted-foreground">
                    Root: {driveConnection.root_folder_name}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Connected {format(new Date(driveConnection.created_at), "MMM d, yyyy")}
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
                    <Badge variant="outline" className="capitalize text-xs">
                      {member.role}
                    </Badge>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}