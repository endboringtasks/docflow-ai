# DOC-52 — Webhook Payload Field Selection

## Audit: what already exists

The per-webhook allowlist mechanism is already built and satisfies several rules:

- **BR-1 (scope):** selection is stored per webhook subscription (`platform_webhooks.included_fields`). We keep this per-subscription model.
- **BR-3 (allowlist):** `filterPayloadData()` in `dispatch-webhook` includes only selected fields.
- **BR-4 / BR-5:** each event type has a defined field schema (`ALL_FIELDS`); only those fields are selectable.
- **BR-10:** payload is built from canonical/hydrated event data, then filtered.
- **BR-12:** changes apply to future deliveries only.
- **UI-1 / UI-6:** event/field selectors + Save/Cancel exist.
- **PERM-1 / AC-1:** the page is already behind the platform-admin route guard.

## Gaps to close

```text
BR-6 / BR-7 / AC-4 / TC-2   mandatory fields not locked; can be deselected
BR-8                         sensitive PII fields included by default, no gating toggle
BR-9 / AC-6 / TC-4 / PERM-3  no audit event when sensitive fields enabled
BR-13                        mandatory fields not force-included server-side
BR-14 / UI-7                 no save validation / inline messages
UI-2                         no Mandatory / Sensitive badges
UI-3                         no field search/filter
UI-4                         no "select all non-sensitive" shortcut
UI-5                         no warning callout for sensitive fields
UI-8                         no payload preview panel
```

## Field classification (decided)

Applied to fields that exist in the current payload schema:

- **Mandatory (locked, always sent):**
  - Envelope (always present, not in the field list): `event_id`, `event_type` (`event`), `timestamp`.
  - Client data: `client_id` (resource_id), `company_id`/`organization_id`, `created_at`.
  - Application data: `application_id` (resource_id), `company_id`/`organization_id`, `created_at`.
- **Sensitive (excluded by default, gated):** `first_name`, `last_name`, `company_name`, `email`, `phone`.
- **Optional (default on):** all remaining fields (`client_type`, `folder` ids/status, `subclass`, `status`, etc.).

The broader compliance list (passport, DOB, address, visa/immigration history, financial, health, biometric, etc.) is captured as a documented sensitivity taxonomy in the field metadata so that any future payload fields are classified correctly; today none of those map to existing payload fields.

## Changes

### 1. Field metadata — `src/types/webhook.types.ts`
Extend `WebhookFieldDefinition` with optional `mandatory?: boolean` and `sensitive?: boolean`. No breaking changes.

### 2. Admin UI — `src/pages/admin/Webhooks.tsx`
- Add `mandatory` / `sensitive` flags to the `ALL_FIELDS` definitions per the classification above; flip sensitive fields' `default` to `false`.
- `getDefaultFields()`: include mandatory + non-sensitive defaults; never include sensitive by default.
- Field list (rebuilt as a checkbox list, keeping current styling):
  - **UI-2:** "Mandatory" badge on locked fields (checkbox checked + disabled); "Sensitive" badge on PII fields.
  - **UI-3:** search input filtering fields by label/description.
  - **UI-4:** "Select all non-sensitive" shortcut button per category.
  - **UI-5:** an "Include sensitive fields" toggle; enabling it reveals a destructive warning callout. Sensitive checkboxes are disabled until the toggle is on.
  - **UI-7:** inline validation messages.
- `handleFieldToggle`: ignore toggles on mandatory fields (**AC-4 / TC-2**).
- **BR-14 validation** before create/update: ensure all mandatory fields present and every selected field exists for the chosen events; block save with inline error otherwise. Always re-inject mandatory fields into `included_fields` on save (**BR-7 / BR-13**).
- **BR-9 / AC-6:** when saving with one or more sensitive fields selected, write a `platform_audit_logs` row (`action: 'webhook.sensitive_fields_enabled'`, `entity_type: 'platform_webhook'`, `entity_id`, `details: { fields, webhook_name }`) via the existing client.
- **UI-8 preview:** add a payload preview panel rendering sample JSON (envelope + filtered sample data) that updates live as fields toggle.

### 3. Edge function — `supabase/functions/dispatch-webhook/index.ts`
- Define the mandatory field set server-side. In `filterPayloadData()`, after applying the allowlist, **force-include mandatory fields** (`resource_id`, `organization_id`, `created_at`) and never drop them even if `included_fields` omits them (**BR-7 / BR-13 / AC-5**).
- Envelope already carries `event`, `event_id`, `timestamp` — keep as-is.
- Safe fallback (**BR-15**): if `included_fields` is null/empty, keep current behaviour (send all canonical fields).

### 4. Database
No schema change required — `included_fields` and `platform_audit_logs` already exist. Audit rows are written via the data API (insert), not a migration.

## Technical notes
- Scope stays **per-subscription** (existing model); no global-default layer added, consistent with BR-1's "choose one".
- Mandatory enforcement is duplicated client-side (UX) and server-side (guarantee) so a stale/manual config can never strip required fields.
- Sensitive gating is purely additive: existing webhooks keep their saved `included_fields`; the default for *new* webhooks excludes PII.

## Verification
- **TC-2/AC-4:** mandatory checkboxes are disabled; toggle attempts are ignored.
- **TC-3/AC-5:** select a minimal optional set → delivered payload (via Test button + `WebhookMonitoring`) contains only mandatory + selected fields.
- **TC-4/AC-6:** enabling a sensitive field shows the warning and writes an audit row on save.
- **TC-5/UI-8:** toggling fields updates the preview JSON live.
- **BR-14:** removing a required selection or selecting an invalid field blocks save with an inline message.
