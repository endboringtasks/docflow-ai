import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bug, Lightbulb, HelpCircle, MessageSquare, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type FeedbackType = "bug" | "feature" | "question" | "other";
type FeedbackStatus = "new" | "reviewed" | "resolved" | "wont_fix";

interface Feedback {
  id: string;
  user_id: string;
  company_id: string | null;
  type: FeedbackType;
  title: string;
  description: string;
  current_page: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const typeIcons: Record<FeedbackType, typeof Bug> = {
  bug: Bug,
  feature: Lightbulb,
  question: HelpCircle,
  other: MessageSquare,
};

const typeLabels: Record<FeedbackType, string> = {
  bug: "Bug",
  feature: "Feature",
  question: "Question",
  other: "Other",
};

const statusColors: Record<FeedbackStatus, string> = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  reviewed: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  wont_fix: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  resolved: "Resolved",
  wont_fix: "Won't Fix",
};

export default function AdminFeedback() {
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feedback, isLoading } = useQuery({
    queryKey: ["admin-feedback", typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("beta_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Feedback[];
    },
  });

  const updateFeedback = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: FeedbackStatus; notes?: string }) => {
      const updates: Partial<Feedback> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.admin_notes = notes;

      const { error } = await supabase
        .from("beta_feedback")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast({ title: "Feedback updated" });
    },
    onError: () => {
      toast({ title: "Error updating feedback", variant: "destructive" });
    },
  });

  const handleStatusChange = (id: string, status: FeedbackStatus) => {
    updateFeedback.mutate({ id, status });
  };

  const handleSaveNotes = (id: string) => {
    updateFeedback.mutate({ id, notes: adminNotes[id] || "" });
  };

  const stats = feedback?.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      acc.total++;
      return acc;
    },
    { new: 0, reviewed: 0, resolved: 0, wont_fix: 0, total: 0 } as Record<string, number>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Beta Feedback</h1>
          <p className="text-muted-foreground">Review and manage feedback from beta users</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total", value: stats?.total || 0, className: "" },
            { label: "New", value: stats?.new || 0, className: "text-blue-500" },
            { label: "Reviewed", value: stats?.reviewed || 0, className: "text-yellow-500" },
            { label: "Resolved", value: stats?.resolved || 0, className: "text-green-500" },
            { label: "Won't Fix", value: stats?.wont_fix || 0, className: "text-muted-foreground" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${stat.className}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FeedbackType | "all")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FeedbackStatus | "all")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="wont_fix">Won't Fix</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feedback table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : feedback?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No feedback found
                  </TableCell>
                </TableRow>
              ) : (
                feedback?.map((item) => {
                  const Icon = typeIcons[item.type];
                  const isExpanded = expandedId === item.id;

                  return (
                    <Collapsible key={item.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : item.id)}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{typeLabels[item.type]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {item.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[item.status]}>
                            {statusLabels[item.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                          {item.current_page || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.status}
                            onValueChange={(v) => handleStatusChange(item.id, v as FeedbackStatus)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="wont_fix">Won't Fix</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium text-sm mb-1">Description</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {item.description}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-medium text-sm mb-1">Admin Notes</h4>
                                <div className="flex gap-2">
                                  <Textarea
                                    placeholder="Add notes about this feedback..."
                                    value={adminNotes[item.id] ?? item.admin_notes ?? ""}
                                    onChange={(e) => setAdminNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    className="min-h-[80px]"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => handleSaveNotes(item.id)}
                                  disabled={updateFeedback.isPending}
                                >
                                  Save Notes
                                </Button>
                              </div>
                              {item.user_agent && (
                                <div>
                                  <h4 className="font-medium text-sm mb-1">Browser</h4>
                                  <p className="text-xs text-muted-foreground font-mono truncate">
                                    {item.user_agent}
                                  </p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
}
