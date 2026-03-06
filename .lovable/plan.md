

## Remove Company Filter from Admin Documents List

Since document definitions are unique/universal (not company-specific), the company dropdown filter and company column are unnecessary in the admin view.

### Changes to `src/components/admin/AdminDocumentsListTab.tsx`

1. **Remove the company filter dropdown** from the toolbar
2. **Remove the "Company" column** from the table
3. **Remove the company selector** from the "Add Document" dialog (will need a default company or make `company_id` assignment automatic)
4. **Remove the `filterCompany` state** and related filtering logic
5. **Remove the companies query** and `companyMap` lookup since they're no longer needed in the table display

However, the `document_definitions` table has a required `company_id` column. For the "Add Document" dialog, we still need to assign a company. Two options:

- **Keep the company selector only in the Add dialog** (since the DB requires it), but remove it from the filter/table view
- **Or** pick a default company automatically

I'll keep the company selector in the Add dialog only (since the DB constraint requires it), but remove it from filtering and table display. The admin sees a flat, deduplicated list of all documents across the platform.

### Files to modify
- `src/components/admin/AdminDocumentsListTab.tsx` -- remove company filter, company table column, keep company selector only in Add dialog

