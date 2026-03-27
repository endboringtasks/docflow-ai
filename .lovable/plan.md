

## Remove "Document Checklist" Tab from Admin Reference Data

### Problem
The "Document Checklist" tab in the admin Reference Data page provides a way to associate documents with applications, but this is now handled exclusively via the "Application Checklist" tab. The redundant tab should be removed.

### Changes

**File: `src/pages/admin/ReferenceData.tsx`**

1. **Remove the tab trigger** (lines 3416-3419): Delete the `<TabsTrigger value="documents">` block for "Document Checklist".

2. **Remove the tab content** (lines 3460-3462): Delete the `<TabsContent value="documents">` block that renders `<DocumentsTab />`.

3. **Remove the `DocumentsTab` component/function**: Search for the `DocumentsTab` definition within the file (it's a large inline component ~lines 2400-2900) and remove it entirely.

4. **Clean up unused imports**: Remove any imports that were only used by `DocumentsTab` (e.g., `CheckSquare` icon if unused elsewhere).

This leaves "Documents List" (master catalog for document identity) and "Application Checklist" (document-application rules) as the two document management tabs — a cleaner two-level hierarchy.

