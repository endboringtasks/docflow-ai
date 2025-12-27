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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Webhook, Plus, Trash2, Copy, ExternalLink, Code, ChevronDown, ChevronRight, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// Topic-based event configuration
const WEBHOOK_TOPICS = [
  {
    id: "clients",
    label: "Client",
    description: "All client lifecycle events",
    events: ["client.created", "client.updated", "client.deleted"],
  },
  {
    id: "matters",
    label: "Matter",
    description: "All matter/application lifecycle events",
    events: ["matter.created", "matter.updated", "matter.deleted"],
  },
];

// All available fields for webhook payloads (organized by entity)
const ALL_FIELDS = {
  client: [
    { id: "client_id", label: "Client ID", description: "Unique client identifier", default: true },
    { id: "client_type", label: "Client Type", description: "Personal or corporate", default: true },
    { id: "first_name", label: "First Name", description: "Client first name", default: true },
    { id: "last_name", label: "Last Name", description: "Client last name", default: true },
    { id: "company_name", label: "Company Name", description: "Company name (for corporate clients)", default: true },
    { id: "company_id", label: "Company ID", description: "Internal company identifier", default: true },
    { id: "email", label: "Email", description: "Client email address", default: true },
    { id: "phone", label: "Phone", description: "Client phone number", default: true },
    { id: "drive_folder_id", label: "Drive Folder ID", description: "Client's Google Drive folder", default: true },
    { id: "folder_status", label: "Folder Status", description: "Drive folder creation status", default: true },
    { id: "folder_status_updated_at", label: "Folder Status Updated At", description: "When folder status last changed", default: true },
    { id: "created_at", label: "Created At", description: "Timestamp when client was created", default: true },
  ],
  matter: [
    { id: "matter_id", label: "Matter ID", description: "Unique matter identifier", default: true },
    { id: "matter_name", label: "Matter Name", description: "Name of the matter/case", default: true },
    { id: "visa_subclass", label: "Visa Subclass", description: "Visa type being applied for", default: true },
    { id: "company_id", label: "Company ID", description: "Internal company identifier", default: true },
    { id: "client_id", label: "Client ID", description: "Associated client identifier", default: true },
    { id: "status", label: "Status", description: "Matter status (draft, active, done)", default: true },
    { id: "drive_folder_id", label: "Drive Folder ID", description: "Matter's Google Drive folder", default: true },
    { id: "folder_status", label: "Folder Status", description: "Drive folder creation status", default: true },
    { id: "folder_status_updated_at", label: "Folder Status Updated At", description: "When folder status last changed", default: true },
    { id: "created_at", label: "Created At", description: "Timestamp when matter was created", default: true },
  ],
};

// Get default selected fields
const getDefaultFields = () => {
  const defaults: string[] = [];
  Object.values(ALL_FIELDS).forEach(fields => {
    fields.filter(f => f.default).forEach(f => defaults.push(f.id));
  });
  return [...new Set(defaults)]; // Remove duplicates
};

// Sample payloads for each event type (matches actual webhook structure)
const SAMPLE_PAYLOADS: Record<string, object> = {
  "client.created": {
    event: "client.created",
    timestamp: "2025-01-15T10:30:00.000Z",
    data: {
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      company_id: "123e4567-e89b-12d3-a456-426614174000",
      client_type: "personal",
      first_name: "John",
      last_name: "Smith",
      company_name: null,
      root_folder_id: "1ABC123DEF456_GoogleDriveFolderId",
    },
  },
  "client.updated": {
    event: "client.updated",
    timestamp: "2025-01-15T11:00:00.000Z",
    data: {
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      company_id: "123e4567-e89b-12d3-a456-426614174000",
      client_type: "personal",
      first_name: "John",
      last_name: "Smith-Jones",
      company_name: null,
      drive_folder_id: "1XYZ789_ClientFolderId",
    },
  },
  "client.deleted": {
    event: "client.deleted",
    timestamp: "2025-01-15T12:00:00.000Z",
    data: {
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      company_id: "123e4567-e89b-12d3-a456-426614174000",
      client_type: "personal",
      first_name: "John",
      last_name: "Smith-Jones",
      company_name: null,
      drive_folder_id: "1XYZ789_ClientFolderId",
    },
  },
  "matter.created": {
    event: "matter.created",
    timestamp: "2025-01-15T10:35:00.000Z",
    data: {
      matter_id: "660e8400-e29b-41d4-a716-446655440001",
      matter_name: "Partner Visa Application",
      visa_subclass: "820/801",
      client_folder_id: "1XYZ789_ClientFolderId",
    },
  },
  "matter.updated": {
    event: "matter.updated",
    timestamp: "2025-01-15T14:00:00.000Z",
    data: {
      matter_id: "660e8400-e29b-41d4-a716-446655440001",
      matter_name: "Partner Visa Application",
      visa_subclass: "820/801",
      status: "active",
      drive_folder_id: "1MNO456_MatterFolderId",
    },
  },
  "matter.deleted": {
    event: "matter.deleted",
    timestamp: "2025-01-15T16:00:00.000Z",
    data: {
      matter_id: "660e8400-e29b-41d4-a716-446655440001",
      matter_name: "Partner Visa Application",
      visa_subclass: "820/801",
      drive_folder_id: "1MNO456_MatterFolderId",
    },
  },
};

