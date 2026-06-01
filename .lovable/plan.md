## Goal

Fix the "Cannot coerce the result to a single JSON object" error when a company user edits a document's description/instructions on the migration **Document Checklist** page. Implement **copy-on-write**: editing a shared/global document creates (or updates) a company-specific copy that only affects this company; the global catalog stays untouched.

## Root cause

The documents shown on this page are **global templates** (`document_checklist_templates.company_id IS NULL`), linked to a visa type via `document_template_applications`. The RLS update policy only allows a company admin to modify rows where `company_id` is their own company. So updating a global template affects **0 rows**, and the `.select().single()` after the update throws the coerce error.

## Solution (frontend only — no DB migration)

All changes are in `src/pages/migration/DocumentChecklist.tsx`.

### 1. Listing: merge global templates with company overrides

The templates query currently fetches only the global templates linked through the junction table. Extend it to also fetch the company's own templates for the same visa type:

```text
- global = templates linked via document_template_applications (company_id NULL)
- overrides = document_checklist_templates where company_id = currentCompany.id
              AND visa_type_id = selectedApplicationType
- merge: for each global template, if a company override matches it
  (by document_definition_id when present, else by category + document_name),
  show the override instead of the global row.
- also include any override that has no matching global (company-added docs).
```

Each row carries its real `id` and `company_id` so the edit handler knows whether it is editing a global or a company-owned row.

### 2. Edit: copy-on-write in `updateDocMutation`

Replace the single hard update with this logic:

```text
if (editing row.company_id === currentCompany.id):
    UPDATE that row directly (works under RLS)
else (global row, company_id is null):
    look for an existing company override
      (company_id = currentCompany, matching document_definition_id
       or category + document_name, visa_type_id = selectedApplicationType)
    if found  -> UPDATE that override
    if not    -> INSERT a new company copy carrying over ALL fields from the
                 global template (document_definition_id, visa_type_id,
                 country_id, applicant_type_id, requirement/min/max, translation
                 fields, sort_order, etc.) plus the edited
                 category / document_name / description / instructions /
                 age_condition / is_required / requires_translation
```

Use `.maybeSingle()` (not `.single()`) on the returning select and surface a clear toast if nothing comes back, per the single-query guidance.

The existing description-sync RPC (`sync_template_description_to_checklists`, keyed on company_id + document_name + category) continues to work because the override row's `company_id` is the current company.

### 3. New applications must respect overrides

In `src/pages/migration/ApplicationDetail.tsx`, the two checklist-generation paths (around lines 757–791 and 1254–1266) build the document checklist from junction-linked global templates only. Apply the same merge as step 1: when a company override exists for a document, use the override's values (description, instructions, requirement, etc.) instead of the global template's, so the customization reaches real client applications.

## Out of scope

- No database/RLS migration (company users already have insert/update rights on their own `company_id` templates).
- No change to how global templates are managed by platform admins in the admin panel.
- Removing/deleting global documents from a company checklist (separate concern).

## Notes

- There is no unique constraint on `(company_id, category, document_name)`, so the code explicitly checks for an existing override before inserting to avoid duplicates.
- Matching key preference: `document_definition_id` first (most reliable), then `category + document_name`.
