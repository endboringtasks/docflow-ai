

## Show "Google Drive Disconnected" status and guide users to connect

### Problem
When Google Drive is not connected, clients with no folder show a dash (---) which doesn't clearly communicate why there's no folder or what to do about it. The user wants:
1. A clear "Google Drive Disconnected" message with guidance on how to connect
2. When Drive is reconnected, pending folders should be created automatically
3. Clients that already had folders should still show "Open Folder" links

### Solution

**1. Add a Drive connection status query at the component level**
- Add a `useQuery` hook to fetch the Google Drive connection status for the current company using `get_drive_connection_status` RPC
- This provides `isDriveConnected` as a reactive value accessible throughout the component

**2. Update the Drive Folder column UI**
- When Drive is **disconnected** and `folder_status` is `null`: Show a warning badge "Drive Not Connected" with a tooltip containing step-by-step instructions on how to connect Google Drive (Settings > Google Drive > Connect)
- When Drive is **disconnected** and `folder_status` is `"created"` with a `client_folder_id`: Still show the "Open Folder" link (the folder exists, it's just the connection that's down)
- When Drive is **disconnected** and `folder_status` is `"pending"` or `"failed"`: Show "Drive Not Connected" instead of Pending/Failed badges

**3. Auto-create pending folders when Drive is reconnected**
- Add an effect that watches the Drive connection status
- When it transitions from disconnected to connected (rootFolderId becomes available), find all clients with `folder_status = null` and trigger folder creation for them by:
  - Updating their `folder_status` to `"pending"`
  - Dispatching the `client.created` webhook for each one

### Technical Details

**File: `src/pages/migration/Clients.tsx`**

Add a new query (after the clients query, around line 153):
```typescript
const { data: driveStatus } = useQuery({
  queryKey: ["drive-connection-status", currentCompany?.id],
  queryFn: async () => {
    if (!currentCompany?.id) return null;
    const { data } = await supabase
      .rpc("get_drive_connection_status", { p_company_id: currentCompany.id });
    return data?.[0] ?? null;
  },
  enabled: !!currentCompany?.id,
});

const isDriveConnected = !!driveStatus?.root_folder_id;
```

Add new imports: `Settings`, `AlertTriangle` from lucide-react, and `useNavigate` (already imported).

Update the Drive Folder column rendering (lines 761-812):
- Add a top-level check: if `folder_status === "created"` and `client_folder_id` exists, always show "Open Folder" regardless of connection
- If Drive is not connected and no folder exists (`folder_status` is null, pending, or failed): show a muted "Not Connected" badge with a tooltip that says:
  - "Google Drive is not connected"
  - Step 1: Go to Settings
  - Step 2: Scroll to Google Drive Integration
  - Step 3: Click Connect Google Drive
  - Step 4: Authorize access
  - Include a "Go to Settings" link button
- If Drive IS connected, keep existing logic (pending, creating, failed badges)

Add an effect to batch-create folders when Drive reconnects (new `useMutation` + `useEffect`):
- Watch `isDriveConnected` and `clients` list
- When `isDriveConnected` becomes true and there are clients with `folder_status === null`, update them to `"pending"` and dispatch webhooks for each
- Show a toast: "Google Drive connected! Creating folders for X clients..."
- Use a ref to track if we've already triggered this to avoid repeated dispatches

**File: `src/pages/migration/Clients.tsx`** - Add a `useRef` to track previous drive connection state so the auto-creation only fires on transition from disconnected to connected.

