import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ConfigParam {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  unit: string;
}

const CONFIG_PARAMS: ConfigParam[] = [
  { key: "upload_max_file_size_mb", label: "Max File Size", description: "Maximum upload size", min: 1, max: 100, unit: "MB" },
  { key: "upload_signed_url_expiry_seconds", label: "Signed URL Expiry", description: "How long upload URLs remain valid", min: 60, max: 3600, unit: "seconds" },
  { key: "upload_rate_limit_ip", label: "Rate Limit (IP)", description: "Max requests per IP per 5 min", min: 5, max: 500, unit: "requests" },
  { key: "upload_rate_limit_token", label: "Rate Limit (Token)", description: "Max requests per token per 5 min", min: 1, max: 100, unit: "requests" },
  { key: "sync_batch_size", label: "Sync Batch Size", description: "Attachments processed per sync run", min: 1, max: 50, unit: "items" },
  { key: "sync_max_attempts", label: "Max Sync Retries", description: "Retry attempts before giving up", min: 1, max: 20, unit: "attempts" },
  { key: "storage_retention_days", label: "Storage Retention", description: "Days to keep files after Drive sync", min: 1, max: 365, unit: "days" },
];

export function UploadSyncConfigCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-upload-sync-config"],
    queryFn: async () => {
      const keys = CONFIG_PARAMS.map((p) => p.key);
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", keys);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data || []) {
        const val = (row.value as any)?.value;
        if (val !== undefined) map[row.key] = Number(val);
      }
      return map;
    },
  });

  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {};
      for (const p of CONFIG_PARAMS) {
        vals[p.key] = String(settings[p.key] ?? "");
      }
      setLocalValues(vals);
      setDirty(new Set());
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const numVal = Number(localValues[key]);
      const param = CONFIG_PARAMS.find((p) => p.key === key)!;
      if (isNaN(numVal) || numVal < param.min || numVal > param.max) {
        throw new Error(`Value must be between ${param.min} and ${param.max}`);
      }
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: { value: numVal } as any, updated_by: user?.id })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: ["admin-upload-sync-config"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.success("Setting saved");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const saveAll = async () => {
    for (const key of dirty) {
      await saveMutation.mutateAsync(key);
    }
  };

  const handleChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set(prev).add(key));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              File Upload & Sync Configuration
            </CardTitle>
            <CardDescription>
              Adjust upload limits, rate limiting, and sync parameters
            </CardDescription>
          </div>
          {dirty.size > 0 && (
            <Button size="sm" onClick={saveAll} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes ({dirty.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIG_PARAMS.map((param) => (
              <div key={param.key} className="space-y-1.5">
                <Label htmlFor={param.key} className="text-sm font-medium">
                  {param.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={param.key}
                    type="number"
                    min={param.min}
                    max={param.max}
                    value={localValues[param.key] ?? ""}
                    onChange={(e) => handleChange(param.key, e.target.value)}
                    className="w-full"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {param.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{param.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
