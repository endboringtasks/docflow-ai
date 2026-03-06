

## Analysis: Splitting into "Documents List" + "Document Checklist"

### Current Problem

The `document_checklist_templates` table and the company-level Document Checklist page mix two concerns:
- **Document identity**: category, name, description/instructions (the "what")
- **Application rules**: country, visa type, applicant type, requirement type, translation settings, min/max files, age conditions (the "where/how")

This causes duplication -- "Passport (certified copy)" with the same description appears in multiple templates for different visa types. The `sync_template_description_to_checklists` function we just created helps, but it still requires the description to be consistent across templates manually.

The hardcoded `commonDocuments` map (lines 152-230 in `DocumentChecklist.tsx`) and `defaultCategories` (lines 135-149) further highlight this -- document definitions are scattered between code and database.

### Your Idea: Two-Level Architecture

**Level 1 — "Documents List"** (new `document_definitions` table)
- Master catalog: category, document_name, description
- One row per unique document concept
- Managed in the company-level Document Checklist page as a new tab
- Replaces the hardcoded `commonDocuments` and `defaultCategories`

**Level 2 — "Document Checklist"** (existing `document_checklist_templates`)
- References a `document_definition_id` instead of duplicating name/category/description
- Keeps: country, visa type, applicant type, requirement type, translation settings, min/max files, age condition, sort order

### Assessment

**Strengths:**
- Single source of truth for document descriptions -- update once, sync everywhere
- Cleaner separation of concerns
- The `sync_template_description_to_checklists` function becomes even more powerful: update a definition → sync to all templates → sync to all application checklists
- Eliminates hardcoded document lists in code
- Company-specific: each company can define their own document catalog

**Considerations:**
- The `document_definitions` table should be **per-company** (with `company_id`), not global, since each company may have different document names/descriptions
- Migration needs to deduplicate existing templates: extract unique (company_id, category, document_name, description) combinations into definitions, then link templates back
- The Document Checklist form changes from "type a name" to "pick from your Documents List", which is a better UX

### Proposed Changes

#### 1. Database
- New `document_definitions` table: `id, company_id, category, document_name, description, sort_order, is_active, created_at`
- RLS: company admins/owners can manage, company members can read
- Add `document_definition_id` (nullable FK) to `document_checklist_templates`
- Migration to backfill: extract distinct documents from existing templates into definitions, link back via FK
- Update `sync_template_description_to_checklists` to also pull from `document_definitions` when available

#### 2. New "Documents List" Tab (in company Document Checklist page)
- CRUD for document definitions: category (dropdown), name, description
- Table view with search/filter
- Pre-seed with current `commonDocuments` data on first use or via a "Load defaults" button

#### 3. Update "Document Checklist" Tab
- Document selection becomes a dropdown/combobox from the Documents List
- Selecting a document auto-fills category and description (read-only, inherited)
- All application-specific fields remain editable as today
- Allow "custom" documents not in the list (backward compatibility)

#### 4. Description Sync Enhancement
- When a document definition's description is updated, automatically sync to all templates referencing it, then to all application checklists via the existing `sync_template_description_to_checklists` function

#### 5. Application Initialization
- When creating checklists from templates, pull description from `document_definitions` (via template FK) as the snapshot
- Fallback to template's own description if no definition linked

### Scope Estimate
- 1 migration (table + backfill + RLS)
- 1 new UI tab component (~300 lines)
- Updates to Document Checklist template form (swap text inputs for dropdown)
- Updates to application initialization logic

