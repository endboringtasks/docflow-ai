
Goal
- Fix “Couldn't generate document checklist” when creating/viewing a new application by making the database’s unique index match the `onConflict: "visa_application_id,document_name,applicant_type,age_condition"` used by the frontend.

What I found (root cause)
- The app uses `upsert(..., { onConflict: "visa_application_id,document_name,applicant_type,age_condition" })`.
- The database currently has this unique index:
  - `idx_document_checklist_unique_doc (visa_application_id, document_name, COALESCE(applicant_type,''), COALESCE(age_condition,''))`
- Postgres requires the `ON CONFLICT (col1, col2, ...)` target to match a UNIQUE constraint/index on those exact columns (not expressions).
- So the error persists even though an index exists, because it’s an expression index and does not satisfy the ON CONFLICT spec.

Solution approach
- Replace the expression-based unique index with a proper unique index on the exact columns:
  - `(visa_application_id, document_name, applicant_type, age_condition)`
- Because `applicant_type` and `age_condition` can be NULL, we will use Postgres’s `NULLS NOT DISTINCT` so NULLs are treated as equal (prevents duplicates even when those fields are NULL) and still matches the ON CONFLICT column list.
  - Your DB is Postgres 17.6, so `NULLS NOT DISTINCT` is supported.

Implementation steps (DB migration)
1) Safety dedupe (data-preserving)
   - Before creating the new unique index, run a “safe dedupe” that:
     - For any duplicate groups by (visa_application_id, document_name, applicant_type, age_condition):
       - Pick a single “winner” row to keep (prefer rows with more attachments, then completed, then newest).
       - Re-point any attachments from losing rows to the winner row (so we don’t delete user uploads).
       - Delete the losing duplicate rows.
   - This step should be idempotent and safe even if there are currently no duplicates.

2) Drop the current (wrong-shape) index
   - `DROP INDEX IF EXISTS public.idx_document_checklist_unique_doc;`

3) Create the correct unique index that matches the app’s ON CONFLICT clause
   - `CREATE UNIQUE INDEX idx_document_checklist_unique_doc`
     `ON public.document_checklist (visa_application_id, document_name, applicant_type, age_condition)`
     `NULLS NOT DISTINCT;`

Frontend/code changes
- No frontend changes should be required for this specific error, because the code already uses the correct column list; the database just needs a matching unique index.
- (Optional follow-up) Add a clearer error message if initialization fails, but not necessary once the DB is fixed.

Verification checklist
1) Create a new application.
2) Navigate to its detail page (the checklist initialization runs there).
3) Confirm:
   - No “Couldn't generate document checklist” toast.
   - Rows are inserted into `public.document_checklist` for that application.
4) (Optional) Re-test “delete + recreate application” flow.

Risk/notes
- The earlier migration used `COALESCE(...)` in the index. That shape cannot be used by `ON CONFLICT (visa_application_id, document_name, applicant_type, age_condition)`.
- The new migration will correct the index shape and should immediately unblock checklist generation across all environments using this same database.
