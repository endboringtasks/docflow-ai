

## Match Applicant View Document Layout to Client Portal

### What's Different

Comparing the two screenshots:

1. **Applicant view** (first screenshot): Shows "Uploaded" and "Reviewed" dates inline on the document row itself, cluttering it
2. **Client portal** (second screenshot): Clean row with just document name + status badge, then the collapsible "Previous Versions" below

The "Document Timeline" section in `ApplicationDetail.tsx` (lines 2361-2379) renders upload/review dates directly on the document row. The client portal doesn't have this — those dates only appear inside the history entries. This makes the applicant view look cluttered and inconsistent with the portal.

### Changes

**File: `src/pages/migration/ApplicationDetail.tsx`**

Remove the "Document Timeline" block (lines 2361-2380) that renders inline `Uploaded ...` and `Reviewed ...` dates on the document row. These dates are already captured in the history entries within the collapsible "Previous Versions" section, so showing them twice is redundant.

This will make the applicant view's document rows match the client portal: document name, status badge, and action buttons on the row, with history details inside the collapsible.

