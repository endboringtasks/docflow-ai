import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { HardDrive, Link2, Unlink, Loader2, CheckCircle2, Mail, Folder, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useSearchParams } from "react-router-dom";
import { DriveFolderPicker } from "./DriveFolderPicker";

interface DriveConnection {
  id: string;
  connected_email: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  created_at: string;
}

export function GoogleDriveConnection() {
  const { currentCompany, currentRole } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const canManage = currentRole === "owner" || currentRole === "admin";

  useEffect(() => {
    // Handle OAuth callback messages
    const driveConnected = searchParams.get("drive_connected");
    const driveError = searchParams.get("drive_error");

    if (driveConnected === "true") {
      toast.success("Google Drive connected successfully!");
      searchParams.delete("drive_connected");
      setSearchParams(searchParams, { replace: true });
      fetchConnection();
    }

    if (driveError) {
      toast.error("Failed to connect Google Drive", {
        description: driveError,
      });
      searchParams.delete("drive_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchConnection = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from("google_drive_connections")
        .select("id, connected_email, root_folder_id, root_folder_name, created_at")
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error("Error fetching connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, [currentCompany]);

  const handleConnect = async () => {
    if (!currentCompany) return;

    setIsConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { companyId: currentCompany.id, origin: window.location.origin },
      });

      if (error) throw error;

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Error starting OAuth:", error);
      toast.error("Failed to start Google authorization");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentCompany) return;

    setIsDisconnecting(true);

    try {
      const { error } = await supabase.functions.invoke("google-drive-disconnect", {
        body: { companyId: currentCompany.id },
      });

      if (error) throw error;

      toast.success("Google Drive disconnected");
      setConnection(null);
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect Google Drive");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleFolderSelect = (folderId: string | null, folderName: string | null) => {
    setConnection((prev) =>
      prev ? { ...prev, root_folder_id: folderId, root_folder_name: folderName } : null
    );
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
          <HardDrive className="w-5 h-5 text-primary" />
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Connect your Google Drive to store and organize client documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connection ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Connected</p>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    {connection.connected_email || "Unknown account"}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                    <Folder className="w-3 h-3" />
                    Root: {connection.root_folder_name || "My Drive"}
                  </div>
                </div>
              </div>
              
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFolderPicker(true)}
                  >
                    <Settings2 className="w-4 h-4" />
                    Change Folder
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isDisconnecting}>
                        {isDisconnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Unlink className="w-4 h-4" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the connection to Google Drive. Existing folder links in clients 
                          and matters will still point to the same folders, but the app won't be able to 
                          create new folders or access files until reconnected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnect}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              New client folders will be created in: <span className="font-medium">{connection.root_folder_name || "My Drive"}</span>
            </p>

            {currentCompany && (
              <DriveFolderPicker
                open={showFolderPicker}
                onOpenChange={setShowFolderPicker}
                companyId={currentCompany.id}
                currentFolderId={connection.root_folder_id}
                currentFolderName={connection.root_folder_name}
                onSelect={handleFolderSelect}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-lg border border-dashed border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Not Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect Google Drive to enable document management
                  </p>
                </div>
              </div>

              {canManage ? (
                <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Connect Google Drive
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Only owners and admins can connect Google Drive
                </p>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">What this enables:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Automatic folder creation for each client</li>
                <li>Matter-specific subfolders for document organization</li>
                <li>Secure document storage in your own Google Drive</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
