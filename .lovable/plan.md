

## Fix: Client Portal Document Background Colors to Match Agent View

### Problem
In the client portal, document card backgrounds are determined by `is_completed` (green) rather than `review_status`. So when a document is "In Review", it shows a green background instead of the blue background used in the agent's application view.

### Change

**File: `src/pages/client-portal/ClientPortal.tsx` (~lines 1138-1145)**

Update the background color logic to prioritize `review_status` over `is_completed`, matching the agent view:

```typescript
className={`rounded-lg border transition-all ${
  isRejected
    ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 border-2"
    : doc.review_status === "in_review" && doc.attachment_count > 0
      ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
      : doc.review_status === "approved" && doc.attachment_count > 0
        ? "bg-[#f4fbf6] dark:bg-slate-900/30 border-[#e8f0eb] dark:border-slate-700"
        : doc.is_completed
          ? "bg-[#f4fbf6] dark:bg-slate-900/30 border-[#e8f0eb] dark:border-slate-700"
          : dragOverDocId === doc.id
            ? "bg-primary/10 border-primary border-dashed"
            : "bg-background border-border/50 hover:border-border"
}`}
```

This gives "In Review" documents a blue-tinted background (matching the agent view's `bg-blue-500/5`) and keeps the green for approved/completed documents.

