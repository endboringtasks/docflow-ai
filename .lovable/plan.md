# DOC-59 — Company Management

Most of the admin Companies surface already exists (`src/pages/admin/Companies.tsx` list + `src/pages/admin/CompanyDetail.tsx` detail sheet with members, settings, plan inline-edit, drive, audit-log link). This plan closes the remaining BDD gaps: an explicit **edit form with validation**, **server-side authorization + audit + `updated_by`/`updated_at`** (BR-2, BR-7..BR-11, PERM-1/3), list **filters/pagination/empty state** (UI-3/4/5), and **company-not-found** handling (BR-14).

## 1. Database migration
- Add to `public.companies`:
  - `updated_at timestamptz not null default now()`
  - `updated_by uuid` (nullable; references the actor)
- Add trigger `set_updated_at` using existing `public.update_updated_at_column()` on `companies` so `updated_at` always refreshes on UPDATE.
- No new table needed for audit — reuse existing `public.platform_audit_logs` (`user_id`, `action`, `entity_type`, `entity_id`, `details`).
- No grant changes (columns added to an existing table).

## 2. Edge function: `admin-update-company` (server-side authority)
New function `supabase/functions/admin-update-company/index.ts`, following the `admin-impersonate` pattern:
- Verify `Authorization` header → resolve caller via anon client.
- Confirm caller is in `platform_admins` (BR-2/PERM-1); else 403.
- Accept body `{ companyId, updates: { name?, niche?, subscription_plan?, subscription_status? }, expectedUpdatedAt? }`.
- **Validate** (BR-8): `name` non-empty trimmed ≤ 120 chars; `niche` ∈ `migration|audit|hr`; `subscription_plan` ∈ `free|basic|pro|enterprise`; reject unknown/read-only fields (id, created_at, created_by).
- **Optimistic locking** (BR-12): if `expectedUpdatedAt` provided and differs from current `updated_at`, return 409 conflict.
- Fetch current row, apply update via service-role client setting `updated_by = caller.id` (trigger sets `updated_at`).
- Write a `platform_audit_logs` row: `action="company.update"`, `entity_type="company"`, `entity_id=companyId`, `details={ changed_fields, before, after, outcome }` (BR-10/BR-11, PERM-3). Best-effort, logged on failure.
- Return updated company JSON; on DB error return 4xx/5xx with message (BR-13 — single atomic update, no partial writes).

## 3. CompanyDetail.tsx — edit form (UI-9/10/11/12)
- Add an **Edit** button in the sheet header toggling an edit mode.
- Edit form fields: `name` (Input), `niche` (Select: migration/audit/hr), `subscription_plan` (Select), `subscription_status` (Select/Input). `id` and `created_at` shown read-only (BR-9).
- Client-side validation mirroring the function (required name, valid enums) with inline messages; **Save** disabled until valid.
- **Save** calls `supabase.functions.invoke("admin-update-company", { body, headers: Authorization })`, passing `expectedUpdatedAt` from the loaded record. On success: toast success, invalidate `admin-company-detail`, `admin-companies`, exit edit mode (BR-13/UI-12). On 409: toast "Company was modified by someone else, please reload". On error: toast error, keep form.
- Replace the current standalone inline plan `Select` so plan edits also flow through the audited function (remove direct client-side `updatePlanMutation` table write).
- **Not found** (BR-14): when `!companyLoading && !company`, render a "Company not found" message instead of the detail body.

## 4. Companies.tsx — filters, pagination, empty state
- **Filters (UI-3):** add `Select` controls for Plan (`all|free|basic|pro|enterprise`), Status (`all|active|...`), and Niche (`all|migration|audit|hr`) next to the existing name search. Combine with the existing name filter.
- **Pagination (UI-4):** reuse the established pattern (PAGE_SIZE = 10, `page` state, `totalPages`, `pagedCompanies` slice, reset to page 1 on search/filter change, clamp page). Render shadcn `Pagination` (Previous / "Page X of Y" / Next) below the table, shown only when filtered count > PAGE_SIZE.
- **Empty state (UI-5):** keep existing "No companies found" row; ensure it shows when filters yield zero.
- Member count column already present; document its definition as **all `company_members` rows** (BR-5) via a header tooltip/comment.

## 5. Verification
- As platform admin: edit a company name + niche → values persist, `updated_at`/`updated_by` set, a `platform_audit_logs` row appears, success toast.
- Clear name → client + server validation block save (TC-4/AC-5).
- Filter by plan/niche/status and paginate a >10 company list; empty state shows on no matches.
- Open a non-existent company id → "Company not found".
- Non-admin invoking `admin-update-company` → 403 (AC-1/TC-5).

## Technical notes
- `companies` enums: `niche_type` = migration|audit|hr; `subscription_plan` = free|basic|pro|enterprise.
- Audit + `updated_by` require the edge function because the browser must not be trusted to set actor/audit fields (PERM-3); RLS still governs read access.
- `supabase/config.toml` gets a `[functions.admin-update-company]` entry (verify_jwt default true is fine; we re-check platform admin inside).
