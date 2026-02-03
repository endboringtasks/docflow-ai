
# Fix: Match Client Portal Styling to Application Page

## Problem

In the Client Portal, documents with `pending_client` status have:
- A yellow/amber background on the entire document card
- A yellow/amber border (2px thick) on the card
- The "Pending Client" badge text

The user wants to **remove the yellow card styling** but **keep the "Pending Client" badge**, matching the Application page styling where only the badge has amber coloring.

## Current vs Desired Behavior

| Element | Current (Client Portal) | Desired (Match App Page) |
|---------|------------------------|--------------------------|
| Document card background | `bg-amber-50` (yellow) | `bg-background` (neutral) |
| Document card border | `border-amber-300 border-2` (yellow, thick) | `border-border/50` (neutral, thin) |
| "Pending Client" badge | Amber text + border (keep) | Amber text + border (keep) |
| Review feedback alert | Keep amber styling | Keep amber styling |

## Solution

Update the document card conditional styling to remove the amber background/border for `pending_client` status while preserving:
1. The amber badge text styling
2. The amber styling for the review feedback alert (when a comment exists)

## Technical Changes

### File: `src/pages/client-portal/ClientPortal.tsx`

**Update card container styling (lines 1038-1048)**

Remove the `pending_client` case from the `needsAttention` yellow styling. Only `rejected` status should have colored card styling.

```text
Before:
needsAttention
  ? isRejected
    ? "bg-red-50 ... border-red-300 border-2"
    : "bg-amber-50 ... border-amber-300 border-2"  ← Remove this
  : ...

After:
isRejected
  ? "bg-red-50 ... border-red-300 border-2"
  : doc.is_completed
    ? "bg-green-50 ... border-green-200"
    : ...
```

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/client-portal/ClientPortal.tsx` | 1038-1048 | Remove amber styling for pending_client cards, only keep for rejected |

## What Will Be Preserved

- **"Pending Client" badge** (lines 1079-1084) - unchanged, keeps amber outline styling
- **Review feedback alert** (lines 1168-1201) - unchanged, still shows amber alert box when there's a review comment
- **Rejected card styling** - unchanged, keeps red background/border

## Expected Result

- Document cards for `pending_client` status will have neutral background (same as other incomplete documents)
- The "Pending Client" tag will still appear with its amber text/border styling
- The review feedback alert inside the card (when comment exists) will still have amber styling
- Rejected documents will continue to have red card styling
