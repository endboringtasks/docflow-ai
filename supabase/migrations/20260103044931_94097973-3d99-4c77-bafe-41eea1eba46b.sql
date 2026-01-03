-- Add requires_translation to document_checklist_templates
ALTER TABLE public.document_checklist_templates
ADD COLUMN requires_translation boolean NOT NULL DEFAULT false;

-- Add requires_translation and translation_of_id to document_checklist
ALTER TABLE public.document_checklist
ADD COLUMN requires_translation boolean NOT NULL DEFAULT false,
ADD COLUMN translation_of_id uuid REFERENCES public.document_checklist(id) ON DELETE CASCADE;

-- Create index for efficient lookups of translation documents
CREATE INDEX idx_document_checklist_translation_of_id ON public.document_checklist(translation_of_id) WHERE translation_of_id IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.document_checklist.translation_of_id IS 'References the original document this is a translation of';
COMMENT ON COLUMN public.document_checklist.requires_translation IS 'Whether this document requires a separate translated version';
COMMENT ON COLUMN public.document_checklist_templates.requires_translation IS 'Whether documents from this template require a separate translated version';