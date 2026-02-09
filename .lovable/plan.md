

# Plan: Fix Client Uploader Lookup for Document History

## Root Cause

The `uploaded_by_client` field in `document_attachment_history` stores the `client_portal_access.id` (not the `clients.id`). The current code tries to look up client details directly from the `clients` table, which returns no results because the IDs don't match.

**Current flow (broken):**
```
uploaded_by_client: "4609b2b5..." → clients table lookup → No match!
```

**Required flow (correct):**
```
uploaded_by_client: "4609b2b5..." → client_portal_access table → client_id: "2a32df40..." → clients table → "Anderson Santos"
```

## Changes Required

### File: `src/pages/migration/ApplicationDetail.tsx`

**Location:** Lines 570-590 (the `historyClientProfiles` query)

Change from looking up `clients` directly to:
1. First fetch from `client_portal_access` using the `uploaded_by_client` IDs
2. Then fetch the actual client names from `clients` using the `client_id` field

**Current code:**
```tsx
const { data: historyClientProfiles } = useQuery({
  queryKey: ["history-client-profiles", historyClientUploaderIds],
  queryFn: async () => {
    if (historyClientUploaderIds.length === 0) return {};
    
    const { data, error } = await supabase
      .from("clients")  // ❌ Wrong table!
      .select("id, first_name, last_name, email")
      .in("id", historyClientUploaderIds);
    // ...
  },
});
```

**New code:**
```tsx
const { data: historyClientProfiles } = useQuery({
  queryKey: ["history-client-profiles", historyClientUploaderIds],
  queryFn: async () => {
    if (historyClientUploaderIds.length === 0) return {};
    
    // Step 1: Get portal access records to find actual client IDs
    const { data: portalAccess, error: portalError } = await supabase
      .from("client_portal_access")
      .select("id, client_id")
      .in("id", historyClientUploaderIds);
    
    if (portalError) throw portalError;
    if (!portalAccess || portalAccess.length === 0) return {};
    
    // Step 2: Get actual client details
    const clientIds = [...new Set(portalAccess.map(p => p.client_id).filter(Boolean))];
    if (clientIds.length === 0) return {};
    
    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email")
      .in("id", clientIds);
    
    if (clientError) throw clientError;
    
    // Build lookup: portal_access_id → client details
    const clientMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
    const clientDetailsMap = Object.fromEntries((clients || []).map(c => [c.id, c]));
    
    portalAccess.forEach(pa => {
      if (pa.client_id && clientDetailsMap[pa.client_id]) {
        clientMap[pa.id] = clientDetailsMap[pa.client_id];
      }
    });
    
    return clientMap;
  },
  enabled: historyClientUploaderIds.length > 0,
});
```

## Visual Result

**Before:**
```
● Anderson_Plan.pdf (45 KB)                              👁 View
  📅 Uploaded Feb 9, 2026 at 2:32 PM
  ⊗ Reviewed Feb 9, 2026 at 2:18 PM by anderri@gmail.com
```

**After:**
```
● Anderson_Plan.pdf (45 KB)                              👁 View
  📅 Uploaded Feb 9, 2026 at 2:32 PM by Anderson Santos (Client)
  ⊗ Reviewed Feb 9, 2026 at 2:18 PM by anderri@gmail.com
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Update `historyClientProfiles` query to look up client_portal_access first, then clients |

