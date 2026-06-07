## DOC-86 — Revoke Client Portal Access Links

### Goal
Let agents see all portal access links for an application and revoke active ones. Revoking is a soft state change (never a hard delete) that immediately stops the link from working and shows an access-denied message in the portal.

### Database changes (migration)

Add soft-revoke columns to `client_portal_access`:
- `status` text NOT NULL DEFAULT `'active'` (values: `active`, `revoked`)
- `revoked_at` timestamptz NULL
- `revoked_by` uuid NULL
- `revoked_reason` text NULL

Update token-validation database functions so a revoked link stops working everywhere. Each currently filters only on `token_expires_at > now()`; add `AND cpa.status <> 'revoked'`:
- `validate_portal_access_token` (primary gate — portal bails here)
- `get_portal_visa_application_details`
- `get_portal_client_details`
- `get_portal_documents`
- `get_document_attachments`
- `update_portal_access_timestamp`
- `submit_portal_access`

No new RLS policies needed — existing "Company members can update portal access" policy already allows the revoke UPDATE. (Note: the table has no DELETE policy, reinforcing soft-delete only.)

### Frontend changes

**`src/pages/migration/ApplicationDetail.tsx`**
1. Add a query to fetch `client_portal_access` rows for `visaApplicationId` (id, email, status, token_expires_at, is_submitted, revoked_at, revoked_reason, created_at, last_accessed_at), ordered newest first.
2. Render a new "Portal Access Links" card/section listing each record with: email, created date, expiry date, and a status badge (Active / Expired / Submitted / Revoked). Expired = `token_expires_at < now()`; Revoked = `status === 'revoked'`.
3. For records that are still **active** (not revoked, not expired), show a "Revoke" button.
4. Clicking Revoke opens an `AlertDialog` confirmation (reuse the existing AlertDialog imports) with an optional revocation reason `Textarea`.
5. On confirm, run a mutation: `update client_portal_access set status='revoked', revoked_at=now(), revoked_by=auth user id, revoked_reason=<reason or null>` where id matches; then invalidate the portal-access query and toast success.
6. Invalidate this query after a new link is generated too (so the list refreshes after InviteClientDialog runs).

**`src/pages/client-portal/ClientPortal.tsx`**
- No structural change required: when a revoked token is opened, `validate_portal_access_token` returns no rows, so the existing error path sets "Invalid or expired access link. Please contact your agent for a new link." To make the message clearer for revoked links, optionally add a lightweight check — but since revoked tokens are indistinguishable from expired ones via the secured RPC, the existing access-denied screen already satisfies "show an access denied message." Keep the existing behavior.

### Verification
- Generate a link, confirm it appears in the new Portal Access Links list as Active.
- Open the link in the portal → access granted.
- Revoke it (with confirmation + optional reason) → row updates to `status='revoked'`, `revoked_at`/`revoked_by` set, record still present (no delete).
- Reload the portal link → access denied screen shown.
- List shows the link as Revoked with the Revoke action gone.

### Notes
- Revoke is soft only; the row is retained for audit.
- `revoked_by` is set from the authenticated agent's user id client-side.