const PayloadPreview = ({ eventType }: { eventType: string }) => {
  const payload = SAMPLE_PAYLOADS[eventType];
  
  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Payload copied to clipboard");
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-7 px-2"
        onClick={copyPayload}
      >
        <Copy className="w-3.5 h-3.5 mr-1" />
        Copy
      </Button>
      <pre className="bg-muted/50 border rounded-lg p-4 text-xs overflow-x-auto">
        <code>{JSON.stringify(payload, null, 2)}</code>
      </pre>
    </div>
  );
};

export default function AdminWebhooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    events: [] as string[],
    included_fields: getDefaultFields(),
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
      
      const { error } = await supabase.from("platform_webhooks").insert({
        name: newWebhook.name,
        url: newWebhook.url,
        events: newWebhook.events,
        included_fields: newWebhook.included_fields,
        timeout_seconds: newWebhook.timeout_seconds,
        secret_key: secretKey,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      setIsDialogOpen(false);
      setNewWebhook({ name: "", url: "", events: [], included_fields: getDefaultFields(), timeout_seconds: 10 });
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

  const handleEventToggle = (eventName: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventName)
        ? prev.events.filter((e) => e !== eventName)
        : [...prev.events, eventName],
    }));
  };

  const handleFieldToggle = (fieldId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      included_fields: prev.included_fields.includes(fieldId)
        ? prev.included_fields.filter((f) => f !== fieldId)
        : [...prev.included_fields, fieldId],
    }));
  };

  // Helper to determine which topics a webhook is subscribed to based on its events
  const getWebhookTopics = (events: string[]) => {
    return WEBHOOK_TOPICS.filter((topic) =>
      topic.events.every((event) => events.includes(event))
    ).map((t) => t.label);
  };

  // Determine which optional field categories to show based on selected events
  const getRelevantFieldCategories = () => {
    const hasClientEvents = newWebhook.events.some(e => e.startsWith("client."));
    const hasMatterEvents = newWebhook.events.some(e => e.startsWith("matter."));
    const categories: Array<{ key: "client" | "matter"; label: string }> = [];
    if (hasClientEvents) categories.push({ key: "client", label: "Client Fields" });
    if (hasMatterEvents) categories.push({ key: "matter", label: "Matter Fields" });
    return categories;
  };

  // Test webhook mutation
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  
  const testWebhook = useMutation({
    mutationFn: async ({ webhookId, events }: { webhookId: string; events: string[] }) => {
      setTestingWebhookId(webhookId);
      
      // Get the first event type subscribed to use as test
      const testEventType = events[0] || "client.created";
      const testPayload = SAMPLE_PAYLOADS[testEventType] || SAMPLE_PAYLOADS["client.created"];
      
      // Call dispatch-webhook with test data
      const response = await supabase.functions.invoke("dispatch-webhook", {
        body: {
          event_type: testEventType,
          data: (testPayload as any).data,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: (data) => {
      setTestingWebhookId(null);
      if (data.dispatched > 0) {
        toast.success(`Test webhook sent successfully! ${data.dispatched} webhook(s) received the payload.`);
      } else {
        toast.info("No active webhooks matched the test event.");
      }
    },
    onError: (error) => {
      setTestingWebhookId(null);
      toast.error("Failed to send test webhook: " + error.message);
    },
  });

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
                  <Label>Events to Subscribe</Label>
                  <div className="space-y-3">
                    {WEBHOOK_TOPICS.map((topic) => {
                      const topicEvents = topic.events;
                      const selectedTopicEvents = topicEvents.filter(e => newWebhook.events.includes(e));
                      const allSelected = selectedTopicEvents.length === topicEvents.length;
                      const someSelected = selectedTopicEvents.length > 0 && !allSelected;
                      
                      const handleTopicCheckboxChange = () => {
                        if (allSelected) {
                          // Deselect all events in this topic
                          setNewWebhook(prev => ({
                            ...prev,
                            events: prev.events.filter(e => !topicEvents.includes(e))
                          }));
                        } else {
                          // Select all events in this topic
                          setNewWebhook(prev => ({
                            ...prev,
                            events: [...new Set([...prev.events, ...topicEvents])]
                          }));
                        }
                      };
                      
                      return (
                        <div key={topic.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={topic.id}
                              checked={allSelected}
                              className={someSelected ? "data-[state=unchecked]:bg-primary/30" : ""}
                              onCheckedChange={handleTopicCheckboxChange}
                            />
                            <div className="flex-1">
                              <label htmlFor={topic.id} className="text-sm font-medium cursor-pointer">
                                {topic.label}
                              </label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {topic.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 ml-7">
                            {topic.events.map((event) => {
                              const isSelected = newWebhook.events.includes(event);
                              return (
                                <Badge 
                                  key={event} 
                                  variant={isSelected ? "default" : "outline"} 
                                  className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleEventToggle(event)}
                                >
                                  {event.split(".")[1]}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Optional Fields Section */}
                {newWebhook.events.length > 0 && (
                  <div className="space-y-2">
                    <Label>Fields to Include</Label>
                    <p className="text-xs text-muted-foreground">
                      Select which fields to include in webhook payloads:
                    </p>
                    <div className="space-y-3 mt-2">
                      {getRelevantFieldCategories().map((category) => (
                        <div key={category.key} className="p-3 border rounded-lg space-y-2">
                          <span className="text-sm font-medium">{category.label}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_FIELDS[category.key].map((field) => {
                              const isSelected = newWebhook.included_fields.includes(field.id);
                              return (
                                <Badge
                                  key={field.id}
                                  variant={isSelected ? "default" : "outline"}
                                  className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleFieldToggle(field.id)}
                                  title={field.description}
                                >
                                  {field.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
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
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
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

        {/* Payload Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Payload Preview
            </CardTitle>
            <CardDescription>
              Sample JSON payloads for each event type. Use these to configure your automation workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="client.created" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                {Object.keys(SAMPLE_PAYLOADS).map((eventType) => (
                  <TabsTrigger 
                    key={eventType} 
                    value={eventType}
                    className="text-xs"
                  >
                    {eventType}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.keys(SAMPLE_PAYLOADS).map((eventType) => (
                <TabsContent key={eventType} value={eventType} className="mt-0">
                  <PayloadPreview eventType={eventType} />
                </TabsContent>
              ))}
            </Tabs>
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
                    <TableHead>Events</TableHead>
                    <TableHead>Timeout</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks?.map((webhook) => {
                    // Group events by topic for display
                    const clientEvents = webhook.events.filter(e => e.startsWith("client."));
                    const matterEvents = webhook.events.filter(e => e.startsWith("matter."));
                    
                    return (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {clientEvents.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-medium text-muted-foreground w-12">Client:</span>
                              {clientEvents.map((event) => (
                                <Badge key={event} variant="secondary" className="text-xs">
                                  {event.split(".")[1]}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {matterEvents.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-medium text-muted-foreground w-12">Matter:</span>
                              {matterEvents.map((event) => (
                                <Badge key={event} variant="secondary" className="text-xs">
                                  {event.split(".")[1]}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {webhook.events.length === 0 && (
                            <span className="text-xs text-muted-foreground">No events</span>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testWebhook.mutate({ webhookId: webhook.id, events: webhook.events })}
                            disabled={!webhook.is_active || testingWebhookId === webhook.id}
                            title={!webhook.is_active ? "Enable webhook to test" : "Send test payload"}
                          >
                            {testingWebhookId === webhook.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteWebhook.mutate(webhook.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
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
