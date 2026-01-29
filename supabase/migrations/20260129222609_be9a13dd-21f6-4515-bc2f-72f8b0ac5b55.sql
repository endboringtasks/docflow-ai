-- Add date of birth, passport number, and nationality columns to clients table
ALTER TABLE public.clients
ADD COLUMN date_of_birth date,
ADD COLUMN passport_number text,
ADD COLUMN nationality text;