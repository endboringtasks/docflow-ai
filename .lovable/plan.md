

## High-Risk Disconnect Google Drive Confirmation Modal

### Overview
Replace the simple AlertDialog confirmation for disconnecting Google Drive with a comprehensive, enterprise-grade confirmation modal that communicates compliance, audit, and data traceability consequences.

### Changes

**File: `src/components/settings/GoogleDriveConnection.tsx`**

Replace the existing disconnect `AlertDialog` (lines 350-382) with a custom `Dialog` component that includes:

1. **Header** -- Red/destructive accent with `AlertTriangle` icon and title "Disconnect Google Drive Integration"

2. **Body** -- Formal, compliance-oriented content:
   - Opening statement about the action
   - Bulleted list of consequences (folder access loss, file upload inability, traceability loss, audit continuity interruption, compliance impact)
   - Bold "irreversible" warning
   - Note about reconnecting with a different account creating new folder structures

3. **Two mandatory confirmation controls:**
   - A required checkbox: "I understand that disconnecting Google Drive will permanently remove folder links and impact document traceability."
   - A text input requiring the user to type exactly `DISCONNECT` (case-sensitive)

4. **Footer buttons:**
   - Cancel (neutral/outline)
   - "Disconnect Integration" (destructive, disabled until both checkbox is checked AND input matches "DISCONNECT")

5. **Post-disconnect behavior (already exists, enhance toast message):**
   - Toast: "Google Drive integration has been disconnected."
   - Connection state set to `null`

**State additions:**
- `disconnectDialogOpen` (boolean)
- `disconnectCheckbox` (boolean) 
- `disconnectConfirmText` (string)

Reset checkbox and text input when dialog closes.

**New imports:** `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` from ui/dialog, `AlertTriangle` from lucide-react, `Checkbox` from ui/checkbox, `Input` from ui/input.

No database or edge function changes required.

