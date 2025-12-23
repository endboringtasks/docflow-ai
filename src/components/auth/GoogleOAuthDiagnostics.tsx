import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiagnosticStep {
  name: string;
  status: "pending" | "running" | "success" | "error" | "warning";
  message?: string;
  details?: string;
}

export function GoogleOAuthDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[]>([]);

  const supabaseUrl = "https://wevdjmdlsrljanttykzu.supabase.co";
  const appUrl = window.location.origin;
  const expectedCallbackUrl = `${supabaseUrl}/auth/v1/callback`;

  const updateStep = (index: number, updates: Partial<DiagnosticStep>) => {
    setSteps(prev => prev.map((step, i) => i === index ? { ...step, ...updates } : step));
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    const initialSteps: DiagnosticStep[] = [
      { name: "Check Supabase Connection", status: "pending" },
      { name: "Check Auth Session State", status: "pending" },
      { name: "Test OAuth URL Generation", status: "pending" },
      { name: "Verify Redirect Configuration", status: "pending" },
    ];
    setSteps(initialSteps);

    // Step 1: Check Supabase connection
    updateStep(0, { status: "running" });
    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      updateStep(0, { status: "success", message: "Supabase connection OK" });
    } catch (e) {
      updateStep(0, { 
        status: "error", 
        message: "Failed to connect to Supabase",
        details: e instanceof Error ? e.message : String(e)
      });
      setIsRunning(false);
      return;
    }

    // Step 2: Check auth session state
    updateStep(1, { status: "running" });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        updateStep(1, { 
          status: "warning", 
          message: "Already logged in",
          details: `Logged in as ${session.user.email}. Sign out first to test OAuth flow.`
        });
      } else {
        updateStep(1, { status: "success", message: "No active session - ready for OAuth" });
      }
    } catch (e) {
      updateStep(1, { 
        status: "error", 
        message: "Failed to check session",
        details: e instanceof Error ? e.message : String(e)
      });
    }

    // Step 3: Test OAuth URL generation
    updateStep(2, { status: "running" });
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${appUrl}/auth`,
          skipBrowserRedirect: true, // Don't actually redirect, just generate URL
        },
      });
      
      if (error) throw error;
      
      if (data?.url) {
        const url = new URL(data.url);
        const redirectUri = url.searchParams.get("redirect_uri");
        
        updateStep(2, { 
          status: "success", 
          message: "OAuth URL generated successfully",
          details: `Redirect URI: ${redirectUri}`
        });
      } else {
        updateStep(2, { 
          status: "error", 
          message: "No OAuth URL returned",
          details: "Google provider may not be enabled in Supabase"
        });
      }
    } catch (e) {
      updateStep(2, { 
        status: "error", 
        message: "Failed to generate OAuth URL",
        details: e instanceof Error ? e.message : String(e)
      });
    }

    // Step 4: Verify redirect configuration
    updateStep(3, { status: "running" });
    updateStep(3, { 
      status: "warning", 
      message: "Manual verification required",
      details: `Ensure these URLs are configured in Google Cloud Console`
    });

    setIsRunning(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusIcon = (status: DiagnosticStep["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google OAuth Diagnostics
        </CardTitle>
        <CardDescription>
          Debug your Google sign-in configuration step by step
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Required URLs */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Required Google Cloud Console Configuration</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div>
                <span className="font-medium">Authorized JavaScript Origins:</span>
                <code className="ml-2 text-xs bg-background px-1.5 py-0.5 rounded">{supabaseUrl}</code>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(supabaseUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div>
                <span className="font-medium">Authorized Redirect URI:</span>
                <code className="ml-2 text-xs bg-background px-1.5 py-0.5 rounded">{expectedCallbackUrl}</code>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(expectedCallbackUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Common 403 Causes:</p>
            <ul className="mt-1 space-y-1 text-muted-foreground list-disc list-inside">
              <li>App is in "Testing" mode - add your email as a Test User or publish to Production</li>
              <li>Redirect URI mismatch - must be <strong>exactly</strong> as shown above</li>
              <li>Missing authorized domain - add <code className="text-xs">supabase.co</code> to OAuth Consent Screen</li>
            </ul>
          </div>
        </div>

        {/* Diagnostic Steps */}
        {steps.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Diagnostic Results</h4>
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="flex items-start gap-3 p-3 border rounded-md"
              >
                {getStatusIcon(step.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{step.name}</span>
                    {step.status !== "pending" && step.status !== "running" && (
                      <Badge 
                        variant={step.status === "success" ? "default" : step.status === "error" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {step.status}
                      </Badge>
                    )}
                  </div>
                  {step.message && (
                    <p className="text-sm text-muted-foreground mt-0.5">{step.message}</p>
                  )}
                  {step.details && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              "Run Diagnostics"
            )}
          </Button>
          
          <Button variant="outline" asChild>
            <a 
              href="https://console.cloud.google.com/apis/credentials" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Open Google Console
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
