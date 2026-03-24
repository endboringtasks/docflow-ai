

## Use Collapsible "Previous Versions" in Application View

### Problem
The agent's application view shows document history inline (always expanded), while the client portal uses a collapsible "Previous Versions" section. The user wants consistency — both should use the collapsible style.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx`**

Remove the `inline` prop from all three `DocumentHistorySection` usages (~lines 2532, 2556, 2569). This will make them render in the default collapsible mode with the "Previous Versions" header and badge, matching the client portal.

Three occurrences to update:
1. Line 2532: multi-attachment history block
2. Line 2556: legacy single-file history block  
3. Line 2569: zero-attachment history block

