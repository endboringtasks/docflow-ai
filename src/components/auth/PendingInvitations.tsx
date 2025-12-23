import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PendingInvitation {
  id: string;
  role: string;
  company: {
    name: string;
  } | null;
}

export function PendingInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("team_invitations")
        .select(`
          id,
          role,
          company:companies(name)
        `)
        .eq("email", user.email.toLowerCase())
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching invitations:", error);
      } else {
        setInvitations(data || []);
      }
      setIsLoading(false);
    };

    fetchInvitations();
  }, [user?.email]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5 text-primary" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          You have been invited to join the following workspaces
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between p-3 bg-background rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {invitation.company?.name || "Unknown Company"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Invited as {invitation.role}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">
              {invitation.role}
            </Badge>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-center pt-2">
          These invitations will be automatically accepted when you complete sign-up
        </p>
      </CardContent>
    </Card>
  );
}
