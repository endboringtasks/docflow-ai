import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  basic: 39,
  pro: 79,
  teams: 129,
  enterprise: 299,
};

export default function AdminBilling() {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-billing-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: planDistribution } = useQuery({
    queryKey: ["admin-plan-distribution"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("subscription_plan");

      const distribution: Record<string, number> = {
        free: 0,
        basic: 0,
        pro: 0,
        teams: 0,
        enterprise: 0,
      };

      data?.forEach((company) => {
        const plan = company.subscription_plan || "free";
        distribution[plan] = (distribution[plan] || 0) + 1;
      });

      return Object.entries(distribution).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        revenue: count * PLAN_PRICES[name],
      }));
    },
  });

  const totalMRR = planDistribution?.reduce((sum, plan) => sum + plan.revenue, 0) ?? 0;
  const paidCustomers = companies?.filter((c) => c.subscription_plan !== "free").length ?? 0;
  const activeSubscriptions = companies?.filter((c) => c.subscription_status === "active").length ?? 0;

  const stats = [
    {
      title: "Monthly Recurring Revenue",
      value: `$${totalMRR.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: "Paid Customers",
      value: paidCustomers,
      icon: CreditCard,
    },
    {
      title: "Active Subscriptions",
      value: activeSubscriptions,
      icon: TrendingUp,
    },
    {
      title: "Total Companies",
      value: companies?.length ?? 0,
      icon: Users,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Revenue</h1>
          <p className="text-muted-foreground">Monitor subscription revenue and billing</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue by Plan Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `$${value}` : value,
                      name === "revenue" ? "Revenue" : "Companies",
                    ]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Companies" />
                  <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies?.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {company.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={company.subscription_status === "active" ? "default" : "destructive"}
                          className="capitalize"
                        >
                          {company.subscription_status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>${PLAN_PRICES[company.subscription_plan] ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(company.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
