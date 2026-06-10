# DOC-84 — Account Settings: Client-Initiated Account Deletion

Lets an authenticated user permanently delete their own account and all data they own, with a strict two-step confirmation, server-side identity validation, an audit trail, and forced sign-out. (Client-portal users are token-based, not auth accounts, so this applies to authenticated platform users — the only real "accounts".)

## Decisions (confirmed)
- Owner cascade: deleting an account hard-deletes every company the user OWNS and all that company's data (clients, applications, documents, files).
- Personal data: hard-delete the user's profile + auth user; keep audit/operational logs but strip identifying fields (anonymize).
- Secondary confirmation: user must type `DELETE`.

## What the user sees
1. In **Settings**, a new **Danger Zone** card (red styling), separated from normal settings, with a **Delete My Account** button (UI-1, UI-2).
2. Clicking it opens a confirmation modal (UI-3, UI-4):
   - Clear irreversible-action warning.
   - Plain-language list of what will be deleted vs retained (BR-9, AC-5): "Your profile and login will be permanently deleted. Companies you own — including their clients, applications, and documents — will be permanently removed. Operational and audit logs are kept but stripped of your identifying details for compliance."
   - A text input requiring the user to type `DELETE`.
   - **Delete My Account** confirm button disabled until `DELETE` is typed exactly (UI-5, UI-6, AC-3); a clearly available **Cancel** (UI-7).
3. On confirm: spinner while the server works.
   - Success → user is signed out and redirected to a "Your account has been deleted" confirmation state, then to the auth page (UI-8, UI-9, AC-4, TC-3).
   - Failure → friendly inline error with retry / contact-support guidance; account stays usable (UI-10, UI-11, AC-6, TC-5).

## Ownership warning (safety)
Before showing the destructive modal, fetch the user's owned companies (where `company_members.role = 'owner'`). If any exist, the modal explicitly lists each company name and a count of clients/applications that will be destroyed, so the impact is unmistakable.

## Backend — `delete-my-account` edge function
A new edge function performs all deletion server-side after re-validating the caller's JWT (BR-1, BR-2, PERM-1, PERM-2). It uses the service-role client for cascading writes. Steps:

1. Validate `Authorization` header → resolve `auth.getUser`; reject if missing/invalid.
2. Capture the user's email/display_name (for the audit entry) then immediately drop them from memory after hashing-free redaction.
3. Find companies where the user is `owner`. For each owned company, hard-delete in dependency order:
   - List `document_attachments` for the company's checklists → delete their objects from the `document-attachments` storage bucket (CDR hard delete), then delete the rows.
   - Best-effort Google Drive cleanup per existing pattern (detach/delete company connection records); failures are logged but don't block (BR-12, best-effort).
   - Delete company-scoped rows across all company_id tables: `application_timeline, automation_events, beta_feedback, client_form_data, client_portal_access, clients, document_checklist, document_checklist_templates, document_definitions, google_drive_connections, notifications, team_invitations, visa_applications, re_* tables, company_members`, then the `companies` row.
4. Remove the user from companies they're a member of (non-owner): delete their `company_members` rows.
5. Anonymize logs (BR-6, BR-7, BR-14): `UPDATE platform_audit_logs` rows where `user_id` = caller — null/redact identifying `details` fields; keep the row + timestamp + action.
6. Delete the user's `profiles` row.
7. Insert an audit event: `action='delete_account'`, `entity_type='user'`, `entity_id=user.id`, `details` containing only non-sensitive outcome data (companies_deleted count, outcome) — never plaintext personal data (BR-13, BR-14, AC-4).
8. `auth.admin.deleteUser(user.id)` — revokes sessions/tokens and blocks future login under that identity (BR-10, TC-3).
9. Return `{ success: true, companiesDeleted, retained }`. The function is wrapped so a mid-way failure returns a clear error and avoids leaving a half-deleted, login-able account (BR-15); calling again when already deleted returns an "already deleted" style success (BR-16, idempotent).

Reuses existing patterns from `admin-delete-user` (service-role client, audit insert) but scoped to self-deletion with full cascade.

## Frontend wiring
- New `DeleteAccountCard` component (in `src/components/settings/`) rendered at the bottom of `src/pages/Settings.tsx`.
- New `DeleteAccountDialog` using the existing `AlertDialog`/`Dialog` + `Input` components, type-`DELETE` gate, loading + error states.
- On success: call `supabase.functions.invoke('delete-my-account')`, then `signOut()` from `useAuth`, clear query cache, and navigate to `/auth` with a deleted-confirmation toast/state.

## Technical notes
- Public schema has **no enforced foreign keys**, so every dependent table must be deleted explicitly in the function — relying on DB cascade will orphan data.
- Owner detection via `company_members.role='owner'`; company ownership also recorded in `companies.created_by`.
- Storage bucket `document-attachments` is private; deletion uses the service-role client.
- No new tables required; only the new edge function. `supabase/config.toml` gets the function entry (JWT validated in-code).

## Out of scope
Admin-initiated deletion (already exists), DSAR data export, and legal-hold workflows.
