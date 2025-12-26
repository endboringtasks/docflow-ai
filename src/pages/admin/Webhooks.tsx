import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Webhook, Plus, Trash2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// Topic-based event configuration
const WEBHOOK_TOPICS = [
  {
    id: "clients",
    label: "Clients",
    description: "All client lifecycle events",
    events: ["client.created", "client.updated", "client.deleted"],
  },
  {
    id: "matters",
    label: "Matters",
    description: "All matter/application lifecycle events",
    events: ["matter.created", "matter.updated", "matter.deleted"],
  },
];

export default function AdminWebhooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    topics: [] as string[],
    timeout_seconds: 10,
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_webhooks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createWebhook = useMutation({
    mutationFn: async () => {
      const secretKey = crypto.randomUUID();
      // Expand topics to individual events for storage
      const events = newWebhook.topics.flatMap(
        (topicId) => WEBHOOK_TOPICS.find((t) => t.id === topicId)?.events || []
      );
      
      const { error } = await supabase.from("platform_webhooks").insert({
        name: newWebhook.name,
        url: newWebhook.url,
        events: events,
        timeout_seconds: newWebhook.timeout_seconds,
        secret_key: secretKey,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      setIsDialogOpen(false);
      setNewWebhook({ name: "", url: "", topics: [], timeout_seconds: 10 });
      toast.success("Webhook created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create webhook: " + error.message);
    },
  });

  const updateTimeout = useMutation({
    mutationFn: async ({ id, timeout }: { id: string; timeout: number }) => {
      const { error } = await supabase
        .from("platform_webhooks")
        .update({ timeout_seconds: timeout })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      toast.success("Timeout updated");
    },
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("platform_webhooks")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      toast.success("Webhook deleted");
    },
  });

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success("Secret copied to clipboard");
  };

  const handleTopicToggle = (topicId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      topics: prev.topics.includes(topicId)
        ? prev.topics.filter((t) => t !== topicId)
        : [...prev.topics, topicId],
    }));
  };

  // Helper to determine which topics a webhook is subscribed to based on its events
  const getWebhookTopics = (events: string[]) => {
    return WEBHOOK_TOPICS.filter((topic) =>
      topic.events.every((event) => events.includes(event))
    ).map((t) => t.label);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              Connect to external tools like Make.com, Zapier, or n8n
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Webhook</DialogTitle>
                <DialogDescription>
                  Add a new webhook to send events to external services
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Make.com Integration"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    placeholder="https://hook.make.com/..."
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook((prev) => ({ ...prev, url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Topics to Subscribe</Label>
                  <div className="space-y-3">
                    {WEBHOOK_TOPICS.map((topic) => (
                      <div key={topic.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          id={topic.id}
                          checked={newWebhook.topics.includes(topic.id)}
                          onCheckedChange={() => handleTopicToggle(topic.id)}
                        />
                        <div className="flex-1">
                          <label htmlFor={topic.id} className="text-sm font-medium cursor-pointer">
                            {topic.label}
                          </label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {topic.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {topic.events.map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event.split(".")[1]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Folder Creation Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={5}
                    max={300}
                    placeholder="10"
                    value={newWebhook.timeout_seconds}
                    onChange={(e) => setNewWebhook((prev) => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 10 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time to wait before marking folder creation as failed (5-300 seconds)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createWebhook.mutate()}
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.topics.length === 0}
                >
                  Create Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Integration Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Use the webhook URL in Make.com, Zapier, or n8n as a trigger</p>
            <p>• The secret key is used for verifying webhook signatures (HMAC-SHA256)</p>
            <p>• Each event sends a JSON payload with event type and data</p>
          </CardContent>
        </Card>

        {/* Webhooks Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Configured Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : webhooks?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No webhooks configured yet. Create one to start sending events.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Timeout</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks?.map((webhook) => {
                    const topics = getWebhookTopics(webhook.events);
                    return (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {topics.map((topic) => (
                            <Badge key={topic} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {topics.length === 0 && (
                            <span className="text-xs text-muted-foreground">No topics</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={5}
                          max={300}
                          className="w-20 h-8 text-sm"
                          value={(webhook as any).timeout_seconds ?? 10}
                          onChange={(e) => updateTimeout.mutate({ 
                            id: webhook.id, 
                            timeout: parseInt(e.target.value) || 10 
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={(checked) =>
                            toggleWebhook.mutate({ id: webhook.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(webhook.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteWebhook.mutate(webhook.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
