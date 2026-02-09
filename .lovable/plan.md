

# Plan: Display Document Version History for Audit Trail

## Overview
Add the ability to view all previously rejected documents (version history) in both the Client Portal and Application Detail page. This creates a complete audit trail showing all document submissions, rejections, and their associated feedback.

## User Experience

### Client Portal
- Below the current document attachment section, add a collapsible "Version History" section
- Shows all previously archived versions with:
  - File name and size
  - Upload date
  - Rejection reason/comment
  - Option to view/download the historical document

### Application Detail Page (Agent/Admin View)
- Add a "History" tab or expandable section in the DocumentPreviewDialog
- Shows complete version history with:
  - All previous document versions
  - Who uploaded each version (client name)
  - When it was uploaded
  - Rejection reason and who rejected it
  - Click to view the historical document

## Technical Implementation

### 1. Client Portal Changes

**File: `src/pages/client-portal/ClientPortal.tsx`**

Add a query to fetch document history:
```typescript
// Fetch document history for rejected documents
const { data: documentHistory } = useQuery({
  queryKey: ["document-history", accessId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("document_attachment_history")
      .select("*")
      .eq("uploaded_by_client", accessId)
      .order("archived_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  enabled: !!accessId,
});
```

Add UI section after attachments list:
- Collapsible "Previous Versions" section with history icon
- List each historical document with:
  - Faded/muted styling to indicate archived status
  - File name with strikethrough
  - Archived date
  - Rejection reason in a subtle alert
  - "View" button to preview historical document

### 2. Application Detail Page Changes

**File: `src/pages/migration/ApplicationDetail.tsx`**

Add query to fetch history grouped by document_checklist_id:
```typescript
const { data: allDocumentHistory } = useQuery({
  queryKey: ["all-document-history", visaApplicationId],
  queryFn: async () => {
    const docIds = documentChecklist?.map(d => d.id) || [];
    if (docIds.length === 0) return {};
    
    const { data, error } = await supabase
      .from("document_attachment_history")
      .select("*")
      .in("document_checklist_id", docIds)
      .order("archived_at", { ascending: false });
    
    if (error) throw error;
    
    // Group by document_checklist_id
    return data.reduce((acc, item) => {
      if (!acc[item.document_checklist_id]) acc[item.document_checklist_id] = [];
      acc[item.document_checklist_id].push(item);
      return acc;
    }, {});
  },
  enabled: !!documentChecklist?.length,
});
```

Add UI below attachments list:
- "Version History" collapsible section (only shows if history exists)
- Timeline-style list showing each archived version
- Red-tinted cards showing rejection info

### 3. DocumentPreviewDialog Enhancement

**File: `src/components/visa-application/DocumentPreviewDialog.tsx`**

Add tabs to the dialog: "Current" | "History"

**History Tab Content:**
- Fetch history for the specific document_checklist_id
- Display timeline of all versions with:
  - Thumbnail preview
  - Upload date and uploader
  - Rejection date, reason, and reviewer
  - "View Document" button that loads historical file

### 4. New Component: DocumentHistorySection

**New File: `src/components/visa-application/DocumentHistorySection.tsx`**

Reusable component for displaying document history:

```typescript
interface DocumentHistoryEntry {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
  archived_at: string;
  archived_reason: string;
  review_status_at_archive: string | null;
  review_comment_at_archive: string | null;
}

interface DocumentHistorySectionProps {
  history: DocumentHistoryEntry[];
  onViewDocument: (filePath: string, fileName: string) => void;
  companyId?: string;
  isClientPortal?: boolean;
}
```

**Features:**
- Collapsible by default (expand to show history)
- Shows count badge: "3 previous versions"
- Timeline styling with connecting lines
- Each entry shows file info, dates, rejection reason
- View/Download buttons for each historical document

## Files to Modify/Create

| File | Changes |
|------|---------|
| `src/components/visa-application/DocumentHistorySection.tsx` | **NEW** - Reusable history display component |
| `src/pages/client-portal/ClientPortal.tsx` | Add history query and display section |
| `src/pages/migration/ApplicationDetail.tsx` | Add history query and display in document cards |
| `src/components/visa-application/DocumentPreviewDialog.tsx` | Add "History" tab with document versions |

## Implementation Order

1. Create `DocumentHistorySection` component (reusable)
2. Update `ClientPortal.tsx` - add query and integrate history section
3. Update `ApplicationDetail.tsx` - add query and integrate history section
4. Enhance `DocumentPreviewDialog.tsx` - add History tab with preview capability

## Visual Design

### History Entry Card (for both portals)
```text
┌─────────────────────────────────────────────────────────────┐
│ 📄 passport_scan.pdf                                   (2 MB) │
│ ─────────────────────────────────────────────────────────── │
│ ⬆️ Uploaded: Feb 8, 2026 at 2:30 PM                          │
│ ❌ Rejected: Feb 9, 2026 at 10:15 AM by John Smith          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ "Document is blurry, please upload a clearer scan"      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                          [View] [Download]   │
└─────────────────────────────────────────────────────────────┘
```

### Client Portal - Collapsed State
```text
📜 Previous Versions (2)  ▼
```

### Client Portal - Expanded State
```text
📜 Previous Versions (2)  ▲
├─ Version 2 (Rejected Feb 9) - "Document too blurry"
│  passport_v2.pdf [View]
├─ Version 1 (Rejected Feb 7) - "Wrong document type"  
│  id_card.pdf [View]
```

## Security Considerations

- History records use existing RLS policies (already configured)
- Client portal users can only see history for documents they uploaded
- Company members can see all history for their company's applications
- Historical files remain in storage and are accessible via signed URLs

## Edge Cases

- **No history**: History section is hidden entirely
- **Multiple rejections**: All shown in chronological order (newest first)
- **Google Drive files**: Use existing `get-drive-file-url` function for previews
- **Missing reviewer info**: Show "System" or hide reviewer name

