
## Fix: Update Drive Connection Status Check Across All Pages

### Problem
Since we now preserve `root_folder_id` on disconnect (to prevent duplicate folders), the `isDriveConnected` check across all pages still evaluates to `true` because it only checks for `root_folder_id`. This makes the client list, client detail, and application pages show "connected" status even when Drive is disconnected.

### Solution
Update the `isDriveConnected` variable in all 5 files to also check that `disconnected_at` is null, matching the rule established in the settings page:

```typescript
// Before:
const isDriveConnected = !!driveStatus?.root_folder_id;

// After:
const isDriveConnected = !!driveStatus?.root_folder_id && !driveStatus?.disconnected_at;
```

### Files to Update

| File | Line | Change |
|---|---|---|
| `src/pages/migration/Clients.tsx` | 178 | Add `&& !driveStatus?.disconnected_at` |
| `src/pages/migration/ClientDetail.tsx` | 240 | Add `&& !driveStatus?.disconnected_at` |
| `src/pages/migration/Applications.tsx` | 379 | Add `&& !driveStatus?.disconnected_at` |
| `src/pages/migration/ApplicationDetail.tsx` | 355 | Add `&& !driveStatus?.disconnected_at` |
| `src/hooks/useDriveBackfill.ts` | 30 | Add `&& !driveStatus?.disconnected_at` |

This is a one-line change in each file. After this fix, when Drive is disconnected, all pages will correctly show the "Not Connected" or "Disconnected" warnings, and folder creation will be properly blocked.
