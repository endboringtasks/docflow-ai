import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Users as UsersIcon, Shield, ShieldOff, UserCheck, Loader2, MoreHorizontal, Trash2, Mail, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserToImpersonate {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface UserToDelete {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface UserToToggleAdmin {
  id: string;
  email: string | null;
  display_name: string | null;
  isPlatformAdmin: boolean;
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { startImpersonation, isLoading: impersonationLoading } = useImpersonation();
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [userToImpersonate, setUserToImpersonate] = useState<UserToImpersonate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserToDelete | null>(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [userToToggleAdmin, setUserToToggleAdmin] = useState<UserToToggleAdmin | null>(null);
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const openConfirmDialog = (user: UserToImpersonate) => {
    setUserToImpersonate(user);
    setConfirmDialogOpen(true);
  };

  const openDeleteDialog = (user: UserToDelete) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const openAdminDialog = (user: UserToToggleAdmin) => {
    setUserToToggleAdmin(user);
    setAdminDialogOpen(true);
  };

  const handleConfirmImpersonate = async () => {
    if (!userToImpersonate) return;
    setConfirmDialogOpen(false);
    setImpersonatingUserId(userToImpersonate.id);
    await startImpersonation(userToImpersonate.id);
    setImpersonatingUserId(null);
    setUserToImpersonate(null);
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-delete-user", {
        body: { userId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      toast.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isPlatformAdmin }: { userId: string; isPlatformAdmin: boolean }) => {
      if (isPlatformAdmin) {
        // Demote: Remove from platform_admins
        const { error } = await supabase
          .from("platform_admins")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // Promote: Add to platform_admins
        const { error } = await supabase
          .from("platform_admins")
          .insert({ user_id: userId, created_by: currentUser?.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      const action = variables.isPlatformAdmin ? "removed from" : "promoted to";
      toast.success(`User ${action} Super Admin`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setAdminDialogOpen(false);
      setUserToToggleAdmin(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update admin status: " + error.message);
    },
  });

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    deleteUserMutation.mutate(userToDelete.id);
  };

  const handleConfirmToggleAdmin = () => {
    if (!userToToggleAdmin) return;
    toggleAdminMutation.mutate({ 
      userId: userToToggleAdmin.id, 
      isPlatformAdmin: userToToggleAdmin.isPlatformAdmin 
    });
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
                        {user.id !== currentUser?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openAdminDialog({ 
                                  id: user.id, 
                                  email: user.email, 
                                  display_name: user.display_name,
                                  isPlatformAdmin: user.isPlatformAdmin 
                                })}
                              >
                                {user.isPlatformAdmin ? (
                                  <>
                                    <ShieldOff className="w-4 h-4 mr-2" />
                                    Remove Super Admin
                                  </>
                                ) : (
                                  <>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Make Super Admin
                                  </>
                                )}
                              </DropdownMenuItem>
                              {!user.isPlatformAdmin && (
                                <DropdownMenuItem
                                  onClick={() => openConfirmDialog({ id: user.id, email: user.email, display_name: user.display_name })}
                                  disabled={impersonationLoading && impersonatingUserId === user.id}
                                >
                                  {impersonationLoading && impersonatingUserId === user.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <UserCheck className="w-4 h-4 mr-2" />
                                  )}
                                  Impersonate
                                </DropdownMenuItem>
                              )}
                              {!user.isPlatformAdmin && (
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog({ id: user.id, email: user.email, display_name: user.display_name })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  {userToDelete?.display_name || userToDelete?.email}
                </span>
                ?
              </p>
              <p className="text-sm">
                This action cannot be undone. The user will be permanently removed from the platform along with their profile data.
              </p>
              <p className="text-sm text-destructive font-medium">
                Company memberships and associated data may be affected.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Super Admin Confirmation Dialog */}
      <AlertDialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToToggleAdmin?.isPlatformAdmin ? "Remove Super Admin" : "Make Super Admin"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {userToToggleAdmin?.isPlatformAdmin ? (
                  <>
                    Are you sure you want to remove Super Admin privileges from{" "}
                    <span className="font-semibold">
                      {userToToggleAdmin?.display_name || userToToggleAdmin?.email}
                    </span>
                    ?
                  </>
                ) : (
                  <>
                    Are you sure you want to make{" "}
                    <span className="font-semibold">
                      {userToToggleAdmin?.display_name || userToToggleAdmin?.email}
                    </span>
                    {" "}a Super Admin?
                  </>
                )}
              </p>
              <p className="text-sm">
                {userToToggleAdmin?.isPlatformAdmin
                  ? "This user will lose access to all platform admin features."
                  : "This user will have full access to all platform admin features including user management, company oversight, and system settings."}
              </p>
              <p className="text-sm text-destructive font-medium">
                This action is logged for security purposes.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleAdminMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggleAdmin}
              disabled={toggleAdminMutation.isPending}
            >
              {toggleAdminMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {userToToggleAdmin?.isPlatformAdmin ? "Removing..." : "Promoting..."}
                </>
              ) : (
                userToToggleAdmin?.isPlatformAdmin ? "Remove Super Admin" : "Make Super Admin"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}