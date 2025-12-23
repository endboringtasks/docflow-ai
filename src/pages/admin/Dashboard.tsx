import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Briefcase,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalClients: number;
  totalMatters: number;
  newCompaniesThisMonth: number;
  newUsersThisMonth: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-platform-stats"],
    queryFn: async (): Promise<PlatformStats> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { count: totalCompanies },
        { count: totalUsers },
        { count: totalClients },
        { count: totalMatters },
        { count: newCompaniesThisMonth },
        { count: newUsersThisMonth },
      ] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("matters").select("*", { count: "exact", head: true }),
        supabase.from("companies").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
      ]);

      return {
        totalCompanies: totalCompanies ?? 0,
        totalUsers: totalUsers ?? 0,
        totalClients: totalClients ?? 0,
        totalMatters: totalMatters ?? 0,
        newCompaniesThisMonth: newCompaniesThisMonth ?? 0,
        newUsersThisMonth: newUsersThisMonth ?? 0,
      };
    },
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ["admin-subscription-distribution"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("subscription_plan");
      
      const distribution: Record<string, number> = {};
      data?.forEach((company) => {
        const plan = company.subscription_plan || "free";
        distribution[plan] = (distribution[plan] || 0) + 1;
      });

      return Object.entries(distribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));
    },
  });

  const { data: growthData } = useQuery({
    queryKey: ["admin-growth-data"],
    queryFn: async () => {
      const days = 30;
      const results = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date).toISOString();
        const dayEnd = startOfDay(subDays(date, -1)).toISOString();

        const [{ count: companies }, { count: users }] = await Promise.all([
          supabase.from("companies").select("*", { count: "exact", head: true }).gte("created_at", dayStart).lt("created_at", dayEnd),
          supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", dayStart).lt("created_at", dayEnd),
        ]);

        results.push({
          date: format(date, "MMM d"),
          companies: companies ?? 0,
          users: users ?? 0,
        });
      }

      return results;
    },
  });

  const statCards = [
    {
      title: "Total Companies",
      value: stats?.totalCompanies ?? 0,
      change: stats?.newCompaniesThisMonth ?? 0,
      icon: Building2,
      trend: "up",
    },
    {
      title: "Total Users",
      value: stats?.totalUsers ?? 0,
      change: stats?.newUsersThisMonth ?? 0,
      icon: Users,
      trend: "up",
    },
    {
      title: "Total Clients",
      value: stats?.totalClients ?? 0,
      icon: Briefcase,
    },
    {
      title: "Total Matters",
      value: stats?.totalMatters ?? 0,
      icon: FileText,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Dashboard</h1>
          <p className="text-muted-foreground">Overview of your entire platform</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                    {stat.change !== undefined && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {stat.trend === "up" ? (
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        +{stat.change} this month
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Growth (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Line type="monotone" dataKey="companies" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionData || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {subscriptionData?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
