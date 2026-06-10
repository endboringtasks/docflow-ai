# Fix: "Edge Function returned a non-2xx status code" on account deletion

## Root cause
The edge function logs show `Auth user deletion error: Database error deleting user`. `auth.admin.deleteUser()` fails because several tables reference `auth.users` with `ON DELETE NO ACTION` (RESTRICT), so Postgres refuses to delete the row while any reference remains:

- `platform_audit_logs.user_id` — and the function inserts a fresh audit row referencing the user right before deleting, guaranteeing the block.
- `document_checklist.uploaded_by` and `document_checklist.reviewed_by` — remain for any company the user worked in but doesn't own.
- `platform_admins.created_by`, `platform_webhooks.created_by`, `platform_settings.updated_by`.

All six columns are nullable, so they can safely be switched to `ON DELETE SET NULL`.

## Fix — database migration
Drop and recreate these six foreign keys with `ON DELETE SET NULL` so deleting a user automatically nulls the references instead of blocking:

- `platform_audit_logs.user_id`
- `document_checklist.uploaded_by`
- `document_checklist.reviewed_by`
- `platform_admins.created_by`
- `platform_webhooks.created_by`
- `platform_settings.updated_by`

This also makes the existing `admin-delete-user` function robust for the same reason.

## Audit trail preserved (BR-13)
After deletion `platform_audit_logs.user_id` becomes NULL, but the `delete_account` event still carries `entity_id = <deleted user id>` (no FK on `entity_id`), so the actor remains identifiable for compliance. No edge-function code change is required; the existing anonymize + insert logic continues to work.

## Verification
Re-test `delete-my-account` against a disposable test user via the edge-function curl tool and confirm a 200 response and that the auth user, profile, and owned-company data are gone while audit rows remain (with nulled user_id).

## Technical note
`information_schema` hid these constraints earlier; they were found via `pg_constraint`. The `del_type='a'` entries are the RESTRICT ones being changed.
