## Problem

On the client portal, every file upload first calls the `portal-request-upload-url` edge function, which is rate-limited **per access token to 10 requests per 5 minutes** (`upload_rate_limit_token = 10`, window hard-coded to 300s). A client filling out a full document checklist legitimately needs to upload many more than 10 files in one session, so they hit **"Too Many Requests"**.

There's also a per-IP limit of 50/5min, which can be hit when multiple documents upload in quick succession or several clients share an office IP.

## Fix

Raise the rate-limit ceilings so a normal full-checklist submission never trips them, while still protecting against abuse.

1. **Bump the configurable defaults** in `portal-request-upload-url` (the `DEFAULT_RATE_LIMIT_TOKEN` and `DEFAULT_RATE_LIMIT_IP` constants), so projects without an explicit `platform_settings` row get sane values:
   - token: `10` → `100`
   - IP: `50` → `200`

2. **Update the current `platform_settings` values** (migration) so this live project gets the new limits immediately:
   - `upload_rate_limit_token`: 10 → 100
   - `upload_rate_limit_ip`: 50 → 200

3. **Raise the admin UI max** in `UploadSyncConfigCard.tsx` so admins can tune higher if needed:
   - token slider/input `max`: 100 → 300
   - IP slider/input `max`: 500 → 1000 (keep, or raise as needed)

4. **Friendlier error handling** in `ClientPortal.tsx` upload handler: when the request-upload-url or finalize call returns HTTP 429, show a clear toast like "Too many uploads in a short time — please wait a moment and try again" instead of the raw "Too Many Requests" message, and surface the `Retry-After` hint when present.

## Technical details

- The 5-minute window stays as-is; only the request ceiling changes.
- `getUploadSettings()` already reads these keys from `platform_settings`, so step 2 takes effect without redeploying, and step 1 covers the fallback path.
- No schema changes beyond updating two existing `platform_settings` rows.
