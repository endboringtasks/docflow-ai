-- Update the existing webhook to use visa_application.* events instead of matter.*
UPDATE platform_webhooks 
SET events = ARRAY['visa_application.created', 'visa_application.updated', 'visa_application.deleted']
WHERE id = '3173dc7e-d2f7-4830-91a3-5bb56b30a920';