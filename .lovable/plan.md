# Show the Notification Bell

## Problem
The `NotificationBell` component (`src/components/notifications/NotificationBell.tsx`) is fully built — it polls the `notifications` table every 30s, shows an unread badge, and navigates to the application on click. However, it is **never imported or rendered anywhere** in the app. That's why no bell appears and submission notifications are invisible.

## Fix
Add `NotificationBell` to `AppLayout` (`src/components/layout/AppLayout.tsx`), which wraps all authenticated migration/audit/HR pages.

Specifically:
1. Import `NotificationBell`.
2. Place it in the **desktop header** (currently only contains `ThemeToggle`), to the left of the theme toggle.
3. Place it in the **mobile header** as well, next to the theme toggle.

## Result
- The bell appears in the top bar on every authenticated page.
- Unread count badge shows incoming `client_submission` notifications.
- Clicking a notification marks it read and navigates to `/app/migration/applications/{visa_application_id}`.

## Notes
- No backend/database changes required — notifications are already created by the `client-portal-submit` edge function and RLS already lets users read their own rows.
- Purely a presentation change in `AppLayout.tsx`.
