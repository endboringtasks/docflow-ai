-- Update the Application webhook to use application.* events
UPDATE platform_webhooks 
SET events = ARRAY['application.created', 'application.updated', 'application.deleted']
WHERE id = 'fd18e532-f9be-480c-bae4-cc1ee9df98a6';