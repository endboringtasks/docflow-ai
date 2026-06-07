## Fix: Regenerated portal link inherits revoked status

### Problem
`InviteClientDialog` reuses (updates) the existing `client_portal_access` row for an application+client when generating a new link. After a link is revoked, regenerating sets a new `access_token` and `token_expires_at`, but leaves `status = 'revoked'` (plus `revoked_at`/`revoked_by`/`revoked_reason`). Since `validate_portal_access_token` and the other portal RPCs filter out revoked rows, the brand-new link is treated as invalid and the client sees an "expired/invalid" access message.

Confirmed in DB: the affected record has a future expiry but `status = 'revoked'`.

### Fix (frontend only)
In `src/components/visa-application/InviteClientDialog.tsx`, the existing-record update branch (`generateAccessLink`) must reset the revoke fields so a regenerated link is active again:
- `status: 'active'`
- `revoked_at: null`
- `revoked_by: null`
- `revoked_reason: null`

(in addition to the token/expiry/is_submitted/submitted_at fields it already updates).

### Verification
- Revoke a link → record `status = 'revoked'`.
- Generate a new link for the same application/client → record flips back to `status = 'active'` with the new token/expiry; revoke fields cleared.
- Open the new link → portal grants access (no longer "expired").
- The Portal Access Links list on Application Detail shows the link as Active again.

### Notes
No database or RPC changes needed — this is purely the regenerate path failing to clear revoke state.
