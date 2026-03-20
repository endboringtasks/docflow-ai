

## Add Column Sorting to Application Checklist Detail View

### What changes
Add clickable column headers (Document Name, Category, Applicant Type, Requirement) that toggle ascending/descending sort on the linked documents table in `ApplicationDetailView`.

### File: `src/components/admin/ApplicationChecklistTab.tsx`

**1. Add sort state** -- `sortColumn` (string: "document_name" | "category" | "applicant_type" | "requirement_type") and `sortDirection` ("asc" | "desc"), defaulting to no sort.

**2. Add a `sortedDocs` useMemo** that takes `linkedDocs`, resolves applicant type names via `applicantTypeMap`, and sorts based on the active column/direction. Clicking the same column toggles direction; clicking a different column sets ascending.

**3. Replace static `<TableHead>` elements** with clickable headers showing an arrow indicator (ArrowUpDown / ArrowUp / ArrowDown from lucide-react) for the four sortable columns: Document Name, Category, Applicant Type, Requirement.

**4. Render `sortedDocs`** instead of `linkedDocs` in the table body.

No new files. Only modifying `ApplicationChecklistTab.tsx`.

