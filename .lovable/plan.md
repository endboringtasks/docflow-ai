# Add Tuning Guidance for Platform Settings

## Goal
For each platform settings key, explain in plain language: **what it controls**, **when to change it**, and **how to find the right value (sweet spot + trade-offs)**. This is presentation-only — no database or business-logic changes.

## What exists today
- **File Upload & Sync Configuration card** (`UploadSyncConfigCard.tsx`) — numeric inputs for the 7 known keys, each with a single short sentence.
- **Platform Settings card** (`PlatformSettingsCard.tsx`) — generic key-value table. It stores a `description` per row but never displays it.

The 7 managed keys: `upload_max_file_size_mb`, `upload_signed_url_expiry_seconds`, `upload_rate_limit_ip`, `upload_rate_limit_token`, `sync_batch_size`, `sync_max_attempts`, `storage_retention_days`.

## Plan

### 1. Central guidance map
Create `src/lib/platformSettingsGuidance.ts` exporting a record keyed by setting key. Each entry contains:
- `purpose` — what it does
- `whenToChange` — symptoms/scenarios that justify a change
- `tuning` — how to pick a value, the trade-off in each direction, and a recommended sweet spot

Example for `sync_batch_size`:
> **Purpose:** How many document attachments each background sync run pushes to Google Drive.
> **When to change:** Raise it if files queue up and sync feels slow; lower it if you see Drive rate-limit errors or function timeouts.
> **Tuning:** Higher = faster throughput but more risk of hitting Drive API limits / timeouts. Lower = safer but slower. Sweet spot: 10–15 for most workloads; drop to 5 if errors appear.

Similar entries authored for all 7 keys (file size, URL expiry security vs convenience, both rate limits abuse-vs-legit-traffic, retry attempts, retention storage-cost-vs-recovery).

### 2. Enrich the Upload & Sync card
In `UploadSyncConfigCard.tsx`, add an info icon (lucide `Info`) next to each label that opens a `Popover`/`HoverCard` showing the Purpose / When to change / How to tune sections from the guidance map. Keep the existing short `description` line as the at-a-glance summary.

### 3. Show descriptions in the Platform Settings table
In `PlatformSettingsCard.tsx`:
- Add a **Description** column rendering the row's stored `description`.
- For rows whose key matches the guidance map, add the same info popover with detailed tuning help.

## Technical notes
- Uses existing shadcn `Popover` (or `HoverCard`) and `Info` icon — no new dependencies.
- No migration: guidance lives in frontend code so it's easy to maintain and version. The DB `description` column continues to show whatever is stored.
- No changes to mutations, RLS, or edge functions.

## Out of scope
- Editing stored descriptions in the database.
- Changing any actual setting values or their min/max ranges.
