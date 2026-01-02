-- Drop the old foreign key constraint that blocks deletion
ALTER TABLE document_checklist_templates
DROP CONSTRAINT IF EXISTS document_checklist_templates_visa_type_id_fkey;

-- Add cascade delete to document_template_applications so deleting a visa_type removes its links
ALTER TABLE document_template_applications
DROP CONSTRAINT IF EXISTS document_template_applications_visa_type_id_fkey;

ALTER TABLE document_template_applications
ADD CONSTRAINT document_template_applications_visa_type_id_fkey
FOREIGN KEY (visa_type_id) REFERENCES visa_types(id) ON DELETE CASCADE;

-- Clean up legacy visa_type_id data in templates since we now use the junction table
UPDATE document_checklist_templates SET visa_type_id = NULL WHERE visa_type_id IS NOT NULL;