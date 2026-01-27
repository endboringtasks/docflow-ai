-- Fix document_checklist unique index to match ON CONFLICT specification
-- The app uses: onConflict: "visa_application_id,document_name,applicant_type,age_condition"
-- Previous index used COALESCE expressions which don't satisfy ON CONFLICT on plain columns

-- Step 1: Safe dedupe - reassign attachments and delete duplicate rows
-- For each duplicate group, keep the row with most attachments, then completed, then newest
WITH duplicates AS (
  SELECT 
    id,
    visa_application_id,
    document_name,
    applicant_type,
    age_condition,
    is_completed,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY visa_application_id, document_name, applicant_type, age_condition
      ORDER BY 
        (SELECT COUNT(*) FROM public.document_attachments da WHERE da.document_checklist_id = dc.id) DESC,
        is_completed DESC,
        created_at DESC
    ) as rn
  FROM public.document_checklist dc
),
winners AS (
  SELECT id as winner_id, visa_application_id, document_name, applicant_type, age_condition
  FROM duplicates WHERE rn = 1
),
losers AS (
  SELECT d.id as loser_id, w.winner_id
  FROM duplicates d
  JOIN winners w ON 
    d.visa_application_id IS NOT DISTINCT FROM w.visa_application_id
    AND d.document_name IS NOT DISTINCT FROM w.document_name
    AND d.applicant_type IS NOT DISTINCT FROM w.applicant_type
    AND d.age_condition IS NOT DISTINCT FROM w.age_condition
  WHERE d.rn > 1
)
-- Reassign attachments from loser rows to winner rows
UPDATE public.document_attachments da
SET document_checklist_id = l.winner_id
FROM losers l
WHERE da.document_checklist_id = l.loser_id;

-- Delete the duplicate (loser) rows
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY visa_application_id, document_name, applicant_type, age_condition
      ORDER BY 
        (SELECT COUNT(*) FROM public.document_attachments da WHERE da.document_checklist_id = dc.id) DESC,
        is_completed DESC,
        created_at DESC
    ) as rn
  FROM public.document_checklist dc
)
DELETE FROM public.document_checklist
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Drop the old expression-based index
DROP INDEX IF EXISTS public.idx_document_checklist_unique_doc;

-- Step 3: Create the correct unique index with NULLS NOT DISTINCT
-- This matches the ON CONFLICT specification exactly
CREATE UNIQUE INDEX idx_document_checklist_unique_doc 
ON public.document_checklist (visa_application_id, document_name, applicant_type, age_condition)
NULLS NOT DISTINCT;