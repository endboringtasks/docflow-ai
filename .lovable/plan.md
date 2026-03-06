

## Add "Documents List" Tab to Admin Reference Data Page

The "Documents List" tab currently exists only on the company-level Document Checklist page (`src/pages/migration/DocumentChecklist.tsx`). The admin Reference Data page at `/admin/reference-data` has a "Document Checklist" tab but no "Documents List" tab. Based on your screenshot, you want to see it in the admin section.

### Changes

**`src/pages/admin/ReferenceData.tsx`**

1. Import `DocumentsListTab` from `@/components/documents/DocumentsListTab`
2. Add a new `TabsTrigger` for "Documents List" (value `"documents-list"`) before the existing "Document Checklist" tab trigger
3. Add a corresponding `TabsContent` rendering `<DocumentsListTab />`

**Note:** The existing `DocumentsListTab` component uses `useCompany()` to scope definitions to the current company. In the admin context, there is no "current company" selected -- the admin manages all companies. Two options:

- **Option A**: Reuse the component as-is. It will show definitions for whatever company the admin is currently impersonating/viewing (if `useCompany` returns a value in admin context).
- **Option B**: Create an admin-specific version that shows all definitions across all companies, or adds a company filter dropdown.

Since the admin Reference Data page appears to be global (not company-scoped), **Option B** is more appropriate -- I'll add a company selector dropdown to the Documents List when rendered in admin context, or show all companies' definitions with a company column.

### Technical Detail

- Add a `isAdmin` prop to `DocumentsListTab` (or create a thin wrapper) that, when true, fetches all definitions without filtering by `company_id` and displays the company name as an extra column
- Alternatively, the simpler approach: just add the tab and let it work with the admin's impersonated company context, same as the existing "Document Checklist" tab likely does

I'll check what the existing `DocumentsTab` does for company scoping and match that pattern.

