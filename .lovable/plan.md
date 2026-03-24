

## Fix Document Row Color After Client Deletion

### Problem
When a client uploads then deletes a document, the backend resets `review_status` to `in_review` (line 317-320 of `client-portal-remove-document`). This causes the row to show a blue background (`bg-blue-500/5`) even though there are no files attached. Meanwhile, the badge correctly shows "Pending Client" because `attachmentCount === 0`. The result: CoE has a blue-tinted row while Diploma and Professional Certifications have a white background — an inconsistency.

### Solution
Update the row color logic in `ApplicationDetail.tsx` to treat documents with zero attachments as pending/default, regardless of their `reviewStatus`. The `in_review` blue styling should only apply when there are actually files to review.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx` (~lines 2295-2304)**

Update the color logic to check `attachmentCount` before applying status-based colors:

```typescript
className={`p-3 rounded-lg border transition-colors ${
  doc.attachmentCount === 0
    ? "bg-background border-border/50 hover:border-border"
    : doc.reviewStatus === "approved" 
    ? "bg-green-500/5 border-green-500/20"
    : doc.reviewStatus === "rejected"
    ? "bg-destructive/5 border-destructive/20"
    : doc.reviewStatus === "in_review"
    ? "bg-blue-500/5 border-blue-500/20"
    : doc.completed 
    ? "bg-primary/5 border-primary/20" 
    : "bg-background border-border/50 hover:border-border"
}`}
```

This ensures that when a client deletes all files, the row resets to the default white background — matching documents that were never uploaded to.

