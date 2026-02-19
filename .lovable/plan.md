

## Fix Slow Drive Status Detection — Add Polling Interval

### Problem
The Drive status query on the Clients page has no `refetchInterval`, so React Query only refetches on window refocus or navigation. This causes a 3-5 minute detection delay after connecting Drive in Settings.

### Solution
Add `refetchInterval: 30000` (30 seconds) to the Drive connection status query on the Clients page. This ensures the backfill triggers within 30 seconds of reconnecting Drive, without requiring page navigation or manual refresh.

### Changes

**File: `src/pages/migration/Clients.tsx`**
- Add `refetchInterval: 30_000` to the `drive-connection-status` `useQuery` options (around line 174).

This is a single-line change. No other files need modification — the other pages (Applications, ApplicationDetail, ClientDetail) don't trigger backfill logic, so polling there is unnecessary.

