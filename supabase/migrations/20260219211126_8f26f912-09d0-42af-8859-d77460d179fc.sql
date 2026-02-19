-- Backfill drive_created_email and google_drive_connection_id for clients created before the fix
UPDATE clients 
SET 
  drive_created_email = 'anderson@endboringtasks.com',
  google_drive_connection_id = 'a4b835e8-254b-449d-9dfc-3b7c5635c81f'
WHERE id IN (
  '54479a7d-6346-4c17-a71f-ba422f678ef1',
  'cec07f6f-5bb8-4c25-bca3-4d95fed409eb'
)
AND drive_created_email IS NULL;