

## Add Configurable Upload & Sync Parameters to Admin Settings

Currently, upload limits, sync configuration, and retention settings are hardcoded in edge functions. This will add a dedicated configuration section in the Admin Settings page (`/admin/settings`) so you can adjust these values without redeploying code.

### Parameters to Make Configurable

| Parameter | Current Default | Settings Key |
|---|---|---|
| Max file size (MB) | 25 | `upload_max_file_size_mb` |
| Signed URL expiry (seconds) | 600 | `upload_signed_url_expiry_seconds` |
| Rate limit per IP (requests/5min) | 50 | `upload_rate_limit_ip` |
| Rate limit per token (requests/5min) | 10 | `upload_rate_limit_token` |
| Sync batch size | 10 | `sync_batch_size` |
| Max sync retry attempts | 5 | `sync_max_attempts` |
| Storage retention (days) | 30 | `storage_retention_days` |

### What Changes

**Admin Settings page** (`src/pages/admin/Settings.tsx`):
- Add a new card: "File Upload & Sync Configuration"
- Show each parameter with its current value and an inline edit field
- Save changes to `platform_settings` table
- Pre-seed default values if keys don't exist yet

**Edge functions** (read settings at runtime):
- `portal-request-upload-url`: Read `upload_max_file_size_mb`, `upload_signed_url_expiry_seconds`, `upload_rate_limit_ip`, `upload_rate_limit_token` from `platform_settings` (fallback to current defaults)
- `sync-to-drive`: Read `sync_batch_size`, `sync_max_attempts` from `platform_settings`
- `cleanup-synced-storage`: Already reads `storage_retention_days` (no change needed)

**Database**: Seed default values into `platform_settings` via migration so the admin UI shows current defaults immediately.

### Technical Details

**Migration**: Insert default platform_settings rows (ON CONFLICT DO NOTHING so existing overrides are preserved).

**Edge function changes**: Each function adds a small helper query at startup to fetch its relevant settings, with hardcoded fallbacks if the query fails or key is missing. This adds one DB query per invocation but keeps the system self-configuring.

**Admin UI**: The new card uses number inputs with min/max validation. Each field saves independently on blur or via a "Save" button. Uses the existing `platform_settings` CRUD already in the page.

