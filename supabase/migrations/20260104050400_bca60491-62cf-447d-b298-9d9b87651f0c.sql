-- Create enum type for document requirement status
CREATE TYPE public.document_requirement_type AS ENUM ('required', 'conditional', 'optional');

-- Update document_checklist_templates table
ALTER TABLE public.document_checklist_templates
ADD COLUMN requirement_type public.document_requirement_type NOT NULL DEFAULT 'required',
ADD COLUMN applicability_condition TEXT;

-- Migrate existing data in templates
UPDATE public.document_checklist_templates
SET requirement_type = CASE 
  WHEN is_required = true THEN 'required'::public.document_requirement_type
  ELSE 'optional'::public.document_requirement_type
END;

-- Update document_checklist table
ALTER TABLE public.document_checklist
ADD COLUMN requirement_type public.document_requirement_type NOT NULL DEFAULT 'required',
ADD COLUMN applicability_condition TEXT,
ADD COLUMN is_applicable BOOLEAN NOT NULL DEFAULT true;

-- Add comment explaining the columns
COMMENT ON COLUMN public.document_checklist_templates.requirement_type IS 'Document requirement status: required, conditional (if applicable), or optional';
COMMENT ON COLUMN public.document_checklist_templates.applicability_condition IS 'Explains when a conditional document is needed, e.g., "If previously married"';
COMMENT ON COLUMN public.document_checklist.is_applicable IS 'Staff can mark conditional documents as not applicable for specific cases';