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
  MoreHorizontal
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const stats = [
  { label: "Total Clients", value: "24", change: "+3 this month", icon: Users, color: "text-primary" },
  { label: "Active Applications", value: "12", change: "8 in progress", icon: FileText, color: "text-accent" },
  { label: "Validation Rate", value: "94%", change: "+2% from last month", icon: TrendingUp, color: "text-success" },
  { label: "Avg. Processing Time", value: "18 days", change: "-3 days improvement", icon: Clock, color: "text-info" },
];

const recentMatters = [
  { id: 1, client: "John Smith", matter: "Skilled Worker Visa (482)", status: "active", progress: 75 },
  { id: 2, client: "Sarah Chen", matter: "Partner Visa (820)", status: "active", progress: 45 },
  { id: 3, client: "Ahmed Hassan", matter: "Student Visa (500)", status: "draft", progress: 20 },
  { id: 4, client: "Maria Garcia", matter: "Business Innovation (188)", status: "done", progress: 100 },
];

const MigrationDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");

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
          {stats.map((stat, index) => (
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
          
          <div className="divide-y divide-border/50">
            {recentMatters.map((matter) => (
              <div key={matter.id} className="p-6 flex items-center gap-6 hover:bg-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{matter.matter}</p>
                    <Badge 
                      variant={matter.status === "done" ? "success" : matter.status === "active" ? "default" : "secondary"}
                    >
                      {matter.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Client: {matter.client}</p>
                </div>
                
                <div className="hidden sm:block w-32">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{matter.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div 
                      className="h-full rounded-full gradient-bg transition-all duration-500"
                      style={{ width: `${matter.progress}%` }}
                    />
                  </div>
                </div>

                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-border/50">
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/app/migration/matters">
                View All Applications
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
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
                <p className="text-sm text-muted-foreground">3 clients need attention</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Review pending document validations and update application statuses.
            </p>
            <Button variant="outline" size="sm">
              Review Now
            </Button>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold">Pending Forms</h3>
                <p className="text-sm text-muted-foreground">5 forms awaiting response</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Online forms sent to clients that are still pending completion.
            </p>
            <Button variant="outline" size="sm">
              View Forms
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MigrationDashboard;
