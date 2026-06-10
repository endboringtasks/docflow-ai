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
import { Webhook, Plus, Trash2, Copy, ExternalLink, ChevronDown, ChevronRight, Send, Loader2, Pencil, CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import type { 
  WebhookEventType, 
  WebhookTopic, 
  WebhookFieldDefinition, 
  WebhookEntityCategory,
  FieldCategory,
  CLIENT_EVENTS,
  APPLICATION_EVENTS,
} from "@/types/webhook.types";

// Topic-based event configuration with strict typing
const WEBHOOK_TOPICS: WebhookTopic[] = [
  {
    id: "clients",
    label: "Client",
    description: "All client lifecycle events",
    events: ["client.created", "client.updated", "client.deleted"],
  },
  {
    id: "applications",
    label: "Application",
    description: "All Application lifecycle events",
    events: ["application.created", "application.updated", "application.deleted"],
  },
];

// All available fields for webhook payloads (organized by entity)
// DOC-52: `mandatory` fields are always sent and locked; `sensitive` fields are
// PII, excluded by default and gated behind an explicit toggle.
const ALL_FIELDS: Record<WebhookEntityCategory, WebhookFieldDefinition[]> = {
  client: [
    { id: "client_id", label: "Client ID", description: "Unique client identifier (resource id)", default: true, mandatory: true },
    { id: "company_id", label: "Organization ID", description: "Your firm/agency identifier", default: true, mandatory: true },
    { id: "created_at", label: "Created At", description: "Timestamp when client was created", default: true, mandatory: true },
    { id: "client_type", label: "Client Type", description: "Personal or corporate", default: true },
    { id: "first_name", label: "First Name", description: "Client first name", default: false, sensitive: true, sensitivityCategory: "identity" },
    { id: "last_name", label: "Last Name", description: "Client last name", default: false, sensitive: true, sensitivityCategory: "identity" },
    { id: "company_name", label: "Company Name", description: "Company name (for corporate clients)", default: false, sensitive: true, sensitivityCategory: "identity" },
    { id: "email", label: "Email", description: "Client email address", default: false, sensitive: true, sensitivityCategory: "contact" },
    { id: "phone", label: "Phone", description: "Client phone number", default: false, sensitive: true, sensitivityCategory: "contact" },
    { id: "client_folder_id", label: "Client Folder ID", description: "Client's Google Drive folder", default: true },
    { id: "root_folder_id", label: "Root Folder ID", description: "Company's root Google Drive folder", default: true },
    { id: "folder_status", label: "Folder Status", description: "Drive folder creation status", default: true },
    { id: "folder_status_updated_at", label: "Folder Status Updated At", description: "When folder status last changed", default: true },
  ],
  visa_application: [
    { id: "application_id", label: "Application ID", description: "Unique application identifier (resource id)", default: true, mandatory: true },
    { id: "company_id", label: "Organization ID", description: "Your firm/agency identifier", default: true, mandatory: true },
    { id: "created_at", label: "Created At", description: "Timestamp when application was created", default: true, mandatory: true },
    { id: "application_name", label: "Application Name", description: "Name of the application", default: true },
    { id: "subclass", label: "Subclass", description: "Visa type being applied for", default: true },
    { id: "client_id", label: "Client ID", description: "Associated client identifier", default: true },
    { id: "client_folder_id", label: "Client Folder ID", description: "Client's Google Drive folder", default: true },
    { id: "status", label: "Status", description: "Application status (draft, active, done)", default: true },
    { id: "application_folder_id", label: "Drive Folder ID", description: "Application's Google Drive folder", default: true },
    { id: "folder_status", label: "Folder Status", description: "Drive folder creation status", default: true },
    { id: "folder_status_updated_at", label: "Folder Status Updated At", description: "When folder status last changed", default: true },
  ],
};

// Flat lookup of every field definition by id (last definition wins for shared ids)
const FIELD_DEF_BY_ID: Record<string, WebhookFieldDefinition> = (() => {
  const map: Record<string, WebhookFieldDefinition> = {};
  Object.values(ALL_FIELDS).forEach((fields) => {
    fields.forEach((f) => {
      // Prefer a mandatory/sensitive definition if any category marks it so
      const existing = map[f.id];
      map[f.id] = {
        ...f,
        mandatory: f.mandatory || existing?.mandatory,
        sensitive: f.sensitive || existing?.sensitive,
      };
    });
  });
  return map;
})();

const MANDATORY_FIELD_IDS = Object.values(FIELD_DEF_BY_ID)
  .filter((f) => f.mandatory)
  .map((f) => f.id);

const SENSITIVE_FIELD_IDS = new Set(
  Object.values(FIELD_DEF_BY_ID).filter((f) => f.sensitive).map((f) => f.id)
);

const isMandatoryField = (id: string) => !!FIELD_DEF_BY_ID[id]?.mandatory;
const isSensitiveField = (id: string) => SENSITIVE_FIELD_IDS.has(id);

// Get default selected fields: mandatory + non-sensitive defaults (BR-8: never PII)
const getDefaultFields = () => {
  const defaults: string[] = [];
  Object.values(ALL_FIELDS).forEach(fields => {
    fields.filter(f => (f.default || f.mandatory) && !f.sensitive).forEach(f => defaults.push(f.id));
  });
  return [...new Set(defaults)]; // Remove duplicates
};

// Sample payloads for each event type (matches actual webhook structure)


export default function AdminWebhooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<{ id: string } | null>(null);
  const [newWebhook, setNewWebhook] = useState<{
    name: string;
    url: string;
    events: WebhookEventType[];
    included_fields: string[];
    timeout_seconds: number;
    max_retries: number;
    retry_backoff_seconds: number;
    delivery_timeout_seconds: number;
    max_backoff_seconds: number | null;
  }>({
    name: "",
    url: "",
    events: [],
    included_fields: getDefaultFields(),
    timeout_seconds: 10,
    max_retries: 3,
    retry_backoff_seconds: 5,
    delivery_timeout_seconds: 30,
    max_backoff_seconds: null,
  });

  const [deletingWebhook, setDeletingWebhook] = useState<{ id: string; name: string } | null>(null);
  // DOC-52 UI state
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasSensitiveSelected = (fields: string[]) => fields.some((f) => isSensitiveField(f));

  // Always ensure mandatory fields are present in a selection (BR-7/BR-13)
  const withMandatoryFields = (fields: string[]) =>
    [...new Set([...fields, ...MANDATORY_FIELD_IDS])];

  const resetForm = () => {
    setNewWebhook({
      name: "",
      url: "",
      events: [],
      included_fields: getDefaultFields(),
      timeout_seconds: 10,
      max_retries: 3,
      retry_backoff_seconds: 5,
      delivery_timeout_seconds: 30,
      max_backoff_seconds: null,
    });
    setEditingWebhook(null);
    setIncludeSensitive(false);
    setFieldSearch("");
    setValidationError(null);
  };

  const openEditDialog = (webhook: any) => {
    setEditingWebhook({ id: webhook.id });
    const fields = withMandatoryFields(webhook.included_fields || getDefaultFields());
    setNewWebhook({
      name: webhook.name,
      url: webhook.url,
      events: (webhook.events || []) as WebhookEventType[],
      included_fields: fields,
      timeout_seconds: webhook.timeout_seconds ?? 10,
      max_retries: webhook.max_retries ?? 3,
      retry_backoff_seconds: webhook.retry_backoff_seconds ?? 5,
      delivery_timeout_seconds: webhook.delivery_timeout_seconds ?? 30,
      max_backoff_seconds: webhook.max_backoff_seconds ?? null,
    });
    setIncludeSensitive(hasSensitiveSelected(fields));
    setFieldSearch("");
    setValidationError(null);
    setIsDialogOpen(true);
  };

  const openDuplicateDialog = (webhook: any) => {
    setEditingWebhook(null);
    const fields = withMandatoryFields(webhook.included_fields || getDefaultFields());
    setNewWebhook({
      name: `${webhook.name} (Copy)`,
      url: webhook.url,
      events: (webhook.events || []) as WebhookEventType[],
      included_fields: fields,
      timeout_seconds: webhook.timeout_seconds ?? 10,
      max_retries: webhook.max_retries ?? 3,
      retry_backoff_seconds: webhook.retry_backoff_seconds ?? 5,
      delivery_timeout_seconds: webhook.delivery_timeout_seconds ?? 30,
      max_backoff_seconds: webhook.max_backoff_seconds ?? null,
    });
    setIncludeSensitive(hasSensitiveSelected(fields));
    setFieldSearch("");
    setValidationError(null);
    setIsDialogOpen(true);
  };



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

  // Field ids valid for the currently selected events (BR-5/BR-14)
  const getAvailableFieldIds = () => {
    const ids = new Set<string>();
    if (newWebhook.events.some((e) => e.startsWith("client."))) {
      ALL_FIELDS.client.forEach((f) => ids.add(f.id));
    }
    if (newWebhook.events.some((e) => e.startsWith("application."))) {
      ALL_FIELDS.visa_application.forEach((f) => ids.add(f.id));
    }
    return ids;
  };

  // BR-14: validate selection before save. Returns the resolved field list or null.
  const resolveAndValidateFields = (): string[] | null => {
    const available = getAvailableFieldIds();
    // Mandatory fields that apply to the selected events
    const requiredMandatory = MANDATORY_FIELD_IDS.filter((id) => available.has(id));
    const resolved = [...new Set([...newWebhook.included_fields, ...requiredMandatory])];

    // Every selected field must exist for the chosen events
    const invalid = resolved.filter((id) => !available.has(id));
    if (invalid.length > 0) {
      setValidationError(`These fields are not valid for the selected events: ${invalid.join(", ")}`);
      return null;
    }
    // Mandatory fields must all be present
    const missing = requiredMandatory.filter((id) => !resolved.includes(id));
    if (missing.length > 0) {
      setValidationError(`Mandatory fields cannot be removed: ${missing.join(", ")}`);
      return null;
    }
    setValidationError(null);
    return resolved;
  };

  // BR-9/AC-6/PERM-3: audit when sensitive fields are saved
  const writeSensitiveAudit = async (fields: string[], webhookId: string | null) => {
    const sensitiveSelected = fields.filter((f) => isSensitiveField(f));
    if (sensitiveSelected.length === 0) return;
    await supabase.from("platform_audit_logs").insert({
      user_id: user?.id ?? null,
      action: "webhook.sensitive_fields_enabled",
      entity_type: "platform_webhook",
      entity_id: webhookId,
      details: {
        webhook_name: newWebhook.name,
        sensitive_fields: sensitiveSelected,
      },
    });
  };

  const createWebhook = useMutation({
    mutationFn: async () => {
      const resolved = resolveAndValidateFields();
      if (!resolved) throw new Error("validation");
      const secretKey = crypto.randomUUID();

      const { data, error } = await supabase.from("platform_webhooks").insert({
        name: newWebhook.name,
        url: newWebhook.url,
        events: newWebhook.events,
        included_fields: resolved,
        timeout_seconds: newWebhook.timeout_seconds,
        max_retries: newWebhook.max_retries,
        retry_backoff_seconds: newWebhook.retry_backoff_seconds,
        delivery_timeout_seconds: newWebhook.delivery_timeout_seconds,
        max_backoff_seconds: newWebhook.max_backoff_seconds,
        secret_key: secretKey,
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;
      await writeSensitiveAudit(resolved, data?.id ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Webhook created successfully");
    },
    onError: (error) => {
      if (error.message === "validation") return;
      toast.error("Failed to create webhook: " + error.message);
    },
  });

  const updateWebhook = useMutation({
    mutationFn: async () => {
      if (!editingWebhook) throw new Error("No webhook selected for editing");
      const resolved = resolveAndValidateFields();
      if (!resolved) throw new Error("validation");

      const { error } = await supabase
        .from("platform_webhooks")
        .update({
          name: newWebhook.name,
          url: newWebhook.url,
          events: newWebhook.events,
          included_fields: resolved,
          timeout_seconds: newWebhook.timeout_seconds,
          max_retries: newWebhook.max_retries,
          retry_backoff_seconds: newWebhook.retry_backoff_seconds,
          delivery_timeout_seconds: newWebhook.delivery_timeout_seconds,
          max_backoff_seconds: newWebhook.max_backoff_seconds,
        })
        .eq("id", editingWebhook.id);
      if (error) throw error;
      await writeSensitiveAudit(resolved, editingWebhook.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Webhook updated successfully");
    },
    onError: (error) => {
      if (error.message === "validation") return;
      toast.error("Failed to update webhook: " + error.message);
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
      setDeletingWebhook(null);
      toast.success("Webhook deleted");
    },
  });

  const toggleAllWebhooks = useMutation({
    mutationFn: async (activate: boolean) => {
      if (!webhooks) return;
      const ids = webhooks.map(w => w.id);
      const { error } = await supabase
        .from("platform_webhooks")
        .update({ is_active: activate })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, activate) => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhooks"] });
      toast.success(activate ? "All webhooks resumed" : "All webhooks paused");
    },
  });

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success("Secret copied to clipboard");
  };

  const handleEventToggle = (eventName: WebhookEventType) => {
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
    const hasApplicationEvents = newWebhook.events.some(e => e.startsWith("application."));
    const categories: Array<{ key: "client" | "visa_application"; label: string }> = [];
    if (hasClientEvents) categories.push({ key: "client", label: "Client Fields" });
    if (hasApplicationEvents) categories.push({ key: "visa_application", label: "Application Fields" });
    return categories;
  };

  // Test webhook mutation
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  
  const testWebhook = useMutation({
    mutationFn: async ({ webhookId, events }: { webhookId: string; events: string[] }) => {
      setTestingWebhookId(webhookId);
      
      // Get the first event type subscribed to use as test
      const testEventType = events[0] || "client.created";
      
      // Generate a sample test payload
      const isClientEvent = testEventType.startsWith("client.");
      const testData = isClientEvent ? {
        client_id: "550e8400-e29b-41d4-a716-446655440000",
        company_id: "123e4567-e89b-12d3-a456-426614174000",
        client_type: "personal",
        first_name: "Test",
        last_name: "Client",
      } : {
        application_id: "660e8400-e29b-41d4-a716-446655440001",
        application_name: "Test Visa Application",
        subclass: "820/801",
        client_id: "550e8400-e29b-41d4-a716-446655440000",
      };
      
      // Call dispatch-webhook with test data
      const response = await supabase.functions.invoke("dispatch-webhook", {
        body: {
          event_type: testEventType,
          data: testData,
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
          <div className="flex items-center gap-4">
            {webhooks && webhooks.length > 0 && (
              <div className="flex items-center gap-2">
                <Label htmlFor="pause-all" className="text-sm text-muted-foreground">
                  {webhooks.some(w => w.is_active) ? "Pause All" : "Resume All"}
                </Label>
                <Switch
                  id="pause-all"
                  checked={webhooks.some(w => w.is_active)}
                  onCheckedChange={(checked) => toggleAllWebhooks.mutate(checked)}
                  disabled={toggleAllWebhooks.isPending}
                />
              </div>
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Webhook
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingWebhook ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
                <DialogDescription>
                  {editingWebhook 
                    ? "Update the webhook configuration" 
                    : "Add a new webhook to send events to external services"}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_retries">Max Retries</Label>
                    <Input
                      id="max_retries"
                      type="number"
                      min={0}
                      max={10}
                      placeholder="3"
                      value={newWebhook.max_retries}
                      onChange={(e) => setNewWebhook((prev) => ({ ...prev, max_retries: parseInt(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Retry attempts on failure (0-10)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retry_backoff">Backoff (seconds)</Label>
                    <Input
                      id="retry_backoff"
                      type="number"
                      min={5}
                      max={60}
                      placeholder="5"
                      value={newWebhook.retry_backoff_seconds}
                      onChange={(e) => setNewWebhook((prev) => ({ ...prev, retry_backoff_seconds: parseInt(e.target.value) || 5 }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wait time between retries (doubles each attempt)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delivery_timeout">Delivery Timeout (seconds)</Label>
                    <Input
                      id="delivery_timeout"
                      type="number"
                      min={1}
                      max={120}
                      placeholder="30"
                      value={newWebhook.delivery_timeout_seconds}
                      onChange={(e) => setNewWebhook((prev) => ({ ...prev, delivery_timeout_seconds: parseInt(e.target.value) || 30 }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Per-attempt request timeout (1-120 seconds)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_backoff">Max Backoff Cap (seconds)</Label>
                    <Input
                      id="max_backoff"
                      type="number"
                      min={1}
                      max={600}
                      placeholder="Optional"
                      value={newWebhook.max_backoff_seconds ?? ""}
                      onChange={(e) => setNewWebhook((prev) => ({
                        ...prev,
                        max_backoff_seconds: e.target.value === "" ? null : (parseInt(e.target.value) || null),
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional upper limit on backoff delay
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => editingWebhook ? updateWebhook.mutate() : createWebhook.mutate()}
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                >
                  {editingWebhook ? "Update Webhook" : "Create Webhook"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
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
                    // Support application.*, visa_application.* and legacy matter.* events
                    const applicationEvents = webhook.events.filter(e => e.startsWith("application.") || e.startsWith("visa_application.") || e.startsWith("matter."));
                    
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
                              <span className="text-xs font-medium text-muted-foreground w-16">Client:</span>
                              {clientEvents.map((event) => (
                                <Badge key={event} variant="secondary" className="text-xs">
                                  {event.split(".")[1]}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {applicationEvents.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-medium text-muted-foreground w-16">Application:</span>
                              {applicationEvents.map((event) => (
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
                            onClick={() => openEditDialog(webhook)}
                            title="Edit webhook"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDuplicateDialog(webhook)}
                            title="Duplicate webhook"
                          >
                            <CopyPlus className="w-4 h-4" />
                          </Button>
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
                            onClick={() => setDeletingWebhook({ id: webhook.id, name: webhook.name })}
                            title="Delete webhook"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingWebhook} onOpenChange={(open) => !open && setDeletingWebhook(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingWebhook?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingWebhook && deleteWebhook.mutate(deletingWebhook.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
