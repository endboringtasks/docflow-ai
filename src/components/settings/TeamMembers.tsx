import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Users, UserPlus, Trash2, Loader2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { z } from "zod";

type CompanyRole = "owner" | "admin" | "member" | "guest";

interface TeamMember {
  id: string;
  user_id: string;
  role: CompanyRole;
  created_at: string;
  profile: {
    email: string | null;
    display_name: string | null;
  } | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: CompanyRole;
  created_at: string;
  status: string;
}

const emailSchema = z.string().email("Please enter a valid email address");

const roleLabels: Record<CompanyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};

const roleBadgeVariants: Record<CompanyRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  guest: "outline",
};

export function TeamMembers() {
  const { user } = useAuth();
  const { currentCompany, currentRole, refetch: refetchCompany } = useCompany();
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [emailError, setEmailError] = useState("");

  const canManageTeam = currentRole === "owner" || currentRole === "admin";

  const fetchTeamData = async () => {
    if (!currentCompany) return;

    try {
      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("company_members")
        .select("id, user_id, role, created_at")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      // Fetch profiles for all member user_ids
      const userIds = membersData?.map(m => m.user_id) || [];
      let profilesMap: Record<string, { email: string | null; display_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds);

        profilesData?.forEach(p => {
          profilesMap[p.id] = { email: p.email, display_name: p.display_name };
        });
      }

      // Combine members with profiles
      const membersWithProfiles: TeamMember[] = (membersData || []).map(m => ({
        ...m,
        role: m.role as CompanyRole,
        profile: profilesMap[m.user_id] || null,
      }));

      // Fetch pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("team_invitations")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (invitationsError) throw invitationsError;

      setMembers(membersWithProfiles);
      setInvitations(invitationsData || []);
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast.error("Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [currentCompany]);

  const handleInvite = async () => {
    setEmailError("");
    
    const result = emailSchema.safeParse(inviteEmail);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }

    if (!currentCompany || !user) return;

    const normalizedEmail = inviteEmail.toLowerCase().trim();

    // Block inviting someone who is already an active team member
    const alreadyMember = members.some(
      (m) => (m.profile?.email || "").toLowerCase() === normalizedEmail
    );
    if (alreadyMember) {
      setEmailError("This person is already a team member");
      return;
    }

    setIsInviting(true);

    try {
      // Check for an existing invitation row for this company + email
      const { data: existing, error: existingError } = await supabase
        .from("team_invitations")
        .select("id, status")
        .eq("company_id", currentCompany.id)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.status === "pending") {
        toast.error("This email has already been invited");
        return;
      }

      let error;
      if (existing) {
        // Re-activate a previously cancelled/accepted invitation
        ({ error } = await supabase
          .from("team_invitations")
          .update({
            role: inviteRole,
            invited_by: user.id,
            status: "pending",
            created_at: new Date().toISOString(),
          })
          .eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("team_invitations").insert({
          company_id: currentCompany.id,
          email: normalizedEmail,
          role: inviteRole,
          invited_by: user.id,
        }));
      }

      if (error) {
        if (error.code === "23505") {
          toast.error("This email has already been invited");
        } else {
          throw error;
        }
      } else {
        toast.success("Invitation sent", {
          description: `${inviteEmail} will be added when they sign up`,
        });
        setInviteEmail("");
        setInviteRole("member");
        fetchTeamData();
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: CompanyRole) => {
    try {
      const { error } = await supabase
        .from("company_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Role updated");
      fetchTeamData();
      refetchCompany();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("company_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Member removed");
      fetchTeamData();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("team_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation cancelled");
      fetchTeamData();
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast.error("Failed to cancel invitation");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team Members
        </CardTitle>
        <CardDescription>
          Manage who has access to this workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Form */}
        {canManageTeam && (
          <div className="p-4 bg-secondary/50 rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="w-4 h-4" />
              Invite a team member
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setEmailError("");
                  }}
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && (
                  <p className="text-xs text-destructive">{emailError}</p>
                )}
              </div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={isInviting || !inviteEmail}>
                {isInviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They'll be automatically added when they sign up with this email
            </p>
          </div>
        )}

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Invitations
            </h4>
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-dashed border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited as {roleLabels[invitation.role]}
                    </p>
                  </div>
                </div>
                {canManageTeam && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel the pending invitation for {invitation.email}.
                          They will no longer be able to join using it. You can re-invite
                          them later if needed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep invitation</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Cancel invitation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Team Members List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Active Members ({members.length})
          </h4>
          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const isOwner = member.role === "owner";
            const canModify = canManageTeam && !isCurrentUser && !isOwner;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {(member.profile?.email || "U")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {member.profile?.display_name || member.profile?.email || "Unknown User"}
                      </p>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {member.profile?.email || member.user_id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canModify ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleUpdateRole(member.id, v as CompanyRole)}
                    >
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={roleBadgeVariants[member.role]}>
                      {roleLabels[member.role]}
                    </Badge>
                  )}

                  {canModify && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {member.profile?.email || "this user"} from the workspace. 
                            They will lose access to all company data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}