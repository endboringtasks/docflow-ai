-- Drop the existing constraint
ALTER TABLE category_applicant_types 
DROP CONSTRAINT category_applicant_types_category_id_applicant_type_id_key;

-- Add new constraint including subcategory_id
ALTER TABLE category_applicant_types 
ADD CONSTRAINT category_applicant_types_category_subcategory_applicant_key 
UNIQUE (category_id, subcategory_id, applicant_type_id);