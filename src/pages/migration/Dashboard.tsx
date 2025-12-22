import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Clock, 
  Plus, 
  Search,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface DashboardStats {
  totalClients: number;
  newClientsThisMonth: number;
  activeApplications: number;
  draftApplications: number;
  completedApplications: number;
  totalApplications: number;
}

interface RecentMatter {
  id: string;
  client_name: string;
  matter_name: string;
  visa_subclass: string | null;
  status: "draft" | "active" | "done";
  created_at: string;
}

const MigrationDashboard = () => {
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", currentCompany?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentCompany?.id) {
        return {
          totalClients: 0,
          newClientsThisMonth: 0,
          activeApplications: 0,
          draftApplications: 0,
          completedApplications: 0,
          totalApplications: 0,
        };
      }

      // Get clients count
      const { count: totalClients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany.id);

      // Get new clients this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: newClientsThisMonth } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany.id)
        .gte("created_at", startOfMonth.toISOString());

      // Get matters by status
      const { data: mattersData } = await supabase
        .from("matters")
        .select("status")
        .eq("company_id", currentCompany.id);

      const matters = mattersData || [];
      const activeApplications = matters.filter(m => m.status === "active").length;
      const draftApplications = matters.filter(m => m.status === "draft").length;
      const completedApplications = matters.filter(m => m.status === "done").length;

      return {
        totalClients: totalClients || 0,
        newClientsThisMonth: newClientsThisMonth || 0,
        activeApplications,
        draftApplications,
        completedApplications,
        totalApplications: matters.length,
      };
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch recent matters
  const { data: recentMatters = [], isLoading: mattersLoading } = useQuery({
    queryKey: ["recent-matters", currentCompany?.id],
    queryFn: async (): Promise<RecentMatter[]> => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from("matters")
        .select(`
          id,
          matter_name,
          visa_subclass,
          status,
          created_at,
          clients (
            full_name
          )
        `)
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data || []).map(matter => ({
        id: matter.id,
        client_name: (matter.clients as any)?.full_name || "Unknown",
        matter_name: matter.matter_name,
        visa_subclass: matter.visa_subclass,
        status: matter.status as "draft" | "active" | "done",
        created_at: matter.created_at,
      }));
    },
    enabled: !!currentCompany?.id,
  });

  const filteredMatters = recentMatters.filter(matter =>
    matter.matter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    matter.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = statsLoading || mattersLoading;

  const dashboardStats = [
    { 
      label: "Total Clients", 
      value: stats?.totalClients.toString() || "0", 
      change: `+${stats?.newClientsThisMonth || 0} this month`, 
      icon: Users, 
      color: "text-primary" 
    },
    { 
      label: "Active Applications", 
      value: stats?.activeApplications.toString() || "0", 
      change: `${stats?.draftApplications || 0} in draft`, 
      icon: FileText, 
      color: "text-accent" 
    },
    { 
      label: "Completed", 
      value: stats?.completedApplications.toString() || "0", 
      change: `of ${stats?.totalApplications || 0} total`, 
      icon: TrendingUp, 
      color: "text-success" 
    },
    { 
      label: "Total Applications", 
      value: stats?.totalApplications.toString() || "0", 
      change: "All time", 
      icon: Clock, 
      color: "text-info" 
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AppLayout niche="migration">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's an overview of your migration practice.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/app/migration/clients">
                <Users className="w-4 h-4 mr-2" />
                View Clients
              </Link>
            </Button>
            <Button variant="gradient" asChild>
              <Link to="/app/migration/matters">
                <Plus className="w-4 h-4 mr-2" />
                New Application
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="card-gradient rounded-xl p-6 border border-border/50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-3xl font-bold mb-1">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground mt-2">{stat.change}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Matters */}
        <div className="card-gradient rounded-xl border border-border/50">
          <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Recent Visa Applications</h2>
              <p className="text-sm text-muted-foreground">Track progress on active applications</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 bg-secondary border-border"
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredMatters.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filteredMatters.map((matter) => (
                <div key={matter.id} className="p-6 flex items-center gap-6 hover:bg-secondary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{matter.matter_name}</p>
                      <Badge 
                        variant={matter.status === "done" ? "success" : matter.status === "active" ? "default" : "secondary"}
                      >
                        {matter.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Client: {matter.client_name}
                      {matter.visa_subclass && ` • Subclass ${matter.visa_subclass}`}
                    </p>
                  </div>
                  
                  <div className="hidden sm:block text-sm text-muted-foreground">
                    {formatDate(matter.created_at)}
                  </div>

                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No applications yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first visa application to get started
              </p>
              <Button variant="gradient" asChild>
                <Link to="/app/migration/matters">
                  <Plus className="w-4 h-4 mr-2" />
                  New Application
                </Link>
              </Button>
            </div>
          )}
          
          {filteredMatters.length > 0 && (
            <div className="p-4 border-t border-border/50">
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/app/migration/matters">
                  View All Applications
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Document Validation</h3>
                <p className="text-sm text-muted-foreground">
                  {stats?.draftApplications || 0} applications in draft
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Review pending document validations and update application statuses.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/migration/matters">Review Now</Link>
            </Button>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold">Pending Forms</h3>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Online forms sent to clients that are still pending completion.
            </p>
            <Button variant="outline" size="sm" disabled>
              View Forms
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MigrationDashboard;
