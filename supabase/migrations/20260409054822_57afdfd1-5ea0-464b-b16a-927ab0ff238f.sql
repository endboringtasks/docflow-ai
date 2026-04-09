-- Backfill document_checklist.description from document_definitions
-- Match by document_name (stripped of prefix) and category
UPDATE public.document_checklist dc
SET description = dd.description
FROM public.document_definitions dd
WHERE dc.description IS NULL
  AND dd.description IS NOT NULL
  AND dd.is_active = true
  AND dc.category = dd.category
  AND dc.document_name LIKE '%' || dd.document_name;