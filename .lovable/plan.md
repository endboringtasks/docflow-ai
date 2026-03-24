

## Remove Circle Icons and Fix Document Name Color in Client Portal

### Problem
The client portal shows circle/checkmark icons next to document names and turns completed document names green, which is inconsistent with the agent's application view.

### Changes

**File: `src/pages/client-portal/ClientPortal.tsx`**

1. **Remove the circle icon block** (~lines 1155-1161): Delete the `<div className="flex-shrink-0">` block containing `CheckCircle2` and `Circle` icons.

2. **Remove green text color from document name** (~line 1164): Change:
   ```typescript
   <p className={`font-medium text-sm ${doc.is_completed ? "text-green-700 dark:text-green-400" : ""}`}>
   ```
   To:
   ```typescript
   <p className="font-medium text-sm">
   ```

These two changes align the client portal document rows with the agent's application view — no leading circle icons, and document names use the default foreground color regardless of completion status. The status badges (In Review, Approved, Rejected) already communicate the document state.

