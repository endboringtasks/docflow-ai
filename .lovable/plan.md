
# Plan: Add Missing Uploader and Reviewer Information to Rejected Documents

## What's Currently Shown

The rejected document history entries currently display:
- ✅ File name and size
- ✅ Uploaded date
- ✅ Rejected date with reviewer name (when available)
- ✅ Rejection reason
- ❌ **Missing: Who uploaded the document**

## What We Need to Add

Based on the current document display format, history entries should show:
- **Uploaded [date] by [Name] (Client)** - for client uploads
- **Uploaded [date] by [Agent email]** - for agent uploads  
- **Reviewed [date] by [reviewer email]** - already partially working but needs consistency

## Changes Required

### 1. Update Query to Fetch Profiles for History (ApplicationDetail.tsx)

Currently the history query only does `select("*")`. We need to:
- Extract `uploaded_by`, `uploaded_by_client`, and `reviewed_by_at_archive` IDs from history data
- Include these IDs in the profile fetching queries
- Enrich history data with profile information before passing to component

### 2. Extend DocumentHistoryEntry Interface (DocumentHistorySection.tsx)

Add new fields:
- `uploader_name?: string | null` - for agent uploads
- `uploader_client_name?: string | null` - for client uploads

### 3. Update Display in DocumentHistorySection.tsx

Change the dates section to show the uploader information in the same format as current documents.

## Technical Details

### File: `src/pages/migration/ApplicationDetail.tsx`

**Location:** Lines 521-547 (history query and profile fetching)

Changes:
1. After fetching history data, extract all `uploaded_by`, `uploaded_by_client`, and `reviewed_by_at_archive` IDs
2. Include these IDs in the `allProfileIds` and `clientUploaderIds` arrays  
3. Enrich history entries with profile names before grouping

### File: `src/components/visa-application/DocumentHistorySection.tsx`

**Location:** Lines 26-39 (interface) and Lines 232-245 (dates display)

Changes:
1. Add `uploader_name` and `uploader_client_name` to `DocumentHistoryEntry` interface
2. Update dates display to include uploader info in same format as current documents

## Visual Result

**Before:**
```
● Anderson_Plan.pdf (45 KB)                              👁 View
  📅 Uploaded Feb 9, 2026 at 2:32 PM
  ⊗ Rejected Feb 9, 2026 at 2:18 PM by anderri@gmail.com
  "need to be another document"
```

**After:**
```
● Anderson_Plan.pdf (45 KB)                              👁 View
  📅 Uploaded Feb 9, 2026 at 2:32 PM by Anderson Santos (Client)
  ⊗ Reviewed Feb 9, 2026 at 2:18 PM by anderri@gmail.com
  "need to be another document"
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | Extract profile IDs from history, enrich history data with names |
| `src/components/visa-application/DocumentHistorySection.tsx` | Add interface fields, update display format |
