## Goal

Today the document categories you see in the "All Categories" dropdown (Identity, Character, Health, Employment…) are **not a managed entity**. They live as free-text in the `category` column on each document, mixed with a hardcoded list in code. There's no way to rename or delete a category. We'll make document categories a proper **global, managed list** with add / rename / delete.

## What will be built

A new **"Document Categories"** tab in Reference Data (admin) where platform admins can:

- **Add** a category (name, optional sort order, active toggle).
- **Edit / rename** a category — renaming re-labels every document that currently uses the old name so nothing is orphaned.
- **Delete** a category — blocked with a clear message if any document still uses it (admin must reassign first), keeping the enterprise/compliance tone.

The Master Documents list dropdown and the "Add/Edit document" category picker will read from this managed list instead of the hardcoded array.

## Where categories are used today (text columns)

The `category` value appears as free text in three tables:

- `document_definitions.category` — the master catalog (the screenshot list)
- `document_checklist_templates.category` — application templates
- `document_checklist.category` — per-application checklist items

A rename must update all three so labels stay consistent across the app.

## Technical plan

### 1. Database (migration)

Create a global `document_categories` table (no `company_id` — shared across all companies):

````text
document_categories
  id           uuid pk
  name         text  (unique, the label shown everywhere)
  sort_order   integer default 0
  is_active    boolean default true
  created_at / updated_at
````

- GRANTs: `SELECT` to anon + authenticated; full to service_role.
- RLS: everyone can read (`true`); only `is_platform_admin(auth.uid())` can insert/update/delete (mirrors `countries` / `applicant_types`).
- Seed it with the current default categories plus any distinct `category` values already present in `document_definitions`.

A rename helper (security-definer function or a single transactional update) will update `document_definitions`, `document_checklist_templates`, and `document_checklist` rows where `category = old_name` to the new name. A delete guard checks those same tables and refuses deletion when references remain.

### 2. Admin UI

- Add a **"Document Categories"** tab to `src/pages/admin/ReferenceData.tsx` (new component, e.g. `DocumentCategoriesTab.tsx`), following the existing tab pattern (table + Add dialog + Edit dialog + delete AlertDialog + `useTableSort`).
- Columns: Sort Order, Name, Status, Actions (edit / delete).
- Add/Edit dialog: name, sort order, active toggle.
- Delete: confirmation; if the category is still in use, show how many documents use it and block until reassigned.

### 3. Wire the document picker to the managed list

- In `src/components/admin/AdminDocumentsListTab.tsx`, replace the hardcoded `defaultCategories` array and the "derive from existing definitions" logic with a query of active `document_categories` (ordered by sort_order, then name).
- Keep the "custom category" entry option, but creating a brand-new custom name will also insert it into `document_categories` so it becomes managed going forward.

## Notes

- Global scope as requested — one shared category list for all companies.
- Additive and backward-compatible: existing free-text values are migrated into the table, so nothing breaks.
- After the migration runs, the Supabase types file regenerates before the UI code is wired up.
