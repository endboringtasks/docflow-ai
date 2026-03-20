

## Make EditDocumentSettingsDialog match the Document Checklist edit dialog

The current `EditDocumentSettingsDialog` has a condensed layout. It needs to match the richer form from the Document Checklist tab in `ReferenceData.tsx` (lines 2810-3175).

### Changes to `src/components/admin/EditDocumentSettingsDialog.tsx`

**1. Show Category and Document Name (read-only)** at the top, matching the reference layout with two columns.

**2. Add Sort Order + Country row** -- Sort Order as number input, Country as read-only display (since it's already determined by the visa type context). Keep Sort Order editable.

**3. Restructure Applicant Type + Age Condition** into a 2-column row with:
- Applicant Type: use "No specific type" as the none label (instead of "All")
- Age Condition: placeholder "e.g., +16yrs, Under 18"

**4. Add Min Files / Max Files** in a 2-column row with helper text underneath each:
- "Minimum number of files clients must upload"
- "Maximum number of files clients can upload"

**5. Requirement Type** as a full-width select with dynamic helper text:
- required: "Document is mandatory for all applications"
- conditional: "Document is only required in specific situations"
- optional: "Document is not required but may support the application"

**6. Add conditional Applicability Condition section** -- when requirement_type is "conditional", show a highlighted box with preset condition options (same list from ReferenceData: "If previously married", "If divorced", etc.) plus custom option.

**7. Requires Translation toggle + expanded translation section** matching reference:
- Translation Requirements header with Languages icon
- Target Language as a Select with common languages (not just a text input)
- Certification Type dropdown
- Translation Notes textarea with helper text

### No new files needed
Only modifying `src/components/admin/EditDocumentSettingsDialog.tsx`.

