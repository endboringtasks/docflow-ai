-- Update the existing webhook to use application.* events
UPDATE platform_webhooks 
SET events = ARRAY['application.created', 'application.updated', 'application.deleted']
WHERE id = '3173dc7e-d2f7-4830-91a3-5bb56b30a920';