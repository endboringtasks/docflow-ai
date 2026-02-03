
# Fix Document Order Consistency Within Categories

## Problem

Documents within each category are displayed in different orders between the Application page (admin view) and the Client Portal. From the screenshots:

| View | Order |
|------|-------|
| **Application page** | Diploma → Diploma (Translation) → Professional Certifications → CoE |
| **Client Portal** | Professional Certifications → CoE → Diploma → Diploma (Translation) |

## Root Cause

Both files have logic to group translations with their parent documents, but neither sorts the "original" documents alphabetically before processing. The order depends on database insertion order or query results, which can vary.

**Current code (both files):**
```typescript
const originals = docs.filter(d => !d.translationOfId);  // Not sorted!
```

## Solution

Add alphabetical sorting to the `originals` array in both files before iterating through them. This ensures documents are displayed in the same predictable order regardless of database order.

## Changes Required

### 1. ApplicationDetail.tsx (Line 1565)

**Current:**
```typescript
const originals = docs.filter(d => !d.translationOfId);
```

**Updated:**
```typescript
const originals = docs.filter(d => !d.translationOfId).sort((a, b) => a.name.localeCompare(b.name));
```

### 2. ClientPortal.tsx (Line 695)

**Current:**
```typescript
const originals = docs.filter(d => !d.translation_of_id);
```

**Updated:**
```typescript
const originals = docs.filter(d => !d.translation_of_id).sort((a, b) => a.document_name.localeCompare(b.document_name));
```

Note: The Client Portal uses `document_name` while the Application page uses `name` due to different data structures.

## Result

After this change, documents within each category will be sorted alphabetically in both views:

| Category | Order |
|----------|-------|
| Educational Documents | CoE → Diploma → Diploma (Translation) → Professional Certifications |

Translations will continue to appear immediately after their parent document as designed.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add `.sort((a, b) => a.name.localeCompare(b.name))` to originals |
| `src/pages/client-portal/ClientPortal.tsx` | Add `.sort((a, b) => a.document_name.localeCompare(b.document_name))` to originals |
