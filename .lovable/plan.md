

## Add Column Sorting to All Admin Reference Data Tables

### Scope
Add clickable sortable column headers (same pattern as Application Checklist detail view) to every table across the admin Reference Data tabs. There are **7 tables** that need this feature:

### Tables to update

**1. `ReferenceData.tsx` — Countries tab** (line ~277)
- Sortable columns: Order, Code, Name, Status

**2. `ReferenceData.tsx` — Categories tab** (line ~540)
- Sortable columns: Order, Code, Name, Country, Status

**3. `ReferenceData.tsx` — Subcategories tab** (line ~874)
- Sortable columns: Order, Code, Name, Category, Country, Status

**4. `ReferenceData.tsx` — Applicant Types tab** (line ~1175)
- Sortable columns: Order, Code, Name, Status

**5. `ReferenceData.tsx` — Application Names tab** (line ~1559)
- Sortable columns: Order, Code, Name, Country, Category, Subcategory, Status

**6. `AdminDocumentsListTab.tsx` — Document Definitions tab** (line ~306)
- Sortable columns: Category, Document Name

**7. `ApplicationChecklistTab.tsx` — Application list (Step 1)** (line ~183)
- Sortable columns: Order, Code, Name

### Approach

**Extract a reusable hook + SortIcon component** into a shared file (`src/hooks/useTableSort.ts`) to avoid duplicating sort logic across all 7 tables:
- `useTableSort<T>(data, columnAccessors)` — returns `sortedData`, `sortColumn`, `sortDirection`, `handleSort`
- `SortableTableHead` — a wrapper around `<TableHead>` that renders the click handler and arrow icon

**Then update each table** to:
1. Call `useTableSort` with the table's data and column key-to-accessor map
2. Replace static `<TableHead>` with `<SortableTableHead>` for sortable columns
3. Render `sortedData` instead of the raw array

### Files changed
- **New**: `src/hooks/useTableSort.ts` — reusable sort hook + SortableTableHead component
- **Edit**: `src/pages/admin/ReferenceData.tsx` — 5 tables (Countries, Categories, Subcategories, Applicant Types, Application Names)
- **Edit**: `src/components/admin/AdminDocumentsListTab.tsx` — Document Definitions table
- **Edit**: `src/components/admin/ApplicationChecklistTab.tsx` — Application list table (Step 1) + refactor existing Step 2 sorting to use shared hook

