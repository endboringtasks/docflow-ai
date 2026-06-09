import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

interface ImpersonationTarget {
  id: string;
  email: string;
  display_name: string | null;
}

interface ImpersonationAdmin {
  id: string;
  email: string | null;
  display_name: string | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonationTarget | null;
  initiatingAdmin: ImpersonationAdmin | null;
  startImpersonation: (targetUserId: string) => Promise<void>;
  endImpersonation: (showToast?: boolean) => Promise<void>;
  extendSession: () => void;
  isLoading: boolean;
  timeRemaining: number | null;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const IMPERSONATION_STORAGE_KEY = "admin_original_session";
const IMPERSONATION_TARGET_KEY = "impersonation_target";
const IMPERSONATION_ADMIN_KEY = "impersonation_admin";
const IMPERSONATION_START_KEY = "impersonation_start_time";
const IMPERSONATION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonationTarget | null>(null);
  const [initiatingAdmin, setInitiatingAdmin] = useState<ImpersonationAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const endImpersonation = useCallback(async (showToast = true) => {
    setIsLoading(true);
    try {
      const storedSession = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      if (!storedSession) {
        throw new Error("No original session found");
      }

      const originalSession: Session = JSON.parse(storedSession);

      // BR-11: write an audit log for the impersonation end, attributed to the
      // original admin. Best-effort — never block the session restore on failure.
      try {
        const storedTarget = localStorage.getItem(IMPERSONATION_TARGET_KEY);
        const target: ImpersonationTarget | null = storedTarget ? JSON.parse(storedTarget) : null;
        await supabase.functions.invoke("admin-end-impersonation", {
          body: {
            targetUserId: target?.id ?? null,
            adminAccessToken: originalSession.access_token,
          },
        });
      } catch (auditError) {
        console.error("Failed to log impersonation end:", auditError);
      }

      // Sign out of impersonated session
      await supabase.auth.signOut();

      // Restore original admin session
      const { error } = await supabase.auth.setSession({
        access_token: originalSession.access_token,
        refresh_token: originalSession.refresh_token,
      });

      if (error) {
        if (showToast) toast.error("Session expired. Please log in again.");
        window.location.href = "/auth";
        return;
      }

      // Clear impersonation data
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_TARGET_KEY);
      localStorage.removeItem(IMPERSONATION_ADMIN_KEY);
      localStorage.removeItem(IMPERSONATION_START_KEY);
      setIsImpersonating(false);
      setImpersonatedUser(null);
      setInitiatingAdmin(null);
      setTimeRemaining(null);

      if (showToast) toast.success("Impersonation ended");
      window.location.href = "/admin";
    } catch (error: any) {
      console.error("End impersonation error:", error);
      if (showToast) toast.error("Failed to end impersonation. Please log in again.");
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_TARGET_KEY);
      localStorage.removeItem(IMPERSONATION_ADMIN_KEY);
      localStorage.removeItem(IMPERSONATION_START_KEY);
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for timeout on load and set up timer
  useEffect(() => {
    const storedTarget = localStorage.getItem(IMPERSONATION_TARGET_KEY);
    const storedSession = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    const storedStartTime = localStorage.getItem(IMPERSONATION_START_KEY);
    
    if (storedTarget && storedSession && storedStartTime) {
      const startTime = parseInt(storedStartTime, 10);
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= IMPERSONATION_TIMEOUT_MS) {
        // Session expired, end impersonation
        toast.warning("Impersonation session expired");
        endImpersonation(false);
        return;
      }

      setIsImpersonating(true);
      setImpersonatedUser(JSON.parse(storedTarget));
      const storedAdmin = localStorage.getItem(IMPERSONATION_ADMIN_KEY);
      if (storedAdmin) setInitiatingAdmin(JSON.parse(storedAdmin));
      setTimeRemaining(Math.floor((IMPERSONATION_TIMEOUT_MS - elapsed) / 1000));
    }
  }, [endImpersonation]);

  // Update time remaining every second
  useEffect(() => {
    if (!isImpersonating) return;

    const interval = setInterval(() => {
      const storedStartTime = localStorage.getItem(IMPERSONATION_START_KEY);
      if (!storedStartTime) return;

      const startTime = parseInt(storedStartTime, 10);
      const elapsed = Date.now() - startTime;
      const remaining = Math.floor((IMPERSONATION_TIMEOUT_MS - elapsed) / 1000);

      if (remaining <= 0) {
        toast.warning("Impersonation session expired");
        endImpersonation(false);
      } else {
        setTimeRemaining(remaining);
        
        // Warn at 5 minutes remaining
        if (remaining === 300) {
          toast.warning("Impersonation session expires in 5 minutes");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isImpersonating, endImpersonation]);

  const startImpersonation = async (targetUserId: string) => {
    setIsLoading(true);
    try {
      // Store the current admin session first
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error("No current session");
      }

      // Store admin session for later restoration
      localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(currentSession));

      // Call the edge function to get impersonation token
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: { targetUserId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Impersonation failed");
      }

      // Store target user info, admin info, and start time
      localStorage.setItem(IMPERSONATION_TARGET_KEY, JSON.stringify(data.targetUser));
      localStorage.setItem(IMPERSONATION_START_KEY, Date.now().toString());
      if (data.admin) {
        localStorage.setItem(IMPERSONATION_ADMIN_KEY, JSON.stringify(data.admin));
        setInitiatingAdmin(data.admin);
      }
      setImpersonatedUser(data.targetUser);
      setIsImpersonating(true);
      setTimeRemaining(IMPERSONATION_TIMEOUT_MS / 1000);

      // Sign in as the target user using the token
      const { error: signInError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: "magiclink",
      });

      if (signInError) {
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        localStorage.removeItem(IMPERSONATION_TARGET_KEY);
        localStorage.removeItem(IMPERSONATION_START_KEY);
        throw new Error("Failed to switch to user session");
      }

      toast.success(`Now impersonating ${data.targetUser.display_name || data.targetUser.email}`);
      
      window.location.href = "/";
    } catch (error: any) {
      console.error("Impersonation error:", error);
      toast.error(error.message || "Failed to impersonate user");
      setIsImpersonating(false);
      setImpersonatedUser(null);
      setTimeRemaining(null);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_TARGET_KEY);
      localStorage.removeItem(IMPERSONATION_START_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const extendSession = useCallback(() => {
    if (!isImpersonating) return;
    
    // Reset the start time to now
    localStorage.setItem(IMPERSONATION_START_KEY, Date.now().toString());
    setTimeRemaining(IMPERSONATION_TIMEOUT_MS / 1000);
    toast.success("Session extended by 1 hour");
  }, [isImpersonating]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonatedUser,
        startImpersonation,
        endImpersonation,
        extendSession,
        isLoading,
        timeRemaining,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
}
