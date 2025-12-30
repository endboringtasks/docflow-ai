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
import { SEO } from "@/components/SEO";

interface DashboardStats {
  totalClients: number;
  newClientsThisMonth: number;
  activeApplications: number;
  draftApplications: number;
  completedApplications: number;
  totalApplications: number;
}

interface RecentVisaApplication {
  id: string;
  client_name: string;
  application_name: string;
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

      // Get clients count using secure RPC
      const { data: clientsData } = await supabase
        .rpc("get_clients_secure", { p_company_id: currentCompany.id });
      const totalClients = clientsData?.length ?? 0;

      // Get new clients this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const newClientsThisMonth = clientsData?.filter(
        (c: { created_at: string }) => new Date(c.created_at) >= startOfMonth
      ).length ?? 0;

      // Get visa applications by status
      const { data: applicationsData } = await supabase
        .from("visa_applications")
        .select("status")
        .eq("company_id", currentCompany.id);

      const applications = applicationsData || [];
      const activeApplications = applications.filter(m => m.status === "active").length;
      const draftApplications = applications.filter(m => m.status === "draft").length;
      const completedApplications = applications.filter(m => m.status === "done").length;

      return {
        totalClients: totalClients || 0,
        newClientsThisMonth: newClientsThisMonth || 0,
        activeApplications,
        draftApplications,
        completedApplications,
        totalApplications: applications.length,
      };
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch recent visa applications
  const { data: recentApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["recent-applications", currentCompany?.id],
    queryFn: async (): Promise<RecentVisaApplication[]> => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from("visa_applications")
        .select(`
          id,
          application_name,
          visa_subclass,
          status,
          created_at,
          clients (
            first_name,
            last_name,
            company_name,
            client_type
          )
        `)
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data || []).map(app => {
        const clientData = app.clients as any;
        let clientName = "Unknown";
        if (clientData) {
          if (clientData.client_type === "corporate") {
            clientName = clientData.company_name || "Unnamed Company";
          } else {
            clientName = clientData.last_name 
              ? `${clientData.first_name} ${clientData.last_name}` 
              : (clientData.first_name || "Unnamed Client");
          }
        }
        return {
          id: app.id,
          client_name: clientName,
          application_name: app.application_name,
          visa_subclass: app.visa_subclass,
          status: app.status as "draft" | "active" | "done",
          created_at: app.created_at,
        };
      });
    },
    enabled: !!currentCompany?.id,
  });

  const filteredApplications = recentApplications.filter(app =>
    app.application_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = statsLoading || applicationsLoading;

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
    <>
      <SEO 
        title="Migration Dashboard"
        description="Manage your migration practice with Docflow AI. Track visa applications, clients, and document workflows."
        noIndex
      />
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
              <Link to="/app/migration/visa-applications">
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
          ) : filteredApplications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filteredApplications.map((app) => (
                <div key={app.id} className="p-6 flex items-center gap-6 hover:bg-secondary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{app.application_name}</p>
                      <Badge 
                        variant={app.status === "done" ? "success" : app.status === "active" ? "default" : "secondary"}
                      >
                        {app.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Client: {app.client_name}
                      {app.visa_subclass && ` • Subclass ${app.visa_subclass}`}
                    </p>
                  </div>
                  
                  <div className="hidden sm:block text-sm text-muted-foreground">
                    {formatDate(app.created_at)}
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
                <Link to="/app/migration/visa-applications">
                  <Plus className="w-4 h-4 mr-2" />
                  New Application
                </Link>
              </Button>
            </div>
          )}
          
          {filteredApplications.length > 0 && (
            <div className="p-4 border-t border-border/50">
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/app/migration/visa-applications">
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
              <Link to="/app/migration/visa-applications">Review Now</Link>
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
    </>
  );
};

export default MigrationDashboard;
