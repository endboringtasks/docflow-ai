-- Add first_name and last_name columns to clients table
ALTER TABLE public.clients 
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Migrate existing full_name data to first_name (treating full_name as first_name for now)
UPDATE public.clients 
SET first_name = split_part(full_name, ' ', 1),
    last_name = CASE 
      WHEN position(' ' in full_name) > 0 
      THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE NULL 
    END;

-- Make first_name NOT NULL after migration
ALTER TABLE public.clients 
ALTER COLUMN first_name SET NOT NULL;

-- Drop the old full_name column
ALTER TABLE public.clients 
DROP COLUMN full_name;