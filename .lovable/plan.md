

## Hide Download & Review Buttons for Deleted Documents

**File: `src/components/visa-application/DocumentHistorySection.tsx`**

Since deleted files no longer exist (per CDR compliance), the Download and Review buttons are non-functional for entries with `archived_reason === 'client_deleted'`. We'll conditionally hide them.

**Change:** Wrap the button container (lines 223-253) in a condition so it only renders when `entry.archived_reason !== 'client_deleted'`.

