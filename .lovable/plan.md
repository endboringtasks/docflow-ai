# Speed up Client & Application deletion

## Problem
When deleting a client or application, the confirmation dialog closes quickly, but the row lingers in the list for several seconds before disappearing.

Cause: the delete `mutationFn` only resolves (and the list is only refreshed) after it `await`s the Make.com webhook round-trips that run **after** the database delete:
- **Clients** (`Clients.tsx`, `deleteClientMutation`): awaits `google-drive-rename-folder` (renames the Drive folder with a `DELETED_` prefix) **and** `dispatch-webhook` (`client.deleted`).
- **Applications** (`Applications.tsx`, `deleteApplicationMutation`): awaits `dispatch-webhook` (`application.deleted`).

The row only leaves the list when `onSuccess` runs `queryClient.invalidateQueries(...)`, which is blocked until those webhook calls finish (~3–4s each, as seen in the edge logs).

## Goal
The row should disappear from the list immediately after the database delete succeeds, while the Drive folder rename and webhook notifications continue in the background.

## Approach
The actual `DELETE` against the database is fast. Keep awaiting only that, then fire the webhook/rename calls as non-blocking background work and refresh the list right away.

### Clients — `src/pages/migration/Clients.tsx` (`deleteClientMutation`, ~lines 272–341)
- In `mutationFn`: keep the awaited `supabase.from("clients").delete()`.
- Move the `google-drive-rename-folder` invoke and the `dispatch-webhook` (`client.deleted`) invoke to **fire-and-forget** (no `await`, each with a `.catch()` that logs). Trigger them after the delete succeeds.
- Return immediately so `onSuccess` runs without waiting for Make.com.
- Keep the existing success toast wording; since the rename now runs in the background, simplify to a single "Client deleted successfully" toast (the previous toast depended on awaiting the rename result).

### Applications — `src/pages/migration/Applications.tsx` (`deleteApplicationMutation`, ~lines 599–645)
- In `mutationFn`: keep the awaited `supabase.from("visa_applications").delete()`.
- Move the `dispatch-webhook` (`application.deleted`) invoke to **fire-and-forget** (no `await`, with `.catch()` logging).
- Return immediately so `onSuccess` refreshes the list and closes the dialog without waiting.

## What stays the same
- No database, RLS, or edge-function changes.
- The Drive folder is still renamed with the `DELETED_` prefix and the `*.deleted` webhooks are still dispatched — just in the background.
- `onSuccess` still invalidates queries and clears the dialog/selection state.

## Technical notes
- A fire-and-forget `fetch` started by `supabase.functions.invoke` continues after the dialog closes (it is not tied to the component lifecycle), so the rename/webhook still complete.
- If a background webhook fails, it is logged via `.catch()` exactly as the current `try/catch` does today; deletion is not affected.
