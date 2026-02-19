
-- Add google_drive_connection_id to clients
ALTER TABLE public.clients
ADD COLUMN google_drive_connection_id uuid REFERENCES public.google_drive_connections(id) ON DELETE SET NULL;

-- Add google_drive_connection_id to visa_applications
ALTER TABLE public.visa_applications
ADD COLUMN google_drive_connection_id uuid REFERENCES public.google_drive_connections(id) ON DELETE SET NULL;

-- Immutability trigger for clients: prevent changing google_drive_connection_id or client_folder_id once set
CREATE OR REPLACE FUNCTION public.prevent_client_drive_rebind()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing google_drive_connection_id from one non-null value to another non-null value
  IF OLD.google_drive_connection_id IS NOT NULL 
     AND NEW.google_drive_connection_id IS NOT NULL 
     AND OLD.google_drive_connection_id IS DISTINCT FROM NEW.google_drive_connection_id THEN
    RAISE EXCEPTION 'Google Drive binding is immutable once set and cannot be changed to a different connection.';
  END IF;

  -- Prevent changing client_folder_id from one non-null value to another non-null value
  IF OLD.client_folder_id IS NOT NULL 
     AND NEW.client_folder_id IS NOT NULL 
     AND OLD.client_folder_id IS DISTINCT FROM NEW.client_folder_id THEN
    RAISE EXCEPTION 'Client folder ID is immutable once set and cannot be changed.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prevent_client_drive_rebind
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_drive_rebind();

-- Immutability trigger for visa_applications: prevent changing google_drive_connection_id once set
CREATE OR REPLACE FUNCTION public.prevent_application_drive_rebind()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.google_drive_connection_id IS NOT NULL 
     AND NEW.google_drive_connection_id IS NOT NULL 
     AND OLD.google_drive_connection_id IS DISTINCT FROM NEW.google_drive_connection_id THEN
    RAISE EXCEPTION 'Application Drive binding is immutable once set and cannot be changed to a different connection.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prevent_application_drive_rebind
BEFORE UPDATE ON public.visa_applications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_application_drive_rebind();

-- Auto-populate trigger: when inserting a visa_application, inherit google_drive_connection_id from the client
CREATE OR REPLACE FUNCTION public.validate_application_drive_binding()
RETURNS TRIGGER AS $$
DECLARE
  v_client_drive_connection_id uuid;
BEGIN
  -- Look up the client's google_drive_connection_id
  SELECT google_drive_connection_id INTO v_client_drive_connection_id
  FROM public.clients
  WHERE id = NEW.client_id;

  -- If the client has a Drive binding, auto-populate it on the application
  IF v_client_drive_connection_id IS NOT NULL THEN
    NEW.google_drive_connection_id := v_client_drive_connection_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_application_drive_binding
BEFORE INSERT ON public.visa_applications
FOR EACH ROW
EXECUTE FUNCTION public.validate_application_drive_binding();
