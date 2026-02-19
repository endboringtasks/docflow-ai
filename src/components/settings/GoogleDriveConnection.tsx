import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HardDrive, Link2, Unlink, Loader2, CheckCircle2, Mail, Folder, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useSearchParams } from "react-router-dom";

interface DriveConnection {
  id: string;
  connected_email: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  created_at: string;
}

export function GoogleDriveConnection() {
  const { currentCompany, currentRole, refetch } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [saveOriginalEnabled, setSaveOriginalEnabled] = useState(true);
  const [isUpdatingSaveOriginal, setIsUpdatingSaveOriginal] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnectCheckbox, setDisconnectCheckbox] = useState(false);
  const [disconnectConfirmText, setDisconnectConfirmText] = useState("");

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
      // Use secure RPC function that never exposes OAuth tokens
      const { data, error } = await supabase
        .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });

      if (error) throw error;
      // RPC returns an array, get first item
      setConnection(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error("Error fetching connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSaveOriginalSetting = async () => {
    if (!currentCompany) return;
    
    const { data, error } = await supabase
      .from("companies")
      .select("save_original_to_documents_received")
      .eq("id", currentCompany.id)
      .single();
    
    if (!error && data) {
      setSaveOriginalEnabled(data.save_original_to_documents_received ?? true);
    }
  };

  useEffect(() => {
    fetchConnection();
    fetchSaveOriginalSetting();
  }, [currentCompany]);

  const handleToggleSaveOriginal = async (enabled: boolean) => {
    if (!currentCompany) return;
    
    setIsUpdatingSaveOriginal(true);
    
    const { error } = await supabase
      .from("companies")
      .update({ save_original_to_documents_received: enabled })
      .eq("id", currentCompany.id);
    
    if (error) {
      toast.error("Failed to update setting", { description: error.message });
    } else {
      setSaveOriginalEnabled(enabled);
      toast.success(enabled ? "Original files will be saved to Documents Received" : "Original file saving disabled");
      refetch?.();
    }
    
    setIsUpdatingSaveOriginal(false);
  };

  const handleConnect = async () => {
    if (!currentCompany) return;

    setIsConnecting(true);

    try {
      // Force refresh session to ensure we have a valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        toast.error("Your session has expired. Please log in again.");
        setIsConnecting(false);
        return;
      }

      const accessToken = refreshData.session.access_token;

      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { companyId: currentCompany.id, origin: window.location.origin },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;

      if (!data?.authUrl) {
        throw new Error("No authorization URL received");
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error: unknown) {
      console.error("Error starting OAuth:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to start Google authorization", {
        description: message,
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentCompany) return;

    setIsDisconnecting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { error } = await supabase.functions.invoke("google-drive-disconnect", {
        body: { companyId: currentCompany.id },
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      });

      if (error) throw error;

      toast.success("Google Drive integration has been disconnected.");
      // Refetch to show disconnected state (connection row is preserved with connected_email)
      await fetchConnection();
      setDisconnectDialogOpen(false);
      setDisconnectCheckbox(false);
      setDisconnectConfirmText("");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect Google Drive");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    if (!currentCompany) return;

    setIsReconnecting(true);

    try {
      // Force refresh session to ensure we have a valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        toast.error("Your session has expired. Please log in again.");
        setIsReconnecting(false);
        return;
      }

      const accessToken = refreshData.session.access_token;

      // First disconnect
      await supabase.functions.invoke("google-drive-disconnect", {
        body: { companyId: currentCompany.id },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Then start new OAuth flow
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { companyId: currentCompany.id, origin: window.location.origin },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;

      if (!data?.authUrl) {
        throw new Error("No authorization URL received");
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error: unknown) {
      console.error("Error reconnecting:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to reconnect Google Drive", {
        description: message,
      });
      setIsReconnecting(false);
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
          <HardDrive className="w-5 h-5 text-primary" />
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Connect your Google Drive to store and organize client documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connection && connection.root_folder_id ? (
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
                  {connection.root_folder_id && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      ID: {connection.root_folder_id}
                    </p>
                  )}
                </div>
              </div>
              
              {canManage && (
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={isReconnecting || isDisconnecting}
                            >
                              {isReconnecting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4" />
                                  Reconnect
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reconnect Google Drive?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will re-authenticate your Google Drive connection and automatically 
                              share your Clients folder with the automation service. Use this if folder 
                              creation isn't working or if you need to refresh permissions.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleReconnect}>
                              Reconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <TooltipContent>
                        <p>Re-authenticate and share folder with automation service</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isDisconnecting || isReconnecting}
                    onClick={() => setDisconnectDialogOpen(true)}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="w-4 h-4" />
                        Disconnect
                      </>
                    )}
                  </Button>

                  <Dialog 
                    open={disconnectDialogOpen} 
                    onOpenChange={(open) => {
                      setDisconnectDialogOpen(open);
                      if (!open) {
                        setDisconnectCheckbox(false);
                        setDisconnectConfirmText("");
                      }
                    }}
                  >
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                          </div>
                          <DialogTitle className="text-lg font-semibold">
                            Disconnect Google Drive Integration
                          </DialogTitle>
                        </div>
                      </DialogHeader>

                      <div className="space-y-4 text-sm text-muted-foreground">
                        <p>
                          You are about to disconnect your organization's Google Drive integration. 
                          Existing folder links will be preserved but may not be accessible until you reconnect.
                        </p>

                        <div>
                          <p className="font-medium text-foreground mb-2">What will happen:</p>
                          <ul className="list-disc list-inside space-y-1.5">
                            <li>OAuth access will be revoked from your Google account</li>
                            <li>New folder creation will be disabled</li>
                            <li>Existing folder links will show a warning but remain clickable</li>
                            <li>Client file uploads via portal will be interrupted</li>
                          </ul>
                        </div>

                        <p>
                          You can reconnect at any time. If you reconnect with the same Google account, 
                          existing folders will continue to work.
                        </p>

                        <div className="border-t pt-4 space-y-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="disconnect-confirm-check"
                              checked={disconnectCheckbox}
                              onCheckedChange={(checked) => setDisconnectCheckbox(checked === true)}
                            />
                            <label htmlFor="disconnect-confirm-check" className="text-sm leading-snug cursor-pointer">
                              I understand that disconnecting Google Drive will revoke access and disable folder creation.
                            </label>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="disconnect-confirm-text" className="text-sm font-medium text-foreground">
                              Type <span className="font-mono font-bold text-destructive">DISCONNECT</span> to confirm.
                            </label>
                            <Input
                              id="disconnect-confirm-text"
                              value={disconnectConfirmText}
                              onChange={(e) => setDisconnectConfirmText(e.target.value)}
                              placeholder="Type DISCONNECT to confirm"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      </div>

                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                          variant="outline"
                          onClick={() => setDisconnectDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={!disconnectCheckbox || disconnectConfirmText !== "DISCONNECT" || isDisconnecting}
                          onClick={handleDisconnect}
                        >
                          {isDisconnecting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            "Disconnect Integration"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              New client folders will be created in: <span className="font-medium">{connection.root_folder_name || "My Drive"}</span>
            </p>

            {/* Save Original Files Toggle */}
            {canManage && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="save-original" className="text-sm font-medium">
                    Save original files to Documents Received
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, original files uploaded via client portal will also be saved to the Documents Received folder
                  </p>
                </div>
                <Switch
                  id="save-original"
                  checked={saveOriginalEnabled}
                  onCheckedChange={handleToggleSaveOriginal}
                  disabled={isUpdatingSaveOriginal}
                />
              </div>
            )}

          </div>
        ) : connection && connection.connected_email ? (
          /* Disconnected state - show email and reconnect option */
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Disconnected</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    Previously connected: {connection.connected_email}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Existing folder links are preserved but may not be accessible.
                  </p>
                </div>
              </div>
              
              {canManage && (
                <Button 
                  onClick={handleReconnect} 
                  disabled={isReconnecting}
                  size="sm"
                >
                  {isReconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reconnect
                    </>
                  )}
                </Button>
              )}
            </div>
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
                <li>Visa application-specific subfolders for document organization</li>
                <li>Secure document storage in your own Google Drive</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}