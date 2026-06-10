# DOC-8 — Protected Route Guard

## Current state (audit)

- `ProtectedRoute` already checks auth, shows a loading spinner, and redirects unauthenticated users to `/auth` — covering BR-2/BR-3/BR-4/BR-5/UI-1/UI-2/UI-3/AC-2/AC-3.
- **Gap:** it passes the original location via React Router `state={{ from }}` instead of a `returnTo` query param, and the `Auth` page **never reads it** — after login it always routes to the company dashboard/onboarding. So BR-6, BR-7, BR-9, UI-4, UI-5, UI-7, AC-1, AC-4, AC-5 (deep-link preservation + open-redirect protection) are **not met**.
- Server-side enforcement (BR-10/PERM-3) is already in place via Supabase RLS — no change needed.

## Changes

### 1. New helper `src/lib/safeRedirect.ts`
A small pure function `getSafeReturnTo(raw: string | null): string | null`:
- Returns `null` if missing/empty.
- Rejects anything that is not a same-app relative path: must start with a single `/`, must **not** start with `//` or `/\` (protocol-relative), must not contain `://`, and must not be `/auth` itself (avoid loops).
- Returns the decoded relative path (path + query) when safe. This satisfies BR-9 / AC-5 / UI-7.

### 2. `src/components/ProtectedRoute.tsx`
- Build `returnTo` from `location.pathname + location.search`.
- Redirect to `/auth?returnTo=<encoded>` (BR-6). Keep the existing loading spinner and `replace` behavior.

### 3. `src/pages/Auth.tsx`
- Read `returnTo` from `useSearchParams` and run it through `getSafeReturnTo`.
- In the post-auth redirect effect: if a safe `returnTo` exists, `navigate(returnTo)` (BR-7 / UI-5 / AC-4). 
- If `returnTo` was present but unsafe, show a warning toast and fall back to the default destination (UI-7 / AC-5).
- If no `returnTo`, keep current behavior: company dashboard, else onboarding (UI-6 / BR-8).

## Verification
- TC-1: logged out → `/applications/123` shows spinner then `/auth?returnTo=/applications/123`.
- TC-2: logged in → protected route renders.
- TC-3: deep link `/documents` preserved through login.
- TC-4: `returnTo=https://evil.com` ignored → default page + warning.
- TC-5: auth error path still lands on `/auth` with no protected content (existing behavior).

## Technical notes
- No backend/schema changes. Purely frontend guard + auth-redirect logic.
- `getSafeReturnTo` centralizes open-redirect validation so it can be unit-reasoned and reused.
