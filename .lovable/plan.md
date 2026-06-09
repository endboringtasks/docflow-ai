# Fix: Admin panel still shows Drive connected after disconnect

## Root cause
`google-drive-disconnect` performs a **soft-delete** — it clears tokens and sets `disconnected_at`, but the `google_drive_connections` row remains. The admin query in `src/pages/admin/CompanyDetail.tsx` (lines 195-208) selects the row by `company_id` only, without filtering out disconnected rows, so `driveConnection` stays truthy and the UI keeps rendering the green "Connected" card.

## Change (single file: `src/pages/admin/CompanyDetail.tsx`)
- Update the `admin-drive-connection` query to ignore soft-disconnected rows by adding `.is("disconnected_at", null)` to the select.

```ts
.from("google_drive_connections")
.select("id, connected_email, root_folder_name, root_folder_id, created_at")
.eq("company_id", companyId)
.is("disconnected_at", null)
.maybeSingle();
```

After a successful disconnect, the existing `invalidateQueries(["admin-drive-connection", companyId])` will refetch and now return `null`, so the UI shows "Not connected".

## Verification
- As platform admin: open a company with a connected Drive → click Disconnect → confirm → card switches to "Not connected".
- Reopen the sheet → still "Not connected".
