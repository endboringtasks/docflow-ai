
# Plan: Change 'View' Button Label to 'Review' on Document Cards

## Overview
Change the button label from "View" to "Review" in two locations where users preview documents during the visa application review process.

## Current State
The "View" button appears in:
1. **DocumentHistorySection.tsx** (line 256): Shows historical/archived document versions with Download and View buttons
2. **ApplicationDetail.tsx** (line 2340): Shows current documents with Download and View buttons in the document cards

## Rationale
"Review" better reflects the agent's workflow context - they're reviewing documents for a visa application, not just viewing them casually. This aligns with the review and approval workflow terminology used throughout the application.

## Files to Modify

### 1. `src/components/visa-application/DocumentHistorySection.tsx`
- **Location**: Line 256
- **Change**: Replace button text from `View` to `Review`
- **Context**: Historical document versions shown in timeline format

### 2. `src/pages/migration/ApplicationDetail.tsx`
- **Location**: Line 2340
- **Change**: Replace button text from `View` to `Review`
- **Context**: Current document cards in the document checklist section

## Implementation Details
- Both buttons use the Eye icon (`<Eye className="w-3 h-3 mr-1" />`) which remains unchanged - appropriate for both "View" and "Review" contexts
- No functional changes - only the label text changes
- No props or state changes needed
- Maintains consistency across both document preview workflows

## Files to be Modified
| File | Line | Change |
|------|------|--------|
| `src/components/visa-application/DocumentHistorySection.tsx` | 256 | `View` → `Review` |
| `src/pages/migration/ApplicationDetail.tsx` | 2340 | `View` → `Review` |

