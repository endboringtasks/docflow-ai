

## Fix: Preserve Root Folder ID During Disconnect

### Root Cause

The disconnect function (`google-drive-disconnect/index.ts`, line 241) sets `root_folder_id: null` and `root_folder_name: null` when disconnecting. So when the callback checks for an existing folder to reuse, it always finds `null` and creates a new one.

### Solution

Stop clearing `root_folder_id` and `root_folder_name` during disconnect. These should be preserved so that reconnecting reuses the same folder. The `disconnected_at` timestamp already signals that the connection is inactive -- there is no need to also wipe the folder reference.

### Technical Change

**File: `supabase/functions/google-drive-disconnect/index.ts`** (lines 236-246)

Remove `root_folder_id: null` and `root_folder_name: null` from the soft-delete update:

```typescript
// Before (current):
.update({
  access_token: "",
  refresh_token: "",
  root_folder_id: null,       // <-- causes the bug
  root_folder_name: null,     // <-- causes the bug
  tokens_encrypted: false,
  disconnected_at: new Date().toISOString(),
})

// After (fixed):
.update({
  access_token: "",
  refresh_token: "",
  tokens_encrypted: false,
  disconnected_at: new Date().toISOString(),
})
```

This way, when the callback runs on reconnection, it finds the stored `root_folder_id`, verifies it is still accessible in Drive, and reuses it -- no duplicate folders.

| File | Change |
|---|---|
| `supabase/functions/google-drive-disconnect/index.ts` | Stop clearing `root_folder_id` and `root_folder_name` on disconnect |

