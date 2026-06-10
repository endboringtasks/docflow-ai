# DOC-5 — Company Switching: Compliance Build

## Current state
The core switching mechanism already exists:
- `CompanySwitcher.tsx` renders a sidebar dropdown listing all memberships and calls `switchCompany`.
- `useCompany.tsx` loads memberships from `company_members`, persists the active company in `localStorage`, and exposes `switchCompany`.
- Server-side isolation (BR-7/BR-8/PERM-3) is already enforced: company-scoped queries pass `currentCompany.id` and RLS (`is_company_member`, `is_company_admin_or_owner`) blocks cross-company access.
- Data reload (BR-9/BR-10/AC-3) largely works because page queries are keyed on `currentCompany?.id` (e.g. `["clients", currentCompany?.id]`), so changing the active company refetches automatically.

## Gaps vs spec
1. **BR-1 / BR-2 / AC-2 / TC-3** — Switcher is always rendered, even for single-company users. It must show a non-interactive company label (no dropdown) when memberships < 2.
2. **UI-5** — No loading state while switching.
3. **BR-11 / UI-8 / AC-5 / TC-4** — No error handling; a failed switch should keep the previous company and show an error toast.
4. **UI-7** — No "Switched to {Company}" success toast.
5. **BR-6 / PERM-2 / AC-4 / TC-5** — Client-side membership re-validation before switching (server already enforces, but UI should reject unknown company ids defensively).
6. **BR-9 / BR-10** — Make reload explicit/robust by clearing react-query cache on switch instead of relying solely on query-key changes.
7. **BR-12** — On load, if the stored active company is no longer in the user's memberships, fall back to a valid default and notify the user.

## Changes

### 1. `src/hooks/useCompany.tsx`
- Make `switchCompany(companyId)` `async` and return `{ error }`:
  - Validate `companyId` exists in `companies` (memberships). If not, return an error (BR-6/PERM-2).
  - On success: set current company/role, persist to `localStorage`, and clear company-scoped cached data.
  - On failure: leave current company unchanged and return the error (BR-11).
- Add a `switching` boolean to context for the loading state (UI-5).
- In `fetchCompanies`, when the stored `currentCompanyId` is no longer among memberships but other memberships exist, select the first membership as default and surface a one-time flag so the UI can notify the user (BR-12).
- Accept an injected `queryClient` (via `useQueryClient`) so switching can call `queryClient.clear()` / invalidate company-scoped queries (BR-9/BR-10). `CompanyProvider` already lives under the react-query provider.

### 2. `src/components/CompanySwitcher.tsx`
- **Single-company (BR-2/AC-2):** when `companies.length < 2`, render a static, non-clickable company identity block (name + role + building icon) — no dropdown trigger.
- **Multi-company:** keep dropdown; on select:
  - Show loading state (UI-5): disable trigger, swap chevron for a spinner while `switching`.
  - `await switchCompany(...)`. On success → success toast "Switched to {Company Name}" (UI-7) then navigate to the niche dashboard. On error → error toast and keep the dropdown on the previous company (UI-8/BR-11).
- Keep current-company checkmark and name display (UI-2/UI-3).
- Use the existing `sonner` toast (`@/components/ui/sonner` / `toast`).

### 3. BR-12 notification
- In `useCompany`, expose a transient flag (e.g. `defaultCompanyReselected`) set when the stored company was dropped; a small effect in `CompanySwitcher` (or `AppLayout`) fires an info toast "Your previous workspace is no longer available. Switched to {Company Name}." once.

## Out of scope (per spec)
Joining/leaving companies, company creation, per-feature context overrides. The "Create new company" item already in the dropdown stays as-is.

## Verification
- Single-company account → no dropdown, just a static company label (AC-2/TC-3).
- Multi-company account → dropdown visible with current name (AC-1/TC-1).
- Switch A→B → spinner shows, success toast, all screens reload for B (AC-3/TC-2).
- Force a switch failure → error toast, stays on A (AC-5/TC-4).
- Cross-company access remains blocked by RLS (AC-4/TC-5) — no code change needed, confirmed by existing policies.
