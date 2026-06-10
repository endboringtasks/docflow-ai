import { useState, Fragment } from "react";
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
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow, subHours, subDays } from "date-fns";
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
  attempt_number: number | null;
  will_retry: boolean | null;
  final_state: string | null;
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

const PAGE_SIZE = 50;

const TIME_RANGES: Record<string, { label: string; cutoff: () => string }> = {
  "1h": { label: "Last 1 hour", cutoff: () => subHours(new Date(), 1).toISOString() },
  "24h": { label: "Last 24 hours", cutoff: () => subHours(new Date(), 24).toISOString() },
  "7d": { label: "Last 7 days", cutoff: () => subDays(new Date(), 7).toISOString() },
  "30d": { label: "Last 30 days", cutoff: () => subDays(new Date(), 30).toISOString() },
};

export default function WebhookMonitoring() {
  const [searchTerm, setSearchTerm] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reset pagination whenever filters change
  const resetPage = () => setPage(1);

  // Fetch recent webhook logs
  const {
    data: logs,
    isLoading: logsLoading,
    isError: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["webhook-logs", endpointFilter, statusFilter, timeRange, page],
    queryFn: async () => {
      let query = supabase
        .from("webhook_request_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .gte("created_at", TIME_RANGES[timeRange].cutoff())
        .range(0, page * PAGE_SIZE - 1);

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

  const hasMore = (logs?.length ?? 0) >= page * PAGE_SIZE;

  // Fetch hourly stats using RPC function
  const {
    data: hourlyStats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
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

  // Distinct endpoints actually present in the logs (for the filter dropdown)
  const { data: endpointList } = useQuery({
    queryKey: ["webhook-endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_webhook_log_endpoints");

      if (error) throw error;
      return ((data as { endpoint: string }[]) ?? [])
        .map((d) => d.endpoint)
        .filter(Boolean);
    },
    refetchInterval: 60000,
  });

  // Calculate summary stats (within the selected time window)
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

  const isFailedLog = (log: WebhookLog) =>
    log.status_code >= 400 || !!log.error_message || log.final_state === "failed";

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

  const endpoints = ["all", ...(endpointList ?? [])];

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
          <div className="flex items-center gap-2">
            <Select
              value={timeRange}
              onValueChange={(v) => {
                setTimeRange(v);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIME_RANGES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetchLogs()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
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
        {statsError ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-3">
                <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
                <div>
                  <p className="font-medium">Couldn't load webhook stats</p>
                  <p className="text-sm text-muted-foreground">
                    There was a problem retrieving hourly aggregates.
                  </p>
                </div>
                <Button variant="outline" onClick={() => refetchStats()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
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
        )}

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
                <Select
                  value={endpointFilter}
                  onValueChange={(v) => {
                    setEndpointFilter(v);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Endpoint" />
                  </SelectTrigger>
                  <SelectContent>
                    {endpoints.map((ep) => (
                      <SelectItem key={ep} value={ep}>
                        <span className="block max-w-[280px] truncate" title={ep === "all" ? "All Endpoints" : ep}>
                          {ep === "all" ? "All Endpoints" : ep}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    resetPage();
                  }}
                >
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
            ) : logsError ? (
              <div className="text-center py-12 space-y-3">
                <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
                <div>
                  <p className="font-medium">Couldn't load request logs</p>
                  <p className="text-sm text-muted-foreground">There was a problem retrieving webhook logs.</p>
                </div>
                <Button variant="outline" onClick={() => refetchLogs()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : !filteredLogs?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No webhook requests recorded yet</p>
                <p className="text-sm mt-1">Requests will appear here in real-time</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attempt</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => {
                        const failed = isFailedLog(log);
                        const expanded = expandedId === log.id;
                        return (
                          <Fragment key={log.id}>
                            <TableRow
                              key={log.id}
                              className={failed ? "cursor-pointer" : ""}
                              onClick={failed ? () => setExpandedId(expanded ? null : log.id) : undefined}
                            >
                              <TableCell>
                                {failed ? (
                                  expanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{log.request_id}</TableCell>
                              <TableCell className="text-sm">{log.endpoint}</TableCell>
                              <TableCell>{getStatusBadge(log.status_code, log.rate_limited)}</TableCell>
                              <TableCell className="text-sm">
                                {log.attempt_number != null ? `#${log.attempt_number}` : "-"}
                              </TableCell>
                              <TableCell>
                                {log.final_state === "delivered" ? (
                                  <Badge variant="default" className="bg-green-600 hover:bg-green-600/90">Delivered</Badge>
                                ) : log.final_state === "failed" ? (
                                  <Badge variant="destructive">Failed</Badge>
                                ) : log.final_state === "disabled" ? (
                                  <Badge variant="secondary">Disabled</Badge>
                                ) : log.will_retry ? (
                                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Retry pending
                                  </Badge>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.duration_ms ? `${log.duration_ms}ms` : "-"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground" title={format(new Date(log.created_at), "PPpp")}>
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                              </TableCell>
                              <TableCell className="text-sm text-destructive max-w-[200px] truncate" title={log.error_message || ""}>
                                {log.error_message || "-"}
                              </TableCell>
                            </TableRow>
                            {failed && expanded && (
                              <TableRow key={`${log.id}-detail`} className="bg-muted/40 hover:bg-muted/40">
                                <TableCell colSpan={9}>
                                  <div className="p-2 space-y-3">
                                    <p className="text-sm font-medium">Error details</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Status code</p>
                                        <p>{log.status_code || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Duration</p>
                                        <p>{log.duration_ms != null ? `${log.duration_ms}ms` : "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Attempt</p>
                                        <p>{log.attempt_number != null ? `#${log.attempt_number}` : "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Outcome</p>
                                        <p>{log.final_state || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Will retry</p>
                                        <p>{log.will_retry ? "Yes" : "No"}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Timestamp</p>
                                        <p>{format(new Date(log.created_at), "PPpp")}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Error message</p>
                                      <p className="text-sm text-destructive font-mono break-words whitespace-pre-wrap rounded bg-background border p-2">
                                        {log.error_message || "No error message recorded."}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={logsLoading}>
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
