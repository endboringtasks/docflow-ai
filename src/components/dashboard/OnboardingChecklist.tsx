import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  FolderSync, 
  Users, 
  FileText,
  X,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  action?: {
    label: string;
    href: string;
  };
}

const OnboardingChecklist = () => {
  const { currentCompany } = useCompany();
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem("onboarding-checklist-dismissed") === "true";
  });

  // Check Google Drive connection
  const { data: driveConnected } = useQuery({
    queryKey: ["drive-connection-status", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return false;
      const { data } = await supabase
        .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });
      return data && data.length > 0;
    },
    enabled: !!currentCompany?.id,
  });

  // Check if any clients exist
  const { data: hasClients } = useQuery({
    queryKey: ["has-clients", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return false;
      const { data } = await supabase
        .rpc("get_clients_secure", { p_company_id: currentCompany.id });
      return data && data.length > 0;
    },
    enabled: !!currentCompany?.id,
  });

  // Check if any applications exist
  const { data: hasApplications } = useQuery({
    queryKey: ["has-applications", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return false;
      const { data } = await supabase
        .from("visa_applications")
        .select("id")
        .eq("company_id", currentCompany.id)
        .limit(1);
      return data && data.length > 0;
    },
    enabled: !!currentCompany?.id,
  });

  const checklistItems: ChecklistItem[] = [
    {
      id: "company",
      title: "Create your company",
      description: "Set up your workspace",
      icon: Sparkles,
      completed: true, // Always true if they're on the dashboard
    },
    {
      id: "google-drive",
      title: "Connect Google Drive",
      description: "Auto-organize client documents",
      icon: FolderSync,
      completed: !!driveConnected,
      action: !driveConnected ? {
        label: "Connect",
        href: "/app/settings",
      } : undefined,
    },
    {
      id: "first-client",
      title: "Add your first client",
      description: "Start managing clients",
      icon: Users,
      completed: !!hasClients,
      action: !hasClients ? {
        label: "Add Client",
        href: "/app/migration/clients",
      } : undefined,
    },
    {
      id: "first-application",
      title: "Create an application",
      description: "Track visa applications",
      icon: FileText,
      completed: !!hasApplications,
      action: !hasApplications ? {
        label: "Create",
        href: "/app/migration/applications",
      } : undefined,
    },
  ];

  const completedCount = checklistItems.filter(item => item.completed).length;
  const progressPercentage = (completedCount / checklistItems.length) * 100;
  const allCompleted = completedCount === checklistItems.length;

  const handleDismiss = () => {
    localStorage.setItem("onboarding-checklist-dismissed", "true");
    setIsDismissed(true);
  };

  // Don't show if dismissed or all items completed
  if (isDismissed || allCompleted) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card-gradient rounded-xl border border-border/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold">Getting Started</h2>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{checklistItems.length} complete
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="divide-y divide-border/50">
        <AnimatePresence>
          {checklistItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 flex items-center gap-4 ${
                item.completed ? "bg-secondary/20" : "hover:bg-secondary/30"
              } transition-colors`}
            >
              <div className={`flex-shrink-0 ${item.completed ? "text-primary" : "text-muted-foreground"}`}>
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                item.completed ? "bg-primary/10" : "bg-secondary"
              }`}>
                <item.icon className={`w-4 h-4 ${item.completed ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>

              {item.action && !item.completed && (
                <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                  <Link to={item.action.href}>
                    {item.action.label}
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              )}

              {item.completed && (
                <span className="text-xs text-primary font-medium flex-shrink-0">Done</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default OnboardingChecklist;
