-- Rename drive_folder_id to visa_application_folder_id in matters table
ALTER TABLE public.matters 
RENAME COLUMN drive_folder_id TO visa_application_folder_id;