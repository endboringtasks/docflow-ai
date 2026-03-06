

## Sync Template Description Changes to Application Checklists

### Context

When a user updates a document description in the Document Checklist templates (Reference Data), the change only affects `document_checklist_templates`. Existing `document_checklist` rows in applications keep their original snapshot. The user wants description updates to propagate to all matching application checklist items.

### Approach

When a template description is updated, also update all `document_checklist` rows that were created from that template. Since there's no FK linking `document_checklist` back to `document_checklist_templates`, we match by `company_id` + `document_name` + `category`.

### Changes

**1. Database function** (migration)

Create a `sync_template_description_to_checklists` function that takes a company_id, document_name, category, and new description, then updates all matching `document_checklist` rows:

```sql
CREATE OR REPLACE FUNCTION public.sync_template_description_to_checklists(
  p_company_id uuid,
  p_document_name text,
  p_category text,
  p_new_description text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE document_checklist
  SET description = p_new_description, updated_at = now()
  WHERE company_id = p_company_id
    AND document_name = p_document_name
    AND (category = p_category OR (category IS NULL AND p_category IS NULL));
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
```

**2. Update mutation in `DocumentChecklist.tsx`**

After successfully updating the template, call the sync function via `supabase.rpc('sync_template_description_to_checklists', ...)` to propagate the description to all existing application checklists. Show a toast indicating how many application documents were updated.

Only sync when the description actually changed (compare old vs new value).

### What This Does NOT Change

- Clients can still override descriptions per-application after sync
- If the template name/category changes, that's a different operation (not synced)
- No UI confirmation dialog needed -- syncing descriptions is the expected behavior per the user's request

