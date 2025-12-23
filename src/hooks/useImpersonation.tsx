import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

interface ImpersonationTarget {
  id: string;
  email: string;
  display_name: string | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonationTarget | null;
  startImpersonation: (targetUserId: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
  isLoading: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const IMPERSONATION_STORAGE_KEY = "admin_original_session";
const IMPERSONATION_TARGET_KEY = "impersonation_target";

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonationTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if we're currently impersonating on load
    const storedTarget = localStorage.getItem(IMPERSONATION_TARGET_KEY);
    const storedSession = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    
    if (storedTarget && storedSession) {
      setIsImpersonating(true);
      setImpersonatedUser(JSON.parse(storedTarget));
    }
  }, []);

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

      // Store target user info
      localStorage.setItem(IMPERSONATION_TARGET_KEY, JSON.stringify(data.targetUser));
      setImpersonatedUser(data.targetUser);
      setIsImpersonating(true);

      // Sign in as the target user using the token
      // We'll use verifyOtp with the hashed token
      const { error: signInError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: "magiclink",
      });

      if (signInError) {
        // Restore admin session if impersonation fails
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        localStorage.removeItem(IMPERSONATION_TARGET_KEY);
        throw new Error("Failed to switch to user session");
      }

      toast.success(`Now impersonating ${data.targetUser.display_name || data.targetUser.email}`);
      
      // Reload to apply new session
      window.location.href = "/";
    } catch (error: any) {
      console.error("Impersonation error:", error);
      toast.error(error.message || "Failed to impersonate user");
      setIsImpersonating(false);
      setImpersonatedUser(null);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_TARGET_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const endImpersonation = async () => {
    setIsLoading(true);
    try {
      const storedSession = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      if (!storedSession) {
        throw new Error("No original session found");
      }

      const originalSession: Session = JSON.parse(storedSession);

      // Sign out of impersonated session
      await supabase.auth.signOut();

      // Restore original admin session
      const { error } = await supabase.auth.setSession({
        access_token: originalSession.access_token,
        refresh_token: originalSession.refresh_token,
      });

      if (error) {
        // If session restoration fails, user needs to log in again
        toast.error("Session expired. Please log in again.");
        window.location.href = "/auth";
        return;
      }

      // Clear impersonation data
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_TARGET_KEY);
      setIsImpersonating(false);
      setImpersonatedUser(null);

      toast.success("Returned to admin account");
      window.location.href = "/admin";
    } catch (error: any) {
      console.error("End impersonation error:", error);
      toast.error("Failed to end impersonation. Please log in again.");
      // Clear everything and redirect to login
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_TARGET_KEY);
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonatedUser,
        startImpersonation,
        endImpersonation,
        isLoading,
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
