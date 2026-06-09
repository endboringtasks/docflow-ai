# Add pagination to the Clients page

## Problem
`src/pages/migration/Clients.tsx` renders every client in the table at once (12+ rows, no pagination), unlike the Applications list which now paginates.

## Changes (frontend only, single file)
1. **State**: add `const [page, setPage] = useState(1)` and `const PAGE_SIZE = 10`.
2. **Paged data**: compute `totalPages = Math.max(1, ceil(filteredClients.length / PAGE_SIZE))` and `pagedClients = filteredClients.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)`. Render the table body from `pagedClients` instead of `filteredClients`.
3. **Reset on search**: `useEffect` resetting `page` to 1 when `searchQuery` changes; clamp `page` to `totalPages` if results shrink.
4. **Controls**: below the table card, render shadcn `Pagination` (Previous / "Page X of Y" / Next), shown only when `filteredClients.length > PAGE_SIZE`. Previous/Next disabled at bounds. Reuse the same pattern just added to Applications.
5. Keep the existing empty-state (`filteredClients.length === 0`) untouched.

## Out of scope
- No changes to data fetching, RLS, columns, or create/edit/delete behavior.

## Verification
- 12 clients → two pages of 10 + 2; Next/Previous navigate correctly and disable at ends.
- Searching resets to page 1; clearing search restores pagination.
- Empty state still shows when no matches.
