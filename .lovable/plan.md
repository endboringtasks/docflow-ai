

## Move Drive Backfill to Global Scope (Always Active)

### Problem
The Drive reconnection backfill logic currently lives inside `src/pages/migration/Clients.tsx`. This component only mounts when the user navigates to the Clients page. So the backfill only starts after clicking through to that page -- the 30s polling is useless if the user is on Dashboard, Settings, or any other page.

### Solution
Extract the Drive status polling and backfill trigger into a custom hook and mount it in `AppLayout` so it runs globally, regardless of which page the user is on.

### Changes

**New file: `src/hooks/useDriveBackfill.ts`**
- Extract the Drive connection status query (with `refetchInterval: 30_000`) from `Clients.tsx`
- Extract the `prevDriveConnectedRef` tracking and reconnection detection logic
- Extract the entire `createPendingFolders` function (client + application backfill)
- The hook takes `currentCompany` as context and returns `driveStatus` and `isDriveConnected` for any component that needs it
- Uses `useQueryClient` to invalidate queries after backfill

**File: `src/components/layout/AppLayout.tsx`**
- Import and call `useDriveBackfill()` so the polling and backfill run on every page

**File: `src/pages/migration/Clients.tsx`**
- Remove the Drive status query, `prevDriveConnectedRef`, the `useEffect` reconnection handler, and the `createPendingFolders` function
- Instead, import `useDriveBackfill` (or just query `drive-connection-status` without the backfill logic, since it now runs globally)
- Keep using `driveStatus` and `isDriveConnected` for UI rendering (badges, etc.) -- these can come from the same shared query key

### Result
- Drive reconnection is detected within 30 seconds regardless of which page the user is on
- Backfill triggers automatically from any page (Dashboard, Settings, Applications, etc.)
- No duplicate logic -- single source of truth for backfill behavior

### Files Summary

| File | Change |
|---|---|
| `src/hooks/useDriveBackfill.ts` | New hook: polling + reconnection detection + backfill dispatch |
| `src/components/layout/AppLayout.tsx` | Call `useDriveBackfill()` to activate globally |
| `src/pages/migration/Clients.tsx` | Remove backfill logic, keep UI-only Drive status usage |

