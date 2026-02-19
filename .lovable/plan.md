

## Fix: ApplicationDetail Drive Mismatch Detection

### Problem

The ApplicationDetail page fetches the drive email from the `google_drive_connections` table (`appDriveBinding?.connected_email`), which returns the **current** connection email (`anderri@gmail.com`). Since `driveStatus?.connected_email` is also `anderri@gmail.com`, they always match -- so it never shows a warning.

The correct source is the client's `drive_created_email` column, which snapshots the email used when the folder was actually created (`anderson@endboringtasks.com`).

### Root Cause

The `google_drive_connections` table has a unique constraint on `company_id`, so reconnecting with a different account **overwrites** the `connected_email` in the same record. The `appDriveBinding` query reads from this record, so it always reflects the current account, not the original one.

### Fix

#### 1. `src/pages/migration/ApplicationDetail.tsx`

Replace the `appDriveBinding` lookup (which reads from the connection record) with a query that fetches `drive_created_email` from the **client** record instead:

```typescript
// Instead of fetching from google_drive_connections,
// fetch the client's snapshotted drive_created_email
const { data: clientDriveEmail } = useQuery({
  queryKey: ["client-drive-email", visaApplication?.client_id],
  queryFn: async () => {
    const { data } = await supabase
      .from("clients")
      .select("drive_created_email")
      .eq("id", visaApplication.client_id)
      .maybeSingle();
    return data?.drive_created_email ?? null;
  },
  enabled: !!visaApplication?.client_id,
});
```

Then update the mismatch comparison (~line 1907 and ~1932) to use `clientDriveEmail` instead of `appDriveBinding?.connected_email`:

```typescript
const boundEmail = clientDriveEmail;  // was: appDriveBinding?.connected_email
const currentEmail = driveStatus?.connected_email;
const isDriveMismatch = isDriveConnected && !!boundEmail && !!currentEmail && boundEmail !== currentEmail;
```

Also update any disconnected tooltip references that use `appDriveBinding?.connected_email` to use `clientDriveEmail` instead.

### Files Summary

| File | Change |
|---|---|
| `src/pages/migration/ApplicationDetail.tsx` | Replace `appDriveBinding` connection lookup with client's `drive_created_email`; update mismatch comparisons |

