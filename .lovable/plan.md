
## Fix Duplicate Document Initialization Bug

### Root Cause

Documents are being initialized **twice** because there are two separate initialization paths:

1. **ClientDetail.tsx**: Inserts documents in the `onSuccess` handler of `createApplicationMutation` (lines 273-328)
2. **ApplicationDetail.tsx**: Has a `useEffect` that triggers `initializeDocumentsMutation` when `dbDocuments.length === 0` (lines 678-688)

**Race condition**: When navigating to ApplicationDetail after creating an application:
- The `useEffect` fires before the query cache has the documents
- The `documentsInitialized` state is `false` on each page mount
- Result: duplicate documents inserted

---

### Solution

**Single Source of Truth**: Remove the document initialization from ClientDetail.tsx and keep it only in ApplicationDetail.tsx with proper guards.

**Race Condition Prevention**: Replace `useState` with `useRef` for the initialized flag, which persists synchronously and doesn't cause re-renders.

**Duplicate Check**: Add a database check before inserting to ensure documents don't already exist.

---

### Changes

| File | Action |
|------|--------|
| `src/pages/migration/ClientDetail.tsx` | Remove document template copying from `onSuccess` (lines 273-328) |
| `src/pages/migration/ApplicationDetail.tsx` | Use `useRef` instead of `useState` for initialization tracking, add duplicate check |

---

### Technical Details

#### 1. ClientDetail.tsx - Remove duplicate initialization

**Remove lines 273-328** (the entire document template copying block in `onSuccess`):

```typescript
onSuccess: async (data) => {
  // REMOVE THIS ENTIRE BLOCK (lines 273-328):
  // Copy document templates to document_checklist based on linked application types
  // try {
  //   if (data.visa_type_id && currentCompany?.id) {
  //     ...
  //   }
  // } catch (templateError) {
  //   ...
  // }

  // Keep webhook dispatch and query invalidation below
  // Dispatch webhook for visa_application.created event
  try {
    // ... existing webhook code ...
  }
```

#### 2. ApplicationDetail.tsx - Fix race condition

**Line 311**: Change `useState` to `useRef`:

```typescript
// Before
const [documentsInitialized, setDocumentsInitialized] = useState(false);

// After
const documentsInitializedRef = useRef(false);
```

**Lines 678-688**: Update the useEffect to use the ref and add duplicate protection:

```typescript
// Initialize documents when visa application loads and no documents exist
useEffect(() => {
  if (
    visaApplication &&
    dbDocuments !== undefined &&
    dbDocuments.length === 0 &&
    !documentsInitializedRef.current &&
    !initializeDocumentsMutation.isPending
  ) {
    documentsInitializedRef.current = true; // Set immediately to prevent race
    initializeDocumentsMutation.mutate();
  }
}, [visaApplication, dbDocuments]);
```

**Lines 663-669**: Update mutation callbacks to use the ref:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
  // Remove: setDocumentsInitialized(true); - ref is already set before mutation
},
onError: (error) => {
  // ref is already set, no need to update it
  console.error("Failed to initialize documents:", error);
  toast.error("Couldn't generate document checklist", {
    description: error instanceof Error ? error.message : "Please try again.",
  });
},
```

**Lines 516-520**: Add duplicate check at the start of the mutation:

```typescript
mutationFn: async () => {
  if (!visaApplicationId || !visaApplication?.company_id) throw new Error("Missing IDs");

  // Double-check no documents exist (prevents race condition duplicates)
  const { count } = await supabase
    .from("document_checklist")
    .select("id", { count: "exact", head: true })
    .eq("visa_application_id", visaApplicationId);

  if (count && count > 0) {
    console.log("Documents already exist, skipping initialization");
    return; // Exit early, documents already exist
  }

  // Continue with existing initialization logic...
```

---

### Why This Works

1. **Single initialization path**: Only ApplicationDetail.tsx handles document creation
2. **Synchronous guard**: `useRef` prevents the useEffect from running twice during renders
3. **Database verification**: The duplicate check in the mutation ensures even if the mutation fires twice, documents won't be duplicated
4. **Simplified ClientDetail**: The create mutation just creates the application; document initialization is handled when the user views the application

---

### Import Changes

**ApplicationDetail.tsx**: Add `useRef` to the React import:

```typescript
import { useState, useEffect, useMemo, useRef } from "react";
```
