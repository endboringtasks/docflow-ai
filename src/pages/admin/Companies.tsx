import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Building2, ChevronRight, MoreHorizontal, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CompanyDetail } from "./CompanyDetail";
import { Database } from "@/integrations/supabase/types";

type SubscriptionPlan = Database["public"]["Enums"]["subscription_plan"];
const PLANS: SubscriptionPlan[] = ["free", "basic", "pro", "enterprise"];

export default function AdminCompanies() {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ type: string; value?: string } | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          company_members(count),
          clients(count),
          visa_applications(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredCompanies = companies?.filter((company) => {
    const matchesSearch = company.name.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "all" || company.subscription_plan === planFilter;
    const matchesStatus =
      statusFilter === "all" || (company.subscription_status || "") === statusFilter;
    const matchesNiche = nicheFilter === "all" || company.niche === nicheFilter;
    return matchesSearch && matchesPlan && matchesStatus && matchesNiche;
  });

  const totalPages = Math.max(1, Math.ceil((filteredCompanies?.length ?? 0) / PAGE_SIZE));
  const pagedCompanies = filteredCompanies?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, planFilter, statusFilter, nicheFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const allSelected = filteredCompanies?.length > 0 && selectedIds.size === filteredCompanies?.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies?.map((c) => c.id) || []));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, plan }: { ids: string[]; plan: SubscriptionPlan }) => {
      const { error } = await supabase
        .from("companies")
        .update({ subscription_plan: plan })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success(`Updated ${selectedIds.size} companies`);
      setSelectedIds(new Set());
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update companies");
    },
  });

  const handleBulkPlanChange = (plan: SubscriptionPlan) => {
    setBulkAction({ type: "plan", value: plan });
  };

  const confirmBulkAction = () => {
    if (bulkAction?.type === "plan" && bulkAction.value) {
      bulkUpdateMutation.mutate({
        ids: Array.from(selectedIds),
        plan: bulkAction.value as SubscriptionPlan,
      });
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return "default";
      case "pro":
        return "secondary";
      case "basic":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "active":
        return "default";
      case "canceled":
        return "destructive";
      case "past_due":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Manage all companies on the platform</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  All Companies
                </CardTitle>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedIds.size} selected</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="w-4 h-4 mr-1" />
                          Bulk Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                          Change Plan To:
                        </DropdownMenuItem>
                        {PLANS.map((plan) => (
                          <DropdownMenuItem
                            key={plan}
                            onClick={() => handleBulkPlanChange(plan)}
                            className="capitalize"
                          >
                            {plan}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedIds(new Set())}>
                          Clear Selection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={nicheFilter} onValueChange={setNicheFilter}>
                  <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Niche" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All niches</SelectItem>
                    {["migration", "audit", "hr"].map((n) => (
                      <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["active", "trialing", "past_due", "canceled", "incomplete"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
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
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                      />
                    </TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Niche</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedCompanies?.map((company) => (
                    <TableRow 
                      key={company.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      data-state={selectedIds.has(company.id) ? "selected" : undefined}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(company.id)}
                          onCheckedChange={() => toggleSelect(company.id)}
                          aria-label={`Select ${company.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" onClick={() => setSelectedCompanyId(company.id)}>
                        {company.name}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>
                        <Badge variant="outline" className="capitalize">
                          {company.niche}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>
                        <Badge variant={getPlanBadgeVariant(company.subscription_plan)} className="capitalize">
                          {company.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>
                        <Badge variant={getStatusBadgeVariant(company.subscription_status)} className="capitalize">
                          {company.subscription_status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>{(company.company_members as any)?.[0]?.count ?? 0}</TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>{(company.clients as any)?.[0]?.count ?? 0}</TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>{(company.visa_applications as any)?.[0]?.count ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedCompanyId(company.id)}>
                        {format(new Date(company.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCompanyId(company.id)}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCompanies?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No companies found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <CompanyDetail
          companyId={selectedCompanyId}
          open={!!selectedCompanyId}
          onOpenChange={(open) => !open && setSelectedCompanyId(null)}
        />

        <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to change the subscription plan of{" "}
                <strong>{selectedIds.size} companies</strong> to{" "}
                <strong className="capitalize">{bulkAction?.value}</strong>.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkAction}
                disabled={bulkUpdateMutation.isPending}
              >
                {bulkUpdateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
