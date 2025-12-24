-- Make first_name nullable for corporate clients who use company_name instead
ALTER TABLE public.clients 
ALTER COLUMN first_name DROP NOT NULL;

-- Add company_name column for corporate clients
ALTER TABLE public.clients 
ADD COLUMN company_name text;

-- Migrate existing corporate clients: move first_name to company_name
UPDATE public.clients 
SET company_name = first_name, first_name = NULL 
WHERE client_type = 'corporate';