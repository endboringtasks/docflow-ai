## Platform Settings Management (DOC-63)

### What already exists
- `platform_settings` table: `key`, `value` (jsonb), `description`, `is_secret`, `updated_by`, `updated_at` — matches the spec's key-value + secret + audit model (BR-1, BR-5, BR-10).
- RLS: a single `is_platform_admin(auth.uid())` policy for ALL commands — non-admins get nothing (PERM-1, BR-9, BR-16).
- Route protection via `AdminProtectedRoute` shows "Access Denied" to non-admins (AC-1).
- `src/pages/admin/Settings.tsx` already renders an "API Keys & Configuration" card with a list (key/value/description/updated), an **Add Setting** dialog, secret masking with `••••••`, and delete.

### Gaps to close (DOC-63)
The Add/Create flow (PF-3) and masking (UI-11) are largely done. Missing: edit, search, secret filter, pagination, updated-by column, reveal, and validation.

### Plan — frontend only
Extract the platform-settings management into a dedicated component `src/components/admin/PlatformSettingsCard.tsx` and use it in `Settings.tsx` in place of the current "API Keys & Configuration" card. No database or edge-function changes are needed — the schema and RLS already satisfy the backend rules.

**1. List table (UI-1)** — columns: Key, Value (masked if secret), Secret (Yes/No badge), Updated at, Updated by, Actions (Edit + Delete). "Updated by" resolved by joining `profiles` (display_name/email) on `updated_by`.

**2. Search by key (UI-2)** — text input filtering client-side on `key`.

**3. Secret filter (UI-3)** — dropdown: All / Secret only / Non-secret.

**4. Pagination (UI-4)** — client-side pager (10 rows/page) over the filtered list, with the existing empty state preserved (UI-5).

**5. Edit modal (PF-2, UI-6..10)** — clicking Edit opens a dialog with:
- Read-only Key field (BR-3, UI-6).
- Editable Value input (UI-7).
- Secret toggle (UI-8).
- Inline validation messages (UI-9, BR-13): non-empty value, value length cap, and (for the create flow) key format = lowercase dot-separated `^[a-z0-9]+(\.[a-z0-9_]+)*$`.
- Save / Cancel (UI-10). Save writes `value`, `is_secret`, and sets `updated_by = current user` + `updated_at = now()` (PF-2 steps 5-6, BR-10). On success: toast + refresh row; on failure: error toast, no partial update (BR-15).

**6. Secret reveal (UI-11, UI-12)** — secret values render as `••••••` with an eye toggle button per row (and in the edit modal) that reveals the actual value to the admin, with a confirmation step before revealing. Values are already only fetched in an admin-gated context (PERM-2).

**7. Reserved-key guard (BR-12)** — keys matching `auth.*` / `billing.*` are flagged read-only in the edit modal (value disabled) with an explanatory note, unless none exist. Create flow rejects these prefixes with an inline message.

**8. Validation on create (PF-3, BR-2, BR-13)** — enforce key format + uniqueness check (query existing keys) before insert, plus value length, with inline errors instead of only relying on a generic DB error.

### Technical notes
- All work is in `src/components/admin/PlatformSettingsCard.tsx` (new) and a small edit to `src/pages/admin/Settings.tsx` to swap in the new card. The Platform Admins card and Upload/Sync config card stay untouched.
- Optimistic concurrency (BR-14) is handled lightly: the edit mutation includes `.eq("updated_at", originalUpdatedAt)` so a stale edit fails cleanly and prompts a refresh; full version-column locking is out of scope.
- Uses existing shadcn `Dialog`, `Select`, `Input`, `Switch`, `Badge`, `Table`, and `sonner` toasts — consistent with current admin styling.
