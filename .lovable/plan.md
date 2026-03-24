

## Add Real-Time Updates for Document Checklist Changes

### Problem
When a client deletes a document through the client portal, the agent's Application Detail page doesn't reflect the change (row color, status badge, attachment count) because there's no real-time subscription on the `document_checklist` table. The data only refreshes when the agent performs a local action or manually reloads the page.

### Solution
Add a Supabase real-time subscription in `ApplicationDetail.tsx` that listens for changes to `document_checklist` rows associated with the current visa application. When any update occurs (e.g., client deletes a file), the query cache is invalidated, causing the UI to refetch and re-render with updated colors and badges.

### Changes

**File: `src/pages/migration/ApplicationDetail.tsx`**

1. Add a `useEffect` that subscribes to Postgres changes on the `document_checklist` table, filtered by `visa_application_id`.
2. On any `UPDATE` or `DELETE` event, call `queryClient.invalidateQueries` for the `["document-checklist", visaApplicationId]` query key.
3. Also subscribe to `document_attachments` changes (for attachment count updates) and similarly invalidate the checklist query.
4. Clean up the subscription on unmount.

This follows the same pattern as the existing `useFolderStatusRealtime` hook but is scoped to document checklist data. The subscription will be active only while the agent has the application detail page open.

