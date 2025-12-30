import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FolderStatusItem {
  id: string;
  folder_status: string;
}

/**
 * Smart real-time subscription hook that only activates when there are 
 * pending/creating folder statuses, and automatically disconnects when done.
 * This saves database resources by not maintaining unnecessary connections.
 */
export function useFolderStatusRealtime<T extends FolderStatusItem>(
  tableName: "clients" | "visa_applications",
  companyId: string | undefined,
  items: T[],
  queryKey: string[]
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Check if any items have pending/creating status that needs monitoring
  const hasPendingFolders = useMemo(() => {
    return items.some(
      (item) => item.folder_status === "pending" || item.folder_status === "creating"
    );
  }, [items]);

  useEffect(() => {
    // Don't subscribe if no company or no pending folders
    if (!companyId || !hasPendingFolders) {
      // Clean up existing channel if we no longer need it
      if (channelRef.current) {
        console.log(`[${tableName}] No pending folders, disconnecting real-time`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Already subscribed
    if (channelRef.current) {
      return;
    }

    console.log(`[${tableName}] Pending folders detected, connecting real-time`);

    const channel = supabase
      .channel(`${tableName}-folder-status-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: tableName,
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log(`[${tableName}] Real-time update:`, payload.new);
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe((status) => {
        console.log(`[${tableName}] Real-time subscription status:`, status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log(`[${tableName}] Component unmounting, disconnecting real-time`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [companyId, hasPendingFolders, tableName, queryKey, queryClient]);

  return { isSubscribed: hasPendingFolders && !!channelRef.current };
}
