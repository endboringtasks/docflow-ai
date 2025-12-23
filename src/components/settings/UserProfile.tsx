import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const displayNameSchema = z.string().trim().max(100, "Display name must be less than 100 characters");

export function UserProfile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        setDisplayName(data?.display_name || "");
        setOriginalDisplayName(data?.display_name || "");
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    setError("");
    
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    if (!user) return;

    setIsUpdating(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);

    if (updateError) {
      toast.error("Failed to update display name", {
        description: updateError.message,
      });
    } else {
      toast.success("Display name updated");
      setSaved(true);
      setOriginalDisplayName(displayName.trim());
      setTimeout(() => setSaved(false), 2000);
    }

    setIsUpdating(false);
  };

  const hasChanges = displayName.trim() !== originalDisplayName;

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
          <User className="w-5 h-5 text-primary" />
          Your Profile
        </CardTitle>
        <CardDescription>
          Customize how your name appears to others
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Display Name</label>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSaved(false);
                  setError("");
                }}
                placeholder="Enter your display name"
                className={error ? "border-destructive" : ""}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={isUpdating || !hasChanges}
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
          </div>
          <p className="text-xs text-muted-foreground">
            This name will be shown to your team members instead of your email
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
