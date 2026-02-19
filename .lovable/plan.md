

## Enforce Immutable Google Drive Binding per Client

### Overview
Add a `google_drive_connection_id` column to both `clients` and `visa_applications` tables, enforce immutability at the database level, and update the UI to surface Drive binding status, warnings for mismatched/disconnected Drive accounts, and block actions when appropriate.

---

### 1. Database Migration

**Add columns and constraints:**

```text
clients.google_drive_connection_id (uuid, nullable, FK -> google_drive_connections.id ON DELETE SET NULL)
visa_applications.google_drive_connection_id (uuid, nullable, FK -> google_drive_connections.id ON DELETE SET NULL)
```

**Immutability triggers (DB-level enforcement):**

- `prevent_client_drive_rebind`: A BEFORE UPDATE trigger on `clients` that raises an exception if `google_drive_connection_id` is changed from a non-null value to a different value. Allows NULL -> value (initial binding) and value -> NULL (only via FK cascade on delete). Same for `client_folder_id`.
- `prevent_application_drive_rebind`: A BEFORE UPDATE trigger on `visa_applications` that raises an exception if `google_drive_connection_id` is changed from a non-null value to a different value.

**Application-level validation trigger:**

- `validate_application_drive_binding`: A BEFORE INSERT trigger on `visa_applications` that checks if the client has a `google_drive_connection_id` and, if so, copies it to the new application row automatically.

---

### 2. Edge Function Updates

**`webhook-client-folder/index.ts`:**
- After updating `client_folder_id`, also set `google_drive_connection_id` by looking up the current active `google_drive_connections` record for the company.

**`webhook-application-folder/index.ts`:**
- No changes needed; the DB trigger will auto-populate `google_drive_connection_id` on insert.

---

### 3. Frontend: Client Creation Flow

**`src/pages/migration/Clients.tsx` (createClientMutation):**
- When dispatching the client.created webhook and Drive is connected, pass the `google_drive_connection_id` (from `driveStatus`) in the webhook payload for traceability (optional, since binding happens in the webhook-client-folder callback).

**`src/pages/migration/Clients.tsx` (auto-create pending folders on reconnect):**
- Only trigger folder creation for clients whose `google_drive_connection_id` is NULL (never previously bound) or matches the current connection. Skip clients bound to a different (now-deleted) connection.

---

### 4. Frontend: Application Creation Flow

**`src/pages/migration/ClientDetail.tsx` and `src/pages/migration/Applications.tsx` (createApplicationMutation):**
- Before creating an application, check if the client has a `google_drive_connection_id`.
- If the client's `google_drive_connection_id` is set but does NOT match the current active `google_drive_connections` record for the company (or Drive is disconnected), block creation with error toast: "This client is linked to a previous Google Drive account that is no longer connected. Reconnect the original Drive account to continue."
- If the client has no `google_drive_connection_id` (never had a folder), allow creation normally.

---

### 5. Frontend: Client Detail Page UI

**`src/pages/migration/ClientDetail.tsx`:**
- Add a Drive connection status query (same pattern as Clients/Applications pages).
- In the client header info section (where Drive Folder is shown), add:
  - **Drive Account** (read-only): Show the `connected_email` from the `google_drive_connections` record matching the client's `google_drive_connection_id`. If the connection no longer exists, show a warning badge: "Linked to a disconnected Drive account".
- If client is bound to a disconnected Drive:
  - Show a warning banner at the top of the Applications section.
  - Disable the "Create Application" button with a tooltip explaining the mismatch.

---

### 6. Frontend: Applications List & Detail

**`src/pages/migration/Applications.tsx` and `ApplicationDetail.tsx`:**
- No additional changes beyond what was already implemented (Not Connected badge). The existing Drive status check already covers the disconnected state visually.

---

### 7. RPC / Query Updates

**New RPC function `get_client_drive_binding`** (optional optimization):
- Not strictly needed. The client query already returns all client fields. We can join `google_drive_connections` on the frontend or add `connected_email` to the `get_clients_secure` RPC.
- Simpler approach: query `google_drive_connections` by ID on the client detail page when `google_drive_connection_id` is present.

---

### Summary of Files to Change

| File | Change |
|---|---|
| **DB Migration** | Add columns, FK constraints, immutability triggers, auto-populate trigger |
| `supabase/functions/webhook-client-folder/index.ts` | Set `google_drive_connection_id` when folder is created |
| `src/pages/migration/Clients.tsx` | Filter reconnection auto-create by binding; pass connection ID |
| `src/pages/migration/ClientDetail.tsx` | Show Drive account email (read-only), warning badge, block app creation on mismatch |
| `src/pages/migration/Applications.tsx` | Validate Drive binding before application creation |

### What This Does NOT Include (Out of Scope)
- Drive migration tool
- Folder copy between Drives
- Retroactive reassignment of existing clients to current connection
- Editing Drive binding from the UI (explicitly prevented)

