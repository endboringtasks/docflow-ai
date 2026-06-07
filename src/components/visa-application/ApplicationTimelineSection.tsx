import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, UserPlus, UserMinus, ShieldAlert, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TimelineEvent {
  id: string;
  event_type: string;
  description: string | null;
  actor_id: string | null;
  created_at: string;
  actorName?: string | null;
}

interface ApplicationTimelineSectionProps {
  visaApplicationId: string;
}

const eventMeta = (eventType: string) => {
  switch (eventType) {
    case "applicant_added":
      return { icon: UserPlus, className: "text-emerald-600" };
    case "applicant_removed":
      return { icon: UserMinus, className: "text-destructive" };
    case "applicant_remove_blocked":
      return { icon: ShieldAlert, className: "text-amber-600" };
    default:
      return { icon: Clock, className: "text-muted-foreground" };
  }
};

export const ApplicationTimelineSection = ({
  visaApplicationId,
}: ApplicationTimelineSectionProps) => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["application-timeline", visaApplicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_timeline")
        .select("id, event_type, description, actor_id, created_at")
        .eq("visa_application_id", visaApplicationId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const actorIds = [...new Set((data || []).map((e) => e.actor_id).filter(Boolean))] as string[];
      const actorMap: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", actorIds);
        (profiles || []).forEach((p) => {
          actorMap[p.id] = p.display_name || p.email || "Unknown user";
        });
      }

      return (data || []).map((e) => ({
        ...e,
        actorName: e.actor_id ? actorMap[e.actor_id] || "Unknown user" : "System",
      })) as TimelineEvent[];
    },
    enabled: !!visaApplicationId,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Application Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No activity recorded yet.</p>
        ) : (
          events.map((event) => {
            const { icon: Icon, className } = eventMeta(event.event_type);
            return (
              <div key={event.id} className="flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} />
                <div className="min-w-0">
                  <p className="text-sm">{event.description || event.event_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.actorName} · {format(new Date(event.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default ApplicationTimelineSection;
