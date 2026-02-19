import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

/**
 * Global hook that polls Drive connection status every 30s and triggers
 * folder backfill when a reconnection is detected.
 * Mount once in AppLayout so it runs regardless of which page the user is on.
 */
export function useDriveBackfill() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: driveStatus } = useQuery({
    queryKey: ["drive-connection-status", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.rpc("get_drive_connection_status", {
        p_company_id: companyId,
      });
      return data?.[0] ?? null;
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const isDriveConnected = !!driveStatus?.root_folder_id;

  // Track previous state to detect reconnection
  const prevDriveConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const wasDisconnected = prevDriveConnectedRef.current === false;
    prevDriveConnectedRef.current = isDriveConnected;

    if (!isDriveConnected || !wasDisconnected || !companyId) return;

    const createPendingFolders = async () => {
      // --- Client folder backfill ---
      const { data: allClients } = await supabase
        .rpc("get_clients_secure", { p_company_id: companyId });

      const clientsWithoutFolders = (allClients || []).filter(
        (c: any) => c.folder_status === null
      );
      if (clientsWithoutFolders.length === 0 && !allClients?.length) return;

      if (clientsWithoutFolders.length > 0) {
        // Check Drive binding
        const { data: clientBindings } = await supabase
          .from("clients")
          .select("id, google_drive_connection_id")
          .in("id", clientsWithoutFolders.map((c: any) => c.id));

        const bindingMap = new Map(
          (clientBindings || []).map((b) => [b.id, b.google_drive_connection_id])
        );

        const eligibleClients = clientsWithoutFolders.filter((c: any) => {
          const binding = bindingMap.get(c.id);
          return !binding || binding === driveStatus?.id;
        });

        if (eligibleClients.length > 0) {
          toast.info(
            `Google Drive connected! Creating folders for ${eligibleClients.length} client(s)...`
          );

          for (const client of eligibleClients) {
            try {
              await supabase
                .from("clients")
                .update({ folder_status: "pending" })
                .eq("id", client.id);

              await supabase.functions.invoke("dispatch-webhook", {
                body: {
                  event_type: "client.created",
                  data: {
                    client_id: client.id,
                    company_id: companyId,
                    client_type: client.client_type,
                    first_name: client.first_name,
                    last_name: client.last_name,
                    company_name: client.company_name,
                    root_folder_id: driveStatus?.root_folder_id,
                  },
                },
              });
            } catch (err) {
              console.warn(`Failed to create folder for client ${client.id}:`, err);
            }
          }

          queryClient.invalidateQueries({ queryKey: ["clients", companyId] });
        }
      }

      // --- Application folder backfill ---
      const { data: appsWithoutFolders } = await supabase
        .from("visa_applications")
        .select("id, client_id, application_name, visa_subclass, google_drive_connection_id")
        .eq("company_id", companyId)
        .is("visa_application_folder_id", null);

      if (appsWithoutFolders && appsWithoutFolders.length > 0) {
        const clientIds = [...new Set(appsWithoutFolders.map((a) => a.client_id))];
        const { data: clientsWithFolders } = await supabase
          .from("clients")
          .select("id, client_folder_id, google_drive_connection_id")
          .in("id", clientIds)
          .not("client_folder_id", "is", null);

        const clientFolderMap = new Map(
          (clientsWithFolders || []).map((c) => [
            c.id,
            {
              client_folder_id: c.client_folder_id,
              google_drive_connection_id: c.google_drive_connection_id,
            },
          ])
        );

        const eligibleApps = appsWithoutFolders.filter((app) => {
          const parentClient = clientFolderMap.get(app.client_id);
          if (!parentClient || !parentClient.client_folder_id) return false;
          const appBinding = app.google_drive_connection_id;
          return !appBinding || appBinding === driveStatus?.id;
        });

        if (eligibleApps.length > 0) {
          toast.info(`Creating folders for ${eligibleApps.length} application(s)...`);

          for (const app of eligibleApps) {
            const parentClient = clientFolderMap.get(app.client_id)!;
            try {
              await supabase
                .from("visa_applications")
                .update({ folder_status: "pending" })
                .eq("id", app.id);

              await supabase.functions.invoke("dispatch-webhook", {
                body: {
                  event_type: "application.created" as const,
                  data: {
                    application_id: app.id,
                    application_name: app.application_name,
                    subclass: app.visa_subclass,
                    company_id: companyId,
                    client_id: app.client_id,
                    client_folder_id: parentClient.client_folder_id,
                    root_folder_id: driveStatus?.root_folder_id,
                  },
                },
              });
            } catch (err) {
              console.warn(`Failed to create folder for application ${app.id}:`, err);
            }
          }
        }
      }
    };

    createPendingFolders();
  }, [isDriveConnected]);

  return { driveStatus, isDriveConnected };
}
