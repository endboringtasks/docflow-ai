import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NICHES = ["migration", "audit", "hr"];
const PLANS = ["free", "basic", "pro", "enterprise"];
const STATUSES = ["active", "trialing", "past_due", "canceled", "incomplete"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No authorization header" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify platform admin (BR-2 / PERM-1)
    const { data: adminRecord } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!adminRecord) {
      return json({ error: "Forbidden: platform admin access required" }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request body" }, 400);
    }

    const { companyId, updates, expectedUpdatedAt } = body as {
      companyId?: string;
      updates?: Record<string, unknown>;
      expectedUpdatedAt?: string;
    };

    if (!companyId || typeof companyId !== "string") {
      return json({ error: "companyId is required" }, 400);
    }
    if (!updates || typeof updates !== "object") {
      return json({ error: "updates object is required" }, 400);
    }

    // Validate fields (BR-8). Reject unknown/read-only fields.
    const allowedFields = ["name", "niche", "subscription_plan", "subscription_status"];
    const sanitized: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const key of Object.keys(updates)) {
      if (!allowedFields.includes(key)) {
        return json({ error: `Field "${key}" is not editable` }, 400);
      }
    }

    if ("name" in updates) {
      const name = typeof updates.name === "string" ? updates.name.trim() : "";
      if (!name) errors.name = "Name is required";
      else if (name.length > 120) errors.name = "Name must be 120 characters or fewer";
      else sanitized.name = name;
    }
    if ("niche" in updates) {
      if (!NICHES.includes(updates.niche as string)) errors.niche = "Invalid niche";
      else sanitized.niche = updates.niche;
    }
    if ("subscription_plan" in updates) {
      if (!PLANS.includes(updates.subscription_plan as string)) errors.subscription_plan = "Invalid plan";
      else sanitized.subscription_plan = updates.subscription_plan;
    }
    if ("subscription_status" in updates) {
      const status = updates.subscription_status as string;
      if (status && !STATUSES.includes(status)) errors.subscription_status = "Invalid status";
      else sanitized.subscription_status = status || null;
    }

    if (Object.keys(errors).length > 0) {
      return json({ error: "Validation failed", fieldErrors: errors }, 400);
    }
    if (Object.keys(sanitized).length === 0) {
      return json({ error: "No valid fields to update" }, 400);
    }

    // Load current row (BR-14)
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) {
      return json({ error: "Company not found" }, 404);
    }

    // Optimistic locking (BR-12)
    if (expectedUpdatedAt && current.updated_at && current.updated_at !== expectedUpdatedAt) {
      return json({ error: "conflict", message: "Company was modified by someone else" }, 409);
    }

    // Compute changed fields
    const changedFields: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sanitized)) {
      if (current[key] !== value) {
        changedFields.push(key);
        before[key] = current[key];
        after[key] = value;
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("companies")
      .update({ ...sanitized, updated_by: caller.id })
      .eq("id", companyId)
      .select("*")
      .single();

    if (updateError) {
      // BR-13: atomic update, surface error
      try {
        await supabaseAdmin.from("platform_audit_logs").insert({
          user_id: caller.id,
          action: "company.update",
          entity_type: "company",
          entity_id: companyId,
          details: { changed_fields: changedFields, before, after, outcome: "failure", error: updateError.message },
        });
      } catch (_) { /* best effort */ }
      throw updateError;
    }

    // Audit log (BR-10/BR-11/PERM-3)
    try {
      await supabaseAdmin.from("platform_audit_logs").insert({
        user_id: caller.id,
        action: "company.update",
        entity_type: "company",
        entity_id: companyId,
        details: { changed_fields: changedFields, before, after, outcome: "success" },
      });
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }

    return json({ company: updated });
  } catch (e) {
    console.error("admin-update-company error:", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
