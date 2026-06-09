## Fix: Audit Logs page slow and empty

### Problem
`src/pages/admin/AuditLogs.tsx` fetches logs with an embedded PostgREST relationship:

```ts
.select(`*, profiles:user_id(email, display_name)`)
```

But `platform_audit_logs.user_id` only has a foreign key to `auth.users`, not to `public.profiles`. PostgREST cannot resolve the embed, so the request errors out. React Query keeps the page in a loading/empty state. The database actually has 15 audit rows.

### Fix (frontend only, no schema change)
Decouple the profile lookup from the audit-log query:

1. Fetch `platform_audit_logs` rows on their own (no embed), keeping the existing filters (company, date range), ordering, and limit.
2. Collect the distinct `user_id` values and fetch the matching rows from `profiles` (`id, email, display_name`) in a second query.
3. Build a `Map<userId, {email, display_name}>` and attach the resolved profile to each log in memory.
4. Update the table cells (currently reading `log.profiles`) to read from the merged data so User name/email render correctly.

This matches the separate-fetch pattern already used elsewhere in the admin panel and avoids relying on a non-existent PostgREST relationship.

### Files to touch
- `src/pages/admin/AuditLogs.tsx`

### Verification
- Audit Logs page loads quickly and shows all 15 existing entries (impersonate_start/end, delete_user, etc.).
- User column shows display name + email; rows with no profile fall back to "System"/"-".
- Date range, type, and search filters still work.
</content>
<summary>Fix Audit Logs page that hangs/empties because it embeds profiles via a relationship that doesn't exist; switch to a separate profile fetch and merge.</summary>
</invoke>
