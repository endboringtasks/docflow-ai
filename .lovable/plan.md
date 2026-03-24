

## Keep Document History Visible on Application Detail Page

### Problem
On the Application Detail page, the "Previous Versions" section is rendered inside a collapsible that starts collapsed. The user wants it always visible (expanded) on this page, while keeping the collapsible behavior in the client portal.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx` (~lines 2514 and 2537)**

Pass `inline={true}` to both `DocumentHistorySection` usages so the history entries render directly without the collapsible wrapper:

```tsx
<DocumentHistorySection
  history={documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]}
  companyId={visaApplication?.company_id}
  onViewDocument={(url, fileName) => setHistoryPreview({ url, name: fileName })}
  inline
/>
```

The `inline` prop already exists on the component and renders the timeline content directly without the `Collapsible` wrapper. No other files need changes.

