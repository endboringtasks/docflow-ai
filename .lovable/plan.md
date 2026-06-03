# Rename "Merge Templates" → "Sync Application Checklist" + 3 Sync Options

## Goal
On the Application Checklist tab (`src/pages/migration/ApplicationDetail.tsx`):

1. **Rename** the **Merge Templates** button to **Sync Application Checklist**.
2. When clicked, open a dialog offering three sync modes:
   - **Sync Application Checklist** — add missing template documents (current merge behavior).
   - **Sync Document Description** — update descriptions of documents already in the checklist to match their current template descriptions (no rows added/removed).
   - **Both** — run the merge, then sync descriptions.

## What changes (frontend only — one file)

### 1. Button (~line 2205-2217)
- Label "Merge Templates" → "Sync Application Checklist".
- Keep the icon and pending/spinner behavior.

### 2. Dialog (`isMergeOpen` AlertDialog, ~line 3045)
- Replace the single confirmation with a `RadioGroup` (`@/components/ui/radio-group`) showing the three options:
  - "Sync Application Checklist (add missing documents)"
  - "Sync Document Description (update existing descriptions)"
  - "Both"
- Default selection: **Both**.
- Title: "Sync Application Checklist". Update description copy to explain each mode.
- Keep Cancel; primary action button reads "Sync" and runs the selected mode.

### 3. New state
Add `syncMode` state (`"checklist" | "description" | "both"`) defaulting to `"both"`.

### 4. Reuse the template fetch
`mergeTemplatesMutation` already fetches resolved templates (global + company copy-on-write overrides) with `document_name`, `category`, `description`. Refactor so the same fetched list feeds both adding missing docs and syncing descriptions, then branch on `syncMode`.

### 5. Sync-descriptions logic
For each doc currently in `dbDocuments`, match to a template by comparing the parsed display name (`parseDocumentName(d.document_name).displayName`, lowercased/trimmed) against the template `document_name`. When matched and the description differs, update that checklist row's `description`. Skip translation rows (names containing "(Translation)").

```text
for each existing checklist doc:
  displayName = parseDocumentName(doc.document_name).displayName
  template = templateMap[displayName]
  if template && template.description !== doc.description:
    update document_checklist set description = template.description where id = doc.id
```

### 6. Result toast (by mode)
- checklist → "Added N documents"
- description → "Updated N descriptions"
- both → "Added N documents · Updated M descriptions"

Invalidate `["document-checklist", visaApplicationId]` on success (already done).

## Out of scope
- No database migration; descriptions are synced for the current application's `document_checklist` rows directly via client updates (same RLS the page already uses).
- No change to the template-editor sync RPC (`sync_template_description_to_checklists`) on `DocumentChecklist.tsx`.
- No change to how `document_name` is encoded/stored.

## Verification
Open an application's Application Checklist, click **Sync Application Checklist**, and for each option confirm:
- Checklist mode adds only missing docs.
- Description mode updates existing descriptions (a doc whose template description was edited shows new text) with no rows added.
- Both performs add + update and the toast reports correct counts.
