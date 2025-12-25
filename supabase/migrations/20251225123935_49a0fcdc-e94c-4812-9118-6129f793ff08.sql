-- Populate visa_document_templates from existing document_checklist data
-- Parse the format [Category:required] Document Name

INSERT INTO visa_document_templates (company_id, visa_subclass, category, document_name, is_required, sort_order)
SELECT DISTINCT 
  m.company_id,
  m.visa_subclass,
  -- Extract category from [Category:required] format
  INITCAP(SUBSTRING(dc.document_name FROM '\[([^:]+):')) as category,
  -- Extract document name after the ] 
  TRIM(SUBSTRING(dc.document_name FROM '\] (.+)$')) as document_name,
  -- Check if it says 'required' in the bracket
  CASE WHEN dc.document_name LIKE '%:required]%' THEN true ELSE false END as is_required,
  0 as sort_order
FROM document_checklist dc
JOIN matters m ON dc.matter_id = m.id
WHERE m.visa_subclass IS NOT NULL
  AND dc.document_name LIKE '[%]%'
ON CONFLICT DO NOTHING;