

# Plan: Align Document Display Buttons for Current and Rejected Documents

## Issue Summary
The current document preview button and the rejected document history "View" button are styled and positioned differently:

| Element | Current Behavior | Expected Behavior |
|---------|-----------------|-------------------|
| Current document | Eye icon only (no text), positioned at the far right of the header | Should have "View" text like rejected documents |
| Rejected document history | "View" button with text + icon, positioned at the bottom left | Should match the current document button position/style |

## Solution Options

**Option A (Recommended):** Add "View" text to the current document button to match rejected documents
- Simpler change
- Both will have consistent text+icon buttons

**Option B:** Remove "View" text from rejected documents to match current
- Would lose clarity in the history section

I'll proceed with **Option A** since having the text "View" is clearer for users.

## Changes

### File: `src/pages/migration/ApplicationDetail.tsx`

**Location:** Lines 2203-2211 (the current document preview button)

Change from:
```tsx
{doc.attachmentCount > 0 && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 text-primary"
    onClick={() => setPreviewDoc(doc)}
    title="Preview & Review"
  >
    <Eye className="w-4 h-4" />
  </Button>
)}
```

Change to:
```tsx
{doc.attachmentCount > 0 && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 text-xs text-primary"
    onClick={() => setPreviewDoc(doc)}
  >
    <Eye className="w-3 h-3 mr-1" />
    View
  </Button>
)}
```

This change:
- Switches from `size="icon"` to `size="sm"` to allow text
- Adds "View" text after the icon
- Uses the same styling pattern as the history section buttons (`h-7 text-xs`, icon with `mr-1`)

## Visual Result

**Before:**
```
┌─ Diploma  [Ready to Review]                      📅 Uploaded...  👁 ┐
│  📄 Screenshot 2025-12-17.png (1686 KB)  [File]                      │
│                                                                      │
│  ⭕ Anderson_Plan.pdf                                                │
│     📅 Uploaded...  ⊗ Rejected...                                   │
│     "need to be another document"                                    │
│     👁 View                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

**After:**
```
┌─ Diploma  [Ready to Review]                  📅 Uploaded...  👁 View ┐
│  📄 Screenshot 2025-12-17.png (1686 KB)  [File]                      │
│                                                                      │
│  ⭕ Anderson_Plan.pdf                                                │
│     📅 Uploaded...  ⊗ Rejected...                                   │
│     "need to be another document"                                    │
│     👁 View                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

Both buttons now consistently show "View" with an icon.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Update the preview button at lines 2203-2211 to include "View" text |

