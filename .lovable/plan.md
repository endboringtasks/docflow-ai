

## Problem

The "Link Document" dialog in the Document Checklist tab sources its category and document name options from a **hardcoded `predefinedDocuments` map** merged with existing templates. It does not query the `document_definitions` table — the master catalog managed in the "Documents List" tab.

This means "Business Registration" (which exists in `document_definitions` under category **"Employment"**) doesn't appear because the hardcoded list puts it under "Supporting Evidence", and the categories don't match the ones in the database (e.g., "Employment Records" vs "Employment").

## Plan

**File: `src/pages/admin/ReferenceData.tsx`**

1. **Add a query for `document_definitions`** — fetch all active definitions from the database to populate the Link Document dialog.

2. **Remove the hardcoded `predefinedDocuments` map** — the ~60 lines of hardcoded document names are no longer needed since the Documents List tab is the single source of truth.

3. **Update `getDocumentNamesForCategory`** — source names from `document_definitions` filtered by category instead of the hardcoded map.

4. **Update `getAllDocumentNames`** — same approach, source from definitions.

5. **Update `documentCategories`** — derive categories from `document_definitions` instead of `predefinedDocuments` keys.

This aligns the Document Checklist tab with the master catalog architecture, ensuring any document added in the Documents List tab immediately appears as a linkable option.

