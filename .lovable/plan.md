

## Add Inline Editing for Document Settings in Application Checklist Detail View

### What changes
When viewing a linked document in the Application Checklist detail view (Step 2), clicking a document row will open an **Edit Document Settings** dialog where admins can modify template-level properties for that specific document.

### File: `src/components/admin/ApplicationChecklistTab.tsx`

**1. Expand the linked docs query** to fetch all editable fields from `document_checklist_templates`:
- Add: `age_condition`, `min_files`, `max_files`, `requires_translation`, `translation_target_language`, `translation_certification_type_id`, `translation_notes`, `applicability_condition`, `sort_order`

**2. Add an Edit Dialog** with form fields for:
- **Applicant Type** -- Select dropdown from `applicant_types` table (or "All")
- **Requirement Type** -- Select: required, conditional, optional
- **Age Condition** -- Text input (e.g., "under_18", "over_18")
- **Applicability Condition** -- Text input for conditional logic
- **Min Files / Max Files** -- Number inputs
- **Requires Translation** -- Checkbox/switch
- **Translation Target Language** -- Text input (shown when translation enabled)
- **Translation Certification Type** -- Select from `translation_certification_types` table (shown when translation enabled)
- **Translation Notes** -- Textarea (shown when translation enabled)

**3. Add an update mutation** that updates the `document_checklist_templates` row by its `id` with the edited fields.

**4. Wire up row click** -- clicking a document row (not the checkbox) opens the edit dialog pre-populated with current values.

**5. Fetch `translation_certification_types`** for the certification type dropdown.

### No database changes needed
All fields already exist on `document_checklist_templates`. Platform admin RLS policy already allows full management.

