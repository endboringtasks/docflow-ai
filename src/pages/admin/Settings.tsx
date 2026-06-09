import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Shield, UserPlus } from "lucide-react";
import { UploadSyncConfigCard } from "@/components/admin/UploadSyncConfigCard";
import { PlatformSettingsCard } from "@/components/admin/PlatformSettingsCard";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function AdminSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const { data: admins, isLoading: adminsLoading } = useQuery({
    queryKey: ["admin-platform-admins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_admins")
        .select(`
          *,
          profiles:user_id(email, display_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });



  const addAdmin = useMutation({
    mutationFn: async () => {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newAdminEmail)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error("User not found with that email");

      const { error } = await supabase.from("platform_admins").insert({
        user_id: profile.id,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-admins"] });
      setIsAdminDialogOpen(false);
      setNewAdminEmail("");
      toast.success("Admin added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add admin: " + error.message);
    },
  });

  const removeAdmin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_admins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-admins"] });
      toast.success("Admin removed");
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground">Manage API keys, configurations, and admins</p>
        </div>

        {/* Platform Admins */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Platform Admins
                </CardTitle>
                <CardDescription>Users with super admin access</CardDescription>
              </div>
              <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Admin
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Platform Admin</DialogTitle>
                    <DialogDescription>
                      Enter the email of an existing user to grant admin access
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">User Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAdminDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => addAdmin.mutate()} disabled={!newAdminEmail}>
                      Add Admin
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {adminsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : admins?.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No admins configured. Add the first admin to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins?.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        {(admin.profiles as any)?.display_name || "No name"}
                      </TableCell>
                      <TableCell>{(admin.profiles as any)?.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(admin.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAdmin.mutate(admin.id)}
                          disabled={admin.user_id === user?.id}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upload & Sync Config */}
        <UploadSyncConfigCard />

        {/* Platform Settings (DOC-63) */}
        <PlatformSettingsCard />
      </div>
    </AdminLayout>
  );
}
