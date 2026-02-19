UPDATE clients c
SET google_drive_connection_id = gdc.id
FROM google_drive_connections gdc
WHERE c.company_id = gdc.company_id
  AND c.client_folder_id IS NOT NULL
  AND c.google_drive_connection_id IS NULL;