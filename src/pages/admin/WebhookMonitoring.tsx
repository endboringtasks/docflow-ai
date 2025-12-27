import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow, subHours } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface WebhookLog {
  id: string;
  request_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  client_ip: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  error_message: string | null;
  rate_limited: boolean;
  created_at: string;
}

interface HourlyStat {
  hour: string;
  endpoint: string;
  total_requests: number;
  success_count: number;
  client_error_count: number;
  server_error_count: number;
  rate_limited_count: number;
  avg_duration_ms: number;
  max_duration_ms: number;
}

interface RateLimitEntry {
  id: string;
  identifier: string;
  endpoint: string;
  request_count: number;
  window_start: string;
}

export default function WebhookMonitoring() {
  const [searchTerm, setSearchTerm] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch recent webhook logs
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["webhook-logs", endpointFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("webhook_request_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (endpointFilter !== "all") {
        query = query.eq("endpoint", endpointFilter);
      }

      if (statusFilter === "success") {
        query = query.gte("status_code", 200).lt("status_code", 300);
      } else if (statusFilter === "error") {
        query = query.gte("status_code", 400);
      } else if (statusFilter === "rate_limited") {
        query = query.eq("rate_limited", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookLog[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch hourly stats using RPC function
  const { data: hourlyStats, isLoading: statsLoading } = useQuery({
    queryKey: ["webhook-hourly-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_webhook_hourly_stats");

      if (error) throw error;
      return (data as HourlyStat[])?.slice(0, 168) || []; // Last 7 days
    },
    refetchInterval: 60000,
  });

  // Fetch current rate limits
  const { data: rateLimits, isLoading: rateLimitsLoading } = useQuery({
    queryKey: ["current-rate-limits"],
    queryFn: async () => {
      const cutoff = subHours(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from("webhook_rate_limits")
        .select("*")
        .gte("window_start", cutoff)
        .order("request_count", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as RateLimitEntry[];
    },
    refetchInterval: 10000,
  });

  // Calculate summary stats
  const summaryStats = logs ? {
    total: logs.length,
    success: logs.filter(l => l.status_code >= 200 && l.status_code < 300).length,
    clientErrors: logs.filter(l => l.status_code >= 400 && l.status_code < 500).length,
    serverErrors: logs.filter(l => l.status_code >= 500).length,
    rateLimited: logs.filter(l => l.rate_limited).length,
    avgDuration: logs.filter(l => l.duration_ms).length > 0
      ? Math.round(logs.filter(l => l.duration_ms).reduce((sum, l) => sum + (l.duration_ms || 0), 0) / logs.filter(l => l.duration_ms).length)
      : 0,
  } : null;

  // Prepare chart data
  const chartData = hourlyStats
    ? [...hourlyStats]
        .reverse()
        .slice(-24)
        .map(stat => ({
          hour: format(new Date(stat.hour), "HH:mm"),
          success: stat.success_count,
          errors: stat.client_error_count + stat.server_error_count,
          rateLimited: stat.rate_limited_count,
          avgDuration: stat.avg_duration_ms,
        }))
    : [];

  // Filter logs by search term
  const filteredLogs = logs?.filter(log =>
    searchTerm === "" ||
    log.request_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.client_ip?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (statusCode: number, rateLimited: boolean) => {
    if (rateLimited) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">429 Rate Limited</Badge>;
    }
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">{statusCode}</Badge>;
    }
    if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">{statusCode}</Badge>;
    }
    return <Badge variant="destructive">{statusCode}</Badge>;
  };

  const endpoints = ["all", "webhook-matter-folder", "webhook-client-folder", "webhook-automation-event"];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhook Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time insights into webhook performance and health
            </p>
          </div>
          <Button variant="outline" onClick={() => refetchLogs()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{summaryStats?.total || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success</p>
                  <p className="text-2xl font-bold text-green-600">{summaryStats?.success || 0}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Client Errors</p>
                  <p className="text-2xl font-bold text-orange-600">{summaryStats?.clientErrors || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Server Errors</p>
                  <p className="text-2xl font-bold text-red-600">{summaryStats?.serverErrors || 0}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rate Limited</p>
                  <p className="text-2xl font-bold text-yellow-600">{summaryStats?.rateLimited || 0}</p>
                </div>
                <Zap className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">{summaryStats?.avgDuration || 0}ms</p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Volume (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="success" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Success" />
                    <Area type="monotone" dataKey="errors" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Errors" />
                    <Area type="monotone" dataKey="rateLimited" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} name="Rate Limited" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Response Time (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" />
                    <YAxis className="text-xs" unit="ms" />
                    <Tooltip formatter={(value) => [`${value}ms`, 'Avg Duration']} />
                    <Bar dataKey="avgDuration" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Avg Duration" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Rate Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Active Rate Limits
            </CardTitle>
            <CardDescription>IPs currently using rate limit quota</CardDescription>
          </CardHeader>
          <CardContent>
            {rateLimitsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !rateLimits?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active rate limits</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {rateLimits.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono truncate max-w-[120px]" title={entry.identifier}>
                        {entry.identifier}
                      </span>
                      <Badge variant={entry.request_count > 80 ? "destructive" : entry.request_count > 50 ? "secondary" : "outline"}>
                        {entry.request_count}/100
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.endpoint}</p>
                    <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          entry.request_count > 80 ? 'bg-red-500' : 
                          entry.request_count > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(entry.request_count, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Logs */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Request Logs</CardTitle>
                <CardDescription>Recent webhook requests with details</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by request ID, IP..."
                    className="pl-9 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={endpointFilter} onValueChange={setEndpointFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Endpoint" />
                  </SelectTrigger>
                  <SelectContent>
                    {endpoints.map((ep) => (
                      <SelectItem key={ep} value={ep}>
                        {ep === "all" ? "All Endpoints" : ep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Errors</SelectItem>
                    <SelectItem value="rate_limited">Rate Limited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !filteredLogs?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No webhook requests recorded yet</p>
                <p className="text-sm mt-1">Requests will appear here in real-time</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Client IP</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.request_id}</TableCell>
                        <TableCell className="text-sm">{log.endpoint}</TableCell>
                        <TableCell>{getStatusBadge(log.status_code, log.rate_limited)}</TableCell>
                        <TableCell className="text-sm">
                          {log.duration_ms ? `${log.duration_ms}ms` : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.client_ip || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" title={format(new Date(log.created_at), "PPpp")}>
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm text-destructive max-w-[200px] truncate" title={log.error_message || ""}>
                          {log.error_message || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}