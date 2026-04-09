

## Merge Document Description + Instructions in Client Portal

### Problem
The client portal only shows the `description` field from `document_checklist`. The user wants it to display a **combination** of two fields:
1. **"Description"** — from the master Document List (`document_definitions.description`)
2. **"Description / Instructions"** — template-specific instructions set in the Application Checklist

Currently `document_checklist_templates.description` is synced from `document_definitions.description` (they're the same). There is no separate instructions field.

### Solution
Add a new `instructions` column to hold template-specific guidance, independent from the definition description. The client portal will merge both.

### Changes

#### 1. Database Migration
- Add `instructions TEXT` column to `document_checklist_templates`
- Add `instructions TEXT` column to `document_checklist`

#### 2. `EditDocumentSettingsDialog.tsx` — Add instructions field
- Add `instructions` state and input (Textarea) to the dialog, below the existing fields
- Include `instructions` in the update mutation
- Update the `DocumentTemplate` interface to include `instructions`

#### 3. `ApplicationDetail.tsx` — Copy instructions during initialization
- When creating checklist items from templates, set `instructions: template.instructions || null`
- Ensure the definition description goes into `description` (existing behavior)

#### 4. `get_portal_documents` SQL function — Return instructions
- Add `dc.instructions` to the SELECT list

#### 5. `ClientPortal.tsx` — Display merged text
- Update `DocumentItem` interface to include `instructions`
- In the description display area (~line 1245), merge both: show `description` followed by `instructions` (with a line break separator if both exist)

#### 6. `ApplicationChecklistTab.tsx` — Show instructions in linked docs table
- Display instructions column or indicator so admins can see which templates have instructions set

### Technical Notes
- The existing `sync_definition_description_to_all` function continues to sync `description` from definitions to templates/checklists (unchanged)
- `instructions` is a completely independent field managed only at the template level
- No data migration needed — the new field starts as NULL everywhere

