import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface NotificationMetadata {
  matter_id?: string; // Legacy - kept for backwards compatibility
  visa_application_id?: string;
  client_id?: string;
  portal_access_id?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: NotificationMetadata;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_LIMIT = 20;

/**
 * Centralized notifications data layer (DOC-71).
 *
 * - Fetches persisted notifications (BR-12, AC-4) ordered newest-first (BR-8).
 * - Subscribes to Supabase Realtime for the current user only (BR-5/BR-6/BR-7),
 *   deduplicating by id (BR-9) and reconciling missed events on reconnect (BR-13).
 * - Falls back to periodic refetch when realtime is degraded (UI-6).
 */
export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const wasSubscribedRef = useRef(false);

  const queryKey = ["notifications", user?.id];

  const { data: notifications = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATION_LIMIT);

      if (error) throw error;
      return data as AppNotification[];
    },
    enabled: !!user?.id,
    // Safety-net refetch only when realtime is NOT connected (BR-12, UI-6).
    refetchInterval: realtimeConnected ? false : 60000,
  });

  // Realtime subscription scoped to the current user (BR-5, BR-6, BR-7).
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = payload.new as AppNotification;

          queryClient.setQueryData<AppNotification[]>(queryKey, (prev = []) => {
            // Deduplicate by id (BR-9, TC-4).
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, NOTIFICATION_LIMIT);
          });

          // Live toast for the incoming notification (PF-1 step 5, UI-3).
          toast({
            title: incoming.title,
            description: incoming.message,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          queryClient.setQueryData<AppNotification[]>(queryKey, (prev = []) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // On (re)connect, reconcile any notifications missed while
          // disconnected (BR-13, PF-3, TC-3).
          if (wasSubscribedRef.current) {
            queryClient.invalidateQueries({ queryKey });
          }
          wasSubscribedRef.current = true;
          setRealtimeConnected(true);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    realtimeConnected,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}
