# Application List View (DOC-19)

## Context
The Applications list at `src/pages/migration/Applications.tsx` already satisfies most of DOC-19: company-scoped query (`company_id = active company` + RLS), name/client/status/category shown per row, status filter (All/Draft/Active/Done), case-insensitive name search, combined search+filter, empty state, and row click → detail. This change closes the three remaining spec gaps without altering creation/edit/delete behavior or the card layout.

## Changes (frontend only, single file)

### 1. No active company blocking state (BR-12, UI-9, TC-5)
- Read `companies` and `loading` from `useCompany()` (already exposes `currentCompany`, `companies`, `loading`).
- After the loading guard, if there is no `currentCompany`:
  - If the user belongs to no companies, show a blocking panel: heading "No company selected", explanatory text, and a CTA button linking to company creation/onboarding (`/onboarding`).
  - If companies exist but none is active, show the same blocking panel prompting the user to pick one via the existing header company switcher.
- This replaces the current behavior where a missing company silently falls through to the generic "No applications yet" empty state.

### 2. Pagination controls (BR-9, UI-6)
- Add `const [page, setPage] = useState(1)` and a `PAGE_SIZE = 10` constant.
- Derive `pagedApplications` by slicing `filteredApplications` for the current page; render cards from this slice.
- Add pagination controls below the list using the existing `@/components/ui/pagination` primitives (Previous / page indicator / Next), shown only when `filteredApplications.length > PAGE_SIZE`.
- Reset `page` to 1 whenever `searchQuery` or `statusFilter` changes (via `useEffect`) so filtered results always start at page 1 (supports AC-3/AC-4/AC-5 correctness).

### 3. Default sort: most recently updated first (BR-10)
- Change the `visa_applications` query order from `created_at desc` to `updated_at desc` (fall back to `created_at` ordering if `updated_at` is unavailable on the row). Keep the existing `created_at` field for the displayed date.

## Out of scope
- Creating/editing/deleting applications (already present, unchanged).
- Converting cards to a table (user chose to keep cards).
- Any backend/RLS/edge-function changes — company scoping and authorization are already enforced server-side via RLS and the `company_id` filter.

## Verification
- No active company → blocking panel with CTA (TC-5).
- Active company → only that company's applications (AC-1/TC-1, already enforced).
- Status filter narrows results; search by partial name works; combined search+filter works (AC-3/4/5).
- Empty state shows when filters match nothing (AC-6).
- Pagination appears for >10 results and navigates correctly; resets on filter/search change.
- List ordered by most recently updated.
