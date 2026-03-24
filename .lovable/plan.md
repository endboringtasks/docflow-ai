

## Fix Document Row Background Color to Match Client Portal

### Problem
The document row background color in the applicant view differs from the client portal for documents in the default/pending state:
- **Client Portal**: `bg-background border-border/50` (white/clean background)
- **Applicant View**: `bg-secondary/50 border-border/50` (grayish background)

This causes a visual mismatch, especially visible on documents like "CoE" that are in `pending_client` state.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx` (~line 2304)**

Update the default case in the document row color logic from:
```
: "bg-secondary/50 border-border/50"
```
to:
```
: "bg-background border-border/50 hover:border-border"
```

This matches the client portal's styling exactly (from `ClientPortal.tsx` line 1145).

