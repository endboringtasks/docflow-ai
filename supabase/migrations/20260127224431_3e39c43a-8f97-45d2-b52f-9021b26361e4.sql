-- Step 1: Delete duplicate document_checklist rows, keeping only the most recent one per unique combination
-- First, delete any document_attachments for duplicates we're about to remove
DELETE FROM public.document_attachments
WHERE document_checklist_id IN (
  SELECT dc.id
  FROM public.document_checklist dc
  WHERE dc.id NOT IN (
    SELECT DISTINCT ON (visa_application_id, document_name, COALESCE(applicant_type, ''), COALESCE(age_condition, ''))
           id
    FROM public.document_checklist
    ORDER BY visa_application_id, document_name, COALESCE(applicant_type, ''), COALESCE(age_condition, ''), 
             is_completed DESC, -- Keep completed ones first
             created_at DESC    -- Then most recent
  )
);

-- Step 2: Delete the duplicate document_checklist rows themselves
DELETE FROM public.document_checklist
WHERE id NOT IN (
  SELECT DISTINCT ON (visa_application_id, document_name, COALESCE(applicant_type, ''), COALESCE(age_condition, ''))
         id
  FROM public.document_checklist
  ORDER BY visa_application_id, document_name, COALESCE(applicant_type, ''), COALESCE(age_condition, ''), 
           is_completed DESC, -- Keep completed ones first
           created_at DESC    -- Then most recent
);

-- Step 3: Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_checklist_unique_doc 
ON public.document_checklist (
  visa_application_id, 
  document_name, 
  COALESCE(applicant_type, ''), 
  COALESCE(age_condition, '')
);