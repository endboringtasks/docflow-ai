## User Impersonation (DOC-61)

### Current state vs. spec
A working impersonation flow already exists and covers most of DOC-61:
- **Start** (`supabase/functions/admin-impersonate`, `useImpersonation.startImpersonation`, confirm dialog in `Admin → Users`) — validates platform admin server-side, generates a temporary magic-link token, switches session, and writes a start audit log. Covers PF-1, UI-1/2/8, AC-1/2, BR-1/2/3/5/10.
- **Banner** (`ImpersonationBanner`) — persistent on every page, warning styling, shows target name/email + an End action + TTL countdown. Covers BR-6/7, UI-3/4/5.
- **End** (`useImpersonation.endImpersonation`) — restores the original admin session and toasts. Covers PF-3, UI-6.

### Gaps to close
1. **BR-11 — End impersonation is not audited.** Ending is currently client-only; no `platform_audit_logs` record is written.
2. **BR-12 — Failed starts are not audited.** When the edge function rejects (not super admin, self-target, target missing, token-gen failure) it returns an error without writing a failure audit record.
3. **PF-2 dual attribution** — start log should clearly record actor (admin) + effective user (target); end log should mirror this.
4. **UI-7 / BR-7 polish** — end toast should read "Impersonation ended"; banner can optionally show "Started by {admin}".

No database schema changes are needed — `platform_audit_logs` already has `user_id`, `action`, `entity_type`, `entity_id`, `details (jsonb)`.

### Plan

**1. Audit failed + successful starts (`supabase/functions/admin-impersonate/index.ts`)**
- Add a small `logAudit(action, targetId, details)` helper using the service-role client.
- Write `impersonate_start_failed` records (with `reason`) before returning on: caller not a platform admin (PERM-1/BR-2), self-impersonation, target profile not found (BR-13), and magic-link generation failure (BR-14, without changing session).
- Keep the existing success log but standardize it to `action = "impersonate_start"` with `details` carrying dual attribution: `{ admin_id, admin_email, target_id, target_email, target_name }`.

**2. New end-impersonation audit function (`supabase/functions/admin-end-impersonation/index.ts`)**
- Accepts `{ targetUserId }` and authenticates using the **original admin** access token (passed by the client before the session is restored), validates platform-admin membership server-side, and writes an `impersonate_end` audit record with dual attribution. Best-effort: failures here never block the user from exiting impersonation.

**3. Wire end logging into the hook (`src/hooks/useImpersonation.tsx`)**
- Before restoring the admin session in `endImpersonation`, fire a best-effort call to `admin-end-impersonation` using the stored original admin token and the impersonated target id (wrapped in try/catch so it never blocks the restore).
- Store the initiating admin's email/name (returned from the start function) in localStorage so it can be shown in the banner.
- Change the end toast copy to **"Impersonation ended"** (UI-7).

**4. Return + surface admin identity**
- `admin-impersonate` already knows `callingUser`; include `admin: { id, email, display_name }` in its success response so the hook can persist it.
- `ImpersonationBanner` (`src/components/admin/ImpersonationBanner.tsx`) — optionally render "Started by {admin name}" alongside the existing target identity (UI-4, optional item).

### Out of scope (per spec)
- BR-9 sensitive-action blocking (payment/password/security) is marked "recommended" and is not part of this story; left unchanged.
- Configurable server-side TTL (BR-4) stays as the current client-enforced 1-hour timeout.

### Technical notes
- Edge functions deploy automatically; both use the service-role client internally and the standard CORS pattern. No secrets needed beyond the existing `SUPABASE_*` envs.
- Files touched: `supabase/functions/admin-impersonate/index.ts` (edit), `supabase/functions/admin-end-impersonation/index.ts` (new), `src/hooks/useImpersonation.tsx` (edit), `src/components/admin/ImpersonationBanner.tsx` (edit).
