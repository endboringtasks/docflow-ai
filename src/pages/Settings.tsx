import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Mail, Calendar, Shield, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { TeamMembers } from "@/components/settings/TeamMembers";
import { UserProfile } from "@/components/settings/UserProfile";
import { GoogleDriveConnection } from "@/components/settings/GoogleDriveConnection";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { SEO } from "@/components/SEO";

const Settings = () => {
  const { user } = useAuth();
  const { currentCompany, currentRole, refetch } = useCompany();
  
  const [companyName, setCompanyName] = useState(currentCompany?.name || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [saved, setSaved] = useState(false);

  const canEditCompany = currentRole === "owner" || currentRole === "admin";

  const handleUpdateCompanyName = async () => {
    if (!currentCompany || !companyName.trim()) return;
    
    setIsUpdating(true);
    
    const { error } = await supabase
      .from("companies")
      .update({ name: companyName.trim() })
      .eq("id", currentCompany.id);
    
    if (error) {
      toast.error("Failed to update company name", {
        description: error.message,
      });
    } else {
      toast.success("Company name updated");
      setSaved(true);
      await refetch();
      setTimeout(() => setSaved(false), 2000);
    }
    
    setIsUpdating(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const niche = currentCompany?.niche || "migration";

  return (
    <>
      <SEO 
        title="Settings"
        description="Manage your Docflow AI account and company settings. Configure team members, integrations, and preferences."
        noIndex
      />
      <AppLayout niche={niche}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and company settings
          </p>
        </div>

        {/* User Profile */}
        <UserProfile />

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Account Details
            </CardTitle>
            <CardDescription>
              Your personal account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{user?.email}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {user?.created_at ? formatDate(user.created_at) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Company Settings
            </CardTitle>
            <CardDescription>
              Manage your company workspace settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <div className="flex gap-3">
                <Input
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="Enter company name"
                  className="flex-1"
                  disabled={!canEditCompany}
                />
                {canEditCompany && (
                  <Button
                    onClick={handleUpdateCompanyName}
                    disabled={isUpdating || !companyName.trim() || companyName === currentCompany?.name}
                    className="min-w-[100px]"
                  >
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </Button>
                )}
              </div>
              {!canEditCompany && (
                <p className="text-xs text-muted-foreground">
                  Only owners and admins can edit company settings
                </p>
              )}
            </div>

            <Separator />

            {/* Company Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Industry</label>
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <span className="text-sm capitalize">{currentCompany?.niche}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {currentCompany?.created_at ? formatDate(currentCompany.created_at) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Role & Permissions
            </CardTitle>
            <CardDescription>
              Your access level in this workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm capitalize px-3 py-1">
                {currentRole}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {currentRole === "owner" && "Full access to all features and settings"}
                {currentRole === "admin" && "Can manage members and most settings"}
                {currentRole === "member" && "Can view and edit company data"}
                {currentRole === "guest" && "Limited read-only access"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Google Drive Integration */}
        <GoogleDriveConnection />

        {/* Team Members */}
        <TeamMembers />

        {/* Danger Zone - Account Deletion (DOC-84) */}
        <DeleteAccountCard />
      </div>

      </AppLayout>
    </>
  );
};

export default Settings;