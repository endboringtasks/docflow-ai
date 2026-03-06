

## Documents List + Document Checklist Split (Completed)

### What Changed

**New `document_definitions` table** — master catalog of documents per company with category, name, and description. Unique constraint on (company_id, category, document_name).

**New `document_definition_id` FK** on `document_checklist_templates` — links templates to definitions for single-source-of-truth descriptions.

**Migration backfill** — existing templates were deduplicated into definitions and linked back.

**New `sync_definition_description_to_all` DB function** — when a definition's description changes, it propagates to all linked templates AND all matching application checklists.

**New "Documents List" tab** in Document Checklist page — CRUD for document definitions with search/filter by category.

**Updated "Document Checklist" tab** — add/edit dialogs now show "Your Documents" from definitions first, then "Common Documents" as fallback, with custom entry still allowed. Selecting a definition auto-fills description.
