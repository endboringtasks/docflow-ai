## User Management (DOC-60) — gap completion

The admin User Management feature is largely already built and satisfies most of the spec:
- Admin-only route (`AdminProtectedRoute`) and server-side admin check in the `admin-delete-user` edge function (BR-4, PERM-1/2/3)
- User list with name, email, companies, role, joined date + search (BR-5, UI-1, UI-2, AC-2, AC-3)
- Delete via `admin-delete-user` edge function, which removes `auth.users`, writes a `platform_audit_logs` audit event, blocks self-deletion and admin-deletion (BR-6/7/8/11/12, PF-3)
- Confirmation modal + success/error toasts, user unchanged on failure (BR-10/13, UI-9/11)
- Empty state "No users found" (UI-5)

### Gaps to close (frontend only, `src/pages/admin/Users.tsx`)

1. **Filters (UI-3)** — add two dropdowns above the table:
   - Role filter: All / Super Admin / Standard User
   - Company filter: All + each company the loaded users belong to
   Combined with the existing search box, filtering happens client-side on the already-loaded list.

2. **User detail view (PF-2, UI-6/7/8)** — make a row open a slide-over (`Sheet`):
   - Header with identity: display name, email, role badge, joined date (UI-6)
   - "Company memberships" section listing company name + role per membership (UI-7)
   - Danger-styled "Delete user" button that reuses the existing delete confirmation + mutation (UI-8); hidden for the current admin and for other Super Admins (BR-12 + existing policy)

3. **Status presentation (BR-3/5 caveat "if those concepts exist")** — the data model has no per-user/membership status column, and adding one is out of scope (role/permission redesign is explicitly excluded). Status will be represented by the existing Role badge (Super Admin / Standard User); no schema change.

### Not changing
- No database migrations, no edge function changes — backend already meets BR-6..14 and PERM rules.

### Result
Admins get role + company filters and a dedicated user detail slide-over with memberships and a safe, audited delete action, completing the DOC-60 acceptance criteria that aren't already met.