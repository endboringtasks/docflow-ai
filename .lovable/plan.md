

## Hide Thumbnail When Document Has No Attachments

### Problem
When a client deletes a file, `doc.filePath` still retains its value even though the physical file is gone. The legacy single-file display block (line 2539) renders a `DocumentThumbnail` for this stale path, showing a broken mini image.

### Change

**File: `src/pages/migration/ApplicationDetail.tsx` (~line 2539)**

Add `doc.attachmentCount > 0` to the condition so the thumbnail only renders when there are actual files:

```typescript
{doc.filePath && doc.attachmentCount > 0 && (!doc.attachments || doc.attachments.length === 0) && (
```

This prevents the stale thumbnail from appearing while still showing the document history section. The history block needs to be moved outside this conditional so it still renders when `attachmentCount === 0`:

After the legacy block (ending ~line 2561), add a standalone history section for the case where there are no attachments but history exists:

```typescript
{doc.attachmentCount === 0 && documentHistoryByDoc?.[doc.id] && (documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]).length > 0 && (
  <div className="mt-2 ml-8">
    <DocumentHistorySection
      history={documentHistoryByDoc[doc.id] as DocumentHistoryEntry[]}
      companyId={visaApplication?.company_id}
      onViewDocument={(url, fileName) => setHistoryPreview({ url, name: fileName })}
      inline
    />
  </div>
)}
```

This ensures: (1) no broken thumbnail for deleted files, and (2) history entries still display when all files have been removed.

