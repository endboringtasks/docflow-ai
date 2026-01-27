

# Fix: Missing Unique Constraint Causing Document Checklist Initialization Failure

## Problem Summary

When creating a new visa application, the error **"Couldn't generate document checklist"** appears. The database logs show:

> "there is no unique or exclusion constraint matching the ON CONFLICT specification"

## Root Cause

The code in `ApplicationDetail.tsx` uses Supabase's `upsert` with an `onConflict` clause:

```typescript
const onConflictCols = "visa_application_id,document_name,applicant_type,age_condition";

await supabase
  .from("document_checklist")
  .upsert(documentsToInsert, { 
    onConflict: onConflictCols,
    ignoreDuplicates: true 
  });
```

However, **there is no unique constraint** on these columns in the database. The only index on `document_checklist` is the primary key (`id`).

PostgreSQL requires a matching unique constraint to use `ON CONFLICT`. Without it, the upsert fails.

## Solution

Create the missing unique index on the `document_checklist` table. This must handle `NULL` values in `applicant_type` and `age_condition` using `COALESCE` or `NULLS NOT DISTINCT`.

### Database Migration

A new migration file will add the unique constraint:

```sql
-- Create unique index for idempotent document checklist upserts
-- Uses COALESCE to handle NULL values (PostgreSQL treats NULLs as distinct by default)
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_checklist_unique_doc 
ON public.document_checklist (
  visa_application_id, 
  document_name, 
  COALESCE(applicant_type, ''), 
  COALESCE(age_condition, '')
);
```

**Note**: Using `COALESCE` converts NULL to empty string for uniqueness comparison, so `NULL` and `''` will be treated as the same. This matches the application logic where these fields are optional.

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/[timestamp]_add_document_checklist_unique_constraint.sql` | Add unique index on `(visa_application_id, document_name, applicant_type, age_condition)` |

## Technical Notes

- The index uses `COALESCE` because PostgreSQL treats NULL values as distinct in unique constraints by default
- This enables the existing `upsert` logic with `ignoreDuplicates: true` to work correctly
- The index will also improve query performance for lookups by these columns

## After Implementation

1. The migration will run automatically when deployed
2. New applications will be created successfully
3. The translation document inheritance fix from the previous change will work correctly

## Verification

1. Create a new visa application
2. Confirm the document checklist is generated without errors
3. Verify that conditional documents (like Divorce Certificate) are marked N/A
4. Verify their translations are also marked N/A

