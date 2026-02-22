

## Fix: Save `documents_received_folder_id` from Make.com Response

### Problem
When Make.com creates a client's folder structure, it creates both the client folder and a "Documents Received" subfolder. It returns both IDs in the webhook response. However, `dispatch-webhook` only extracts and saves `client_folder_id` -- it ignores `documents_received_folder_id`.

This means the DB has `documents_received_folder_id = null`. When a client uploads a document, the upload function tries to find or create a "Documents Received" folder. Because the Make.com-created folder belongs to a different Google account, the search may not find it, resulting in a duplicate.

### Solution
Update `dispatch-webhook` to also extract and persist `documents_received_folder_id` from the Make.com response when handling `client.created` events.

### Technical Changes

**File: `supabase/functions/dispatch-webhook/index.ts`**

1. After extracting `folderId` for client entities (around line 473), also extract `documents_received_folder_id` from the response data:

```typescript
// For client entities, also look for documents_received_folder_id
let documentsReceivedFolderId: string | undefined;
if (entityType === "client") {
  documentsReceivedFolderId =
    (dataObj as any).documents_received_folder_id ||
    (responseData as any).documents_received_folder_id;
}
```

2. When updating the client record (around line 515), include `documents_received_folder_id` if present:

```typescript
.update({
  [folderColumn]: folderId,
  folder_status: "created",
  folder_status_updated_at: new Date().toISOString(),
  ...driveUpdateFields,
  ...(documentsReceivedFolderId && entityType === "client"
    ? { documents_received_folder_id: documentsReceivedFolderId }
    : {}),
})
```

### What This Fixes
- Make.com creates client folder + Documents Received subfolder
- `dispatch-webhook` now saves BOTH folder IDs to the DB
- When the client uploads, the upload function finds `documents_received_folder_id` already set and uses it directly -- no search, no duplicate creation

| File | Change |
|---|---|
| `supabase/functions/dispatch-webhook/index.ts` | Extract and save `documents_received_folder_id` from Make.com response for client entities |

