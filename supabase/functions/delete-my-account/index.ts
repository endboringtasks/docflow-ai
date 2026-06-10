import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables scoped by company_id that must be hard-deleted when a company is removed.
// Order matters loosely since there are no enforced FKs; we delete children before parents.
const COMPANY_SCOPED_TABLES = [
  "application_timeline",
  "automation_events",
  "beta_feedback",
  "client_form_data",
  "client_portal_access",
  "document_checklist",
  "document_checklist_templates",
  "document_definitions",
  "notifications",
  "team_invitations",
  "visa_applications",
  "clients",
  "re_data_objects",
  "re_deliverables",
  "re_domain_terms",
  "re_external_systems",
  "re_journeys",
  "re_roles",
  "re_projects",
  "google_drive_connections",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Re-validate identity server-side (BR-2, PERM-2)
    const authClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency (BR-16): if the auth user no longer has a profile and no memberships,
    // treat as already deleted.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    // Find companies the user OWNS (BR-11 cascade)
    const { data: ownerMemberships, error: ownerErr } = await admin
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .eq("role", "owner");

    if (ownerErr) throw ownerErr;

    const ownedCompanyIds = (ownerMemberships ?? []).map((m: any) => m.company_id);
    let companiesDeleted = 0;

    for (const companyId of ownedCompanyIds) {
      // 1. Hard-delete document attachment files from storage (CDR) then rows
      const { data: checklists } = await admin
        .from("document_checklist")
        .select("id")
        .eq("company_id", companyId);

      const checklistIds = (checklists ?? []).map((c: any) => c.id);

      if (checklistIds.length > 0) {
        const { data: attachments } = await admin
          .from("document_attachments")
          .select("id, file_path")
          .in("document_checklist_id", checklistIds);

        const paths = (attachments ?? [])
          .map((a: any) => a.file_path)
          .filter((p: string | null) => !!p && !p.startsWith("drive:"));

        if (paths.length > 0) {
          const { error: storageErr } = await admin.storage
            .from("document-attachments")
            .remove(paths);
          if (storageErr) {
            console.error("Storage deletion error (continuing):", storageErr.message);
          }
        }

        // Delete attachment rows + history scoped to these checklists
        await admin.from("document_attachments").delete().in("document_checklist_id", checklistIds);
        await admin
          .from("document_attachment_history")
          .delete()
          .in("document_checklist_id", checklistIds);
      }

      // 2. Delete all company-scoped rows
      for (const table of COMPANY_SCOPED_TABLES) {
        const { error: delErr } = await admin.from(table).delete().eq("company_id", companyId);
        if (delErr) {
          console.error(`Error deleting from ${table} for company ${companyId}:`, delErr.message);
        }
      }

      // 3. Delete remaining memberships then the company itself
      await admin.from("company_members").delete().eq("company_id", companyId);
      await admin.from("companies").delete().eq("id", companyId);
      companiesDeleted++;
    }

    // 4. Remove user from companies they belong to but don't own
    await admin.from("company_members").delete().eq("user_id", userId);

    // 5. Anonymize audit logs referencing this user (BR-6, BR-14) — keep row + timestamp + action
    await admin
      .from("platform_audit_logs")
      .update({ details: { anonymized: true, reason: "account_deleted" } })
      .eq("user_id", userId);

    // 6. Delete the user's profile (personal data)
    await admin.from("profiles").delete().eq("id", userId);

    // 7. Insert audit event with NO sensitive personal data (BR-13, BR-14)
    await admin.from("platform_audit_logs").insert({
      user_id: userId,
      action: "delete_account",
      entity_type: "user",
      entity_id: userId,
      details: {
        outcome: "success",
        companies_deleted: companiesDeleted,
        self_initiated: true,
        already_deleted: !existingProfile,
      },
    });

    // 8. Delete the auth user — revokes sessions/tokens, blocks future login (BR-10)
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("Auth user deletion error:", authDeleteError.message);
      // Profile/company data already removed; surface error but account is no longer usable
      return new Response(
        JSON.stringify({
          error: "Account data removed but final identity deletion failed. Please contact support.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        companiesDeleted,
        retained: "Operational and audit logs are retained with identifying details removed for compliance.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("delete-my-account error:", error);
    return new Response(
      JSON.stringify({ error: "Account deletion failed. Your account was not deleted. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
