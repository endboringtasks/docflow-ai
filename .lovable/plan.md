# DOC-6: Invite Team Members — Completion Plan

Most of this story is already implemented in `src/components/settings/TeamMembers.tsx` (invite form, role select, owner/admin-only invite button, pending list, duplicate guard via DB). This plan closes the remaining acceptance-criteria gaps.

## Gaps vs. acceptance criteria

1. **Cancel Invitation** — Spec: cancelling sets status to `cancelled`. Current code hard-deletes the row. ❌
2. **Existing Member** — Spec: inviting an email that already belongs to an active member must show an error. Currently not checked. ❌
3. **Re-invite after cancel** — The table has `UNIQUE (company_id, email)` across all statuses, so once a row is soft-cancelled, the same email can never be invited again. Needs to scope uniqueness to `pending`. ❌
4. **Cancelled Invitation Cannot Be Accepted** — Already satisfied: both `accept_pending_invitations` functions only act on `status = 'pending'`. ✅
5. Send / Select role / Permission restriction / Pending visibility / Duplicate (pending) — already satisfied. ✅

## Changes

### 1. Database migration
- Drop the full unique constraint `team_invitations_company_id_email_key`.
- Add a partial unique index so only one *pending* invite per email/company is allowed:
  `CREATE UNIQUE INDEX team_invitations_pending_unique ON team_invitations (company_id, email) WHERE status = 'pending';`

This keeps the duplicate-pending guard while allowing a previously cancelled/accepted email to be re-invited.

### 2. `TeamMembers.tsx` — invite flow (`handleInvite`)
- Before inserting, check the already-loaded `members` list: if the normalized email matches an active member's email, show `"This person is already a team member"` and stop.
- Replace the plain `insert` with logic that handles a pre-existing non-pending row for the same `(company_id, email)`:
  - Query for any existing invitation for this company+email.
  - If one exists with status `pending` → show "already been invited" error.
  - If one exists with another status (`cancelled`/`accepted`) → update it back to `status: 'pending'`, new role, new `invited_by`.
  - Otherwise → insert a new row.
- Keep the `23505` fallback toast as a safety net for the partial unique index.

### 3. `TeamMembers.tsx` — cancel flow (`handleCancelInvitation`)
- Replace the `.delete()` with `.update({ status: 'cancelled' })` on the invitation id (the existing UPDATE RLS policy already allows admins/owners).
- Add a confirmation `AlertDialog` around the cancel button (matching the existing remove-member confirmation pattern), since cancellation is a state-changing action.

### 4. Pending list query
- No change needed: it already filters `status = 'pending'`, so cancelled invites correctly disappear from the list.

## Verification
- Invite a new email → row created `pending`, appears in list.
- Invite the same pending email again → error, no duplicate.
- Invite an email matching an active member → error.
- Cancel a pending invite (with confirmation) → status `cancelled`, removed from list, not deleted.
- Re-invite the cancelled email → succeeds (row flips back to `pending`).
- Sign up with a cancelled email → not auto-added (accept RPC ignores non-pending).
- Member/guest user → no invite form/button visible.

## Technical notes
- Roles enum already excludes inviting as `owner` (INSERT policy blocks `role = 'owner'`); the invite UI only offers Admin/Member/Guest.
- All status values used: `pending`, `accepted`, `cancelled` (text column, no enum change required).
