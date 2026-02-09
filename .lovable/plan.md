
# Plan: Fix Both Buttons Spinning Together

## Problem

The Download and View buttons in the Document History section share a single `loadingId` state. When either button is clicked, both show the loading spinner because they both check `loadingId === entry.id`.

**Current code (line 63):**
```tsx
const [loadingId, setLoadingId] = useState<string | null>(null);
```

**Both buttons check the same condition (lines 235-256):**
```tsx
// Download button
disabled={loadingId === entry.id}
{loadingId === entry.id ? <Loader2 ... /> : <Download ... />}

// View button  
disabled={loadingId === entry.id}
{loadingId === entry.id ? <Loader2 ... /> : <Eye ... />}
```

## Solution

Create separate loading states for each action type using a composite key that includes both the entry ID and the action type.

**New approach:**
```tsx
const [loadingId, setLoadingId] = useState<string | null>(null);
// loadingId format: "entryId:download" or "entryId:view"
```

## Changes

### File: `src/components/visa-application/DocumentHistorySection.tsx`

#### Change 1: Update handleViewDocument to use action-specific ID (line 70)

**Before:**
```tsx
setLoadingId(entry.id);
```

**After:**
```tsx
setLoadingId(`${entry.id}:view`);
```

#### Change 2: Update handleDownload to use action-specific ID (line 131)

**Before:**
```tsx
setLoadingId(entry.id);
```

**After:**
```tsx
setLoadingId(`${entry.id}:download`);
```

#### Change 3: Update Download button loading check (lines 235-242)

**Before:**
```tsx
disabled={loadingId === entry.id}
{loadingId === entry.id ? (
  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
) : (
  <Download className="w-3 h-3 mr-1" />
)}
```

**After:**
```tsx
disabled={loadingId === `${entry.id}:download`}
{loadingId === `${entry.id}:download` ? (
  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
) : (
  <Download className="w-3 h-3 mr-1" />
)}
```

#### Change 4: Update View button loading check (lines 249-256)

**Before:**
```tsx
disabled={loadingId === entry.id}
{loadingId === entry.id ? (
  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
) : (
  <Eye className="w-3 h-3 mr-1" />
)}
```

**After:**
```tsx
disabled={loadingId === `${entry.id}:view`}
{loadingId === `${entry.id}:view` ? (
  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
) : (
  <Eye className="w-3 h-3 mr-1" />
)}
```

## Visual Result

**Before (clicking View):**
```
[↻ Download]  [↻ View]   <- Both spinning
```

**After (clicking View):**
```
[↓ Download]  [↻ View]   <- Only View spinning
```

## Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/components/visa-application/DocumentHistorySection.tsx` | 70, 131, 235-256 | Use action-specific loading IDs |
