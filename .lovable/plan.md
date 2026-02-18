

## Fix: "Failed to delete client" foreign key constraint error

### Problem
When deleting a client, the operation fails because the `document_checklist` table has a foreign key `uploaded_by_client` referencing `clients(id)` with no cascade rule (defaults to RESTRICT). If any document checklist row references this client via `uploaded_by_client`, the delete is blocked.

### Solution
Create a database migration to alter the foreign key constraint on `document_checklist.uploaded_by_client` to use `ON DELETE SET NULL`. This means when a client is deleted, any document checklist rows that reference that client will simply have their `uploaded_by_client` column set to NULL instead of blocking the delete.

Similarly, the `document_attachment_history.uploaded_by_client` column likely has the same issue and should also be updated.

### Technical Details

**Migration SQL:**
- Drop the existing foreign key constraint `document_checklist_uploaded_by_client_fkey`
- Re-add it with `ON DELETE SET NULL`
- Do the same for `document_attachment_history` if it has a similar constraint

**File changes:**
- 1 new migration file in `supabase/migrations/`

No frontend code changes are needed -- the delete logic in `src/pages/migration/Clients.tsx` is already correct.

