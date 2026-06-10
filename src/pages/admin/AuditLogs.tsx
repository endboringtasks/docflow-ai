import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  FileText,
  X,
  Building2,
  CalendarIcon,
  AlertTriangle,
  RefreshCw,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

// BR-7 / PERM-2 / TC-6: mask secrets even if present in raw details.
const SENSITIVE_KEY_PATTERN =
  /(token|password|secret|api[_-]?key|authorization|client[_-]?secret|credential|private[_-]?key)/i;

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "***REDACTED***";
      } else {
        result[key] = redactSecrets(val);
      }
    }
    return result;
  }
  return value;
}

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
  profiles: { email: string | null; display_name: string | null } | null;
};

export default function AdminAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const companyFilter = searchParams.get("company");

  const { data: company } = useQuery({
    queryKey: ["admin-company-name", companyFilter],
    queryFn: async () => {
      if (!companyFilter) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyFilter)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!companyFilter,
  });

  // Distinct actions for the action-type filter dropdown (BR-8 / UI-2).
  const { data: actionOptions } = useQuery({
    queryKey: ["admin-audit-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_audit_logs")
        .select("action")
        .limit(1000);
      if (error) throw error;
      return [...new Set((data ?? []).map((d) => d.action).filter(Boolean))].sort();
    },
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [
      "admin-audit-logs",
      companyFilter,
      actionFilter,
      entityFilter,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
      page,
    ],
    queryFn: async () => {
      let query = supabase
        .from("platform_audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (companyFilter) {
        query = query.eq("entity_id", companyFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }
      if (dateRange?.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: rows, error, count } = await query;
      if (error) throw error;

      // platform_audit_logs.user_id has a FK to auth.users, not public.profiles,
      // so the relationship can't be embedded. Resolve profiles separately.
      const userIds = [...new Set((rows ?? []).map((l) => l.user_id).filter(Boolean))];
      let profileMap = new Map<string, { email: string | null; display_name: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds as string[]);
        profileMap = new Map(
          (profiles ?? []).map((p) => [p.id, { email: p.email, display_name: p.display_name }])
        );
      }

      const logs: AuditLog[] = (rows ?? []).map((log) => ({
        ...log,
        profiles: log.user_id ? profileMap.get(log.user_id) ?? null : null,
      }));

      return { logs, count: count ?? 0 };
    },
  });

  const logs = data?.logs;
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const clearCompanyFilter = () => {
    searchParams.delete("company");
    setSearchParams(searchParams);
  };

  const entityTypes = [...new Set(logs?.map((log) => log.entity_type) || [])];

  // Text search only applies to the currently loaded page.
  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.profiles as any)?.email?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    if (action.includes("update") || action.includes("change")) return "secondary";
    return "outline";
  };

  const resetPage = () => setPage(0);

  const copyJson = async (value: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(redactSecrets(value), null, 2));
      toast({ title: "Copied", description: "JSON details copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground">Track all platform activities and changes</p>
          </div>
          {company && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-2 py-1.5 px-3">
                <Building2 className="w-3.5 h-3.5" />
                Filtered by: {company.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={clearCompanyFilter}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Activity Log
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        resetPage();
                      }}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                    {dateRange && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setDateRange(undefined);
                            resetPage();
                          }}
                        >
                          Clear dates
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <Select
                  value={actionFilter}
                  onValueChange={(v) => {
                    setActionFilter(v);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {(actionOptions ?? []).map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={entityFilter}
                  onValueChange={(v) => {
                    setEntityFilter(v);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {entityTypes.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search this page..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive opacity-70" />
                <p className="font-medium">Failed to load audit logs</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Something went wrong while fetching the logs.
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found</p>
                <p className="text-sm">Activity will appear here once events are logged</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {(log.profiles as any)?.display_name || "System"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(log.profiles as any)?.email || "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                          {log.entity_id || "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {log.details && Object.keys(log.details as object).length > 0 ? (
                            <span className="text-xs text-muted-foreground truncate block">
                              {JSON.stringify(redactSecrets(log.details))}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.ip_address || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {totalCount > 0 ? (
                      <>
                        Showing {page * PAGE_SIZE + 1}-
                        {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                      </>
                    ) : (
                      "0 results"
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0 || isFetching}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1 || isFetching}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit Log Details</SheetTitle>
            <SheetDescription>
              Full context for this audit entry. Sensitive values are redacted.
            </SheetDescription>
          </SheetHeader>
          {selectedLog && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Action</span>
                <span className="col-span-2">
                  <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </span>

                <span className="text-muted-foreground">Timestamp</span>
                <span className="col-span-2">
                  {format(new Date(selectedLog.created_at), "MMM d, yyyy HH:mm:ss")}
                </span>

                <span className="text-muted-foreground">User</span>
                <span className="col-span-2">
                  {(selectedLog.profiles as any)?.display_name || "System"}
                  {(selectedLog.profiles as any)?.email && (
                    <span className="block text-xs text-muted-foreground">
                      {(selectedLog.profiles as any).email}
                    </span>
                  )}
                </span>

                <span className="text-muted-foreground">Entity Type</span>
                <span className="col-span-2 capitalize">{selectedLog.entity_type}</span>

                <span className="text-muted-foreground">Entity ID</span>
                <span className="col-span-2 font-mono text-xs break-all">
                  {selectedLog.entity_id || "-"}
                </span>

                <span className="text-muted-foreground">IP Address</span>
                <span className="col-span-2">{selectedLog.ip_address || "-"}</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Details (JSON)</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyJson(selectedLog.details)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-2" />
                    Copy
                  </Button>
                </div>
                <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {selectedLog.details &&
                  Object.keys(selectedLog.details as object).length > 0
                    ? JSON.stringify(redactSecrets(selectedLog.details), null, 2)
                    : "No details recorded."}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
