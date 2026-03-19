

## Redesign Application Checklist: List View with Filters

### Current state
The tab uses cascading dropdowns (Country > Category > Subcategory > Application) to select a single application before showing its documents. The user wants to see all applications in a table first, with filters, then click into one.

### Plan

**File: `src/components/admin/ApplicationChecklistTab.tsx`** -- rewrite to two-mode UI

**Mode 1 -- Application List (default)**
- Show a table of all `visa_types` with columns: Name, Code, Country, Category, Subcategory, Linked Docs count
- Filter row above: Country, Category, Subcategory dropdowns + text search input
- Query `visa_types` joined with `countries`, `application_categories`, `application_subcategories` for display names
- Include a count of linked documents per application (query `document_template_applications` grouped by `visa_type_id`)
- Each row is clickable -- clicking sets `visaTypeId` and switches to detail mode

**Mode 2 -- Document Detail (when an application is selected)**
- Show a back button/breadcrumb to return to the list
- Display the selected application name prominently
- Keep the existing linked documents table, Add Documents dialog, and Remove functionality exactly as-is

### Technical details
- Add a `visaTypeId` state that toggles between list mode (empty) and detail mode (set)
- Fetch visa_types with joins: `visa_types(id, name, code, countries(name), application_categories(name), application_subcategories(name))`
- For doc counts, query `document_template_applications` and aggregate client-side, or use a separate count query
- Filters apply to the visa_types list query
- No database changes needed

