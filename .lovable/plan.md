# Fix: Google Drive disconnect fails from admin panel

## Root cause
`src/pages/admin/CompanyDetail.tsx` (admin-only sheet) invokes the `google-drive-disconnect` edge function. That function authorizes the caller **only** if they are in `company_members` for the target company (lines 146-159). A Platform Admin acting from the admin panel is not a member of the company, so the function returns **403**, surfaced in the UI as "Edge Function returned a non-2xx status code".

## Change (single file: `supabase/functions/google-drive-disconnect/index.ts`)
- After resolving the authenticated user, allow the action when the caller is **either**:
  1. a member of the company (existing `company_members` check), **or**
  2. a **platform admin** — verified server-side via the existing `public.is_platform_admin(_user_id)` security-definer function (called through the service-role client), consistent with other admin functions.
- Only return 403 when **both** checks fail. Keep the rest of the flow (token decrypt, permission removal, token revoke, soft-delete update) unchanged.

```text
caller authenticated
   ├─ is company member?  ──┐
   ├─ is platform admin? ───┼─ either true → proceed
   └─ neither             ──┘ → 403
```

## Verification
- As a platform admin, open Admin → Companies → a company → Disconnect Google Drive → succeeds, connection soft-deleted, success toast.
- As a normal company member (Settings page), disconnect still works.
- As a non-member, non-admin user → still 403.
- Confirm via `google-drive-disconnect` edge logs that the request returns 200.

## Notes
- No DB schema or frontend changes required.
- `is_platform_admin` already exists and is used by other admin edge paths.
