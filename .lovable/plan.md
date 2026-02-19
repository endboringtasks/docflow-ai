

## Pre-select Google Drive Permission Checkbox

### Problem
When users connect Google Drive, Google's granular consent screen shows an unchecked checkbox for the Drive scope. Users must manually check it before clicking "Continue", which causes confusion.

### Solution
Add `enable_granular_consent=false` to the OAuth URL parameters in the `google-drive-auth` edge function. This disables Google's granular permission selection and reverts to the classic all-or-nothing consent flow, where clicking "Allow" grants all requested scopes automatically -- no checkbox needed.

### Technical Change

**File: `supabase/functions/google-drive-auth/index.ts`** (line 90)

Add one line after the existing `state` parameter:

```typescript
authUrl.searchParams.set("state", state);
authUrl.searchParams.set("enable_granular_consent", "false");  // add this line
```

This single parameter change tells Google to skip the granular scope selection UI and present a simpler "Allow/Deny" consent screen instead.

| File | Change |
|---|---|
| `supabase/functions/google-drive-auth/index.ts` | Add `enable_granular_consent=false` parameter to OAuth URL |

