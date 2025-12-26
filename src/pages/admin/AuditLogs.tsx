import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { Search, FileText, X, Building2 } from "lucide-react";
import { format } from "date-fns";

export default function AdminAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
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

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", companyFilter],
    queryFn: async () => {
      let query = supabase
        .from("platform_audit_logs")
        .select(`
          *,
          profiles:user_id(email, display_name)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      // If filtering by company, filter by entity_id matching the company
      if (companyFilter) {
        query = query.eq("entity_id", companyFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const clearCompanyFilter = () => {
    searchParams.delete("company");
    setSearchParams(searchParams);
  };

  const entityTypes = [...new Set(logs?.map((log) => log.entity_type) || [])];

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.profiles as any)?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    if (action.includes("update") || action.includes("change")) return "secondary";
    return "outline";
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Activity Log
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={entityFilter} onValueChange={setEntityFilter}>
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
                    placeholder="Search logs..."
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
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found</p>
                <p className="text-sm">Activity will appear here once events are logged</p>
              </div>
            ) : (
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
                    <TableRow key={log.id}>
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
                            {JSON.stringify(log.details)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
