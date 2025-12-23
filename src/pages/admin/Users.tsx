import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Search, Users as UsersIcon, Shield, UserCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useAuth } from "@/hooks/useAuth";

interface UserToImpersonate {
  id: string;
  email: string | null;
  display_name: string | null;
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { user: currentUser } = useAuth();
  const { startImpersonation, isLoading: impersonationLoading } = useImpersonation();
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [userToImpersonate, setUserToImpersonate] = useState<UserToImpersonate | null>(null);

  const openConfirmDialog = (user: UserToImpersonate) => {
    setUserToImpersonate(user);
    setConfirmDialogOpen(true);
  };

  const handleConfirmImpersonate = async () => {
    if (!userToImpersonate) return;
    setConfirmDialogOpen(false);
    setImpersonatingUserId(userToImpersonate.id);
    await startImpersonation(userToImpersonate.id);
    setImpersonatingUserId(null);
    setUserToImpersonate(null);
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get company memberships for each user
      const usersWithCompanies = await Promise.all(
        profiles.map(async (profile) => {
          const { data: memberships } = await supabase
            .from("company_members")
            .select(`
              role,
              companies(name)
            `)
            .eq("user_id", profile.id);

          const { data: isAdmin } = await supabase
            .from("platform_admins")
            .select("id")
            .eq("user_id", profile.id)
            .maybeSingle();

          return {
            ...profile,
            memberships: memberships || [],
            isPlatformAdmin: !!isAdmin,
          };
        })
      );

      return usersWithCompanies;
    },
  });

  const filteredUsers = users?.filter(
    (user) =>
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage all users on the platform</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5" />
                All Users
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Companies</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.display_name || "No name"}
                          {user.isPlatformAdmin && (
                            <Shield className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.memberships.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            user.memberships.slice(0, 2).map((m: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {m.companies?.name}
                              </Badge>
                            ))
                          )}
                          {user.memberships.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{user.memberships.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isPlatformAdmin ? (
                          <Badge>Super Admin</Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {user.id !== currentUser?.id && !user.isPlatformAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openConfirmDialog({ id: user.id, email: user.email, display_name: user.display_name })}
                            disabled={impersonationLoading && impersonatingUserId === user.id}
                          >
                            {impersonationLoading && impersonatingUserId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                            <span className="ml-2 hidden lg:inline">Impersonate</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Impersonation Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Impersonation</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to impersonate{" "}
                <span className="font-semibold">
                  {userToImpersonate?.display_name || userToImpersonate?.email}
                </span>
              </p>
              <p className="text-sm">
                This will log you into their account for support purposes. Your actions will be performed as this user. The session will automatically expire after 1 hour.
              </p>
              <p className="text-sm text-destructive font-medium">
                This action is logged for security purposes.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImpersonate}>
              Start Impersonation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
