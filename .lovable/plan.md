

## Application Checklist Tab

### What it does

A new **"Application Checklist"** tab in Reference Data that provides an application-centric view for managing document templates. Instead of adding documents one-by-one from the Document Checklist tab, you:

1. **Select an application** (e.g., "Student" visa in Australia) using country/category/subcategory filters
2. **See all documents currently linked** to that application
3. **Add multiple documents at once** from the master catalog (document definitions) via a multi-select dialog
4. **Remove documents** from the application

This is essentially a different lens on the same `document_checklist_templates` + `document_template_applications` data -- viewing and managing templates grouped by application rather than by document.

### Technical approach

**File: `src/pages/admin/ReferenceData.tsx`**

1. Add a new `<TabsTrigger>` for "Application Checklist" and corresponding `<TabsContent>` rendering a new `ApplicationChecklistTab` component.

**File: `src/components/admin/ApplicationChecklistTab.tsx`** (new)

1. **Filters**: Country select, Category select, Subcategory select -- cascading filters that narrow down the application list.
2. **Application selector**: A select/combobox listing `visa_types` matching the filters. Selecting one loads its linked documents.
3. **Linked documents table**: Query `document_template_applications` joined with `document_checklist_templates` for the selected `visa_type_id`. Display document name, category, applicant type, requirement type.
4. **"Add Documents" dialog**: Opens a multi-select list sourced from `document_definitions` (the master catalog). Shows checkboxes grouped by category. On confirm:
   - For each selected definition, find or create a `document_checklist_templates` record (global, `company_id IS NULL`) with that document name/category.
   - Insert `document_template_applications` junction records linking the template to the selected visa type.
5. **Remove**: Delete the `document_template_applications` junction record (does not delete the template itself, just unlinks it).
6. **Bulk operations**: Select all / deselect all for batch adding or removing.

### Data flow

```text
visa_types (application)
    ↕ document_template_applications (junction)
document_checklist_templates (template rules)
    ↑ sourced from
document_definitions (master catalog)
```

### UI layout

```text
┌─────────────────────────────────────────────────┐
│ [Country ▾] [Category ▾] [Subcategory ▾]        │
│ [Application Name ▾]                             │
├─────────────────────────────────────────────────┤
│ ☐ Document Name    Category    Applicant Type    │
│ ☐ Passport         Identity    Primary Applicant │
│ ☐ Birth Cert       Identity    Primary Applicant │
│ ...                                              │
├─────────────────────────────────────────────────┤
│ [+ Add Documents]  [Remove Selected]             │
└─────────────────────────────────────────────────┘
```

### Files affected

- `src/components/admin/ApplicationChecklistTab.tsx` -- new component (bulk of the work)
- `src/pages/admin/ReferenceData.tsx` -- add tab trigger + content (3-4 lines)

