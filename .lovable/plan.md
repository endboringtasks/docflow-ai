## Remove "Category Rules" from Reference Data

Remove the Category Rules tab from the Reference Data admin page.

### Changes
In `src/pages/admin/ReferenceData.tsx`:
- Remove the `TabsTrigger` for `value="category-applicant-rules"` (the "Category Rules" tab, lines ~2143–2146).
- Remove the corresponding `TabsContent` block (lines ~2183–2185) that renders `<CategoryApplicantRulesTab />`.
- Remove the now-unused import of `CategoryApplicantRulesTab` (line 62).

### Notes
- This only hides the UI tab. The underlying component file (`CategoryApplicantRulesTab.tsx`) and database tables are left untouched, so the feature can be restored later if needed.
- No backend or data changes.
