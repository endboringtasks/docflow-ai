

# Fix: Client Portal Not Working

## Problem

The Client Portal is failing because it cannot reach the Supabase edge functions. The code uses `import.meta.env.VITE_SUPABASE_URL` directly, which is **undefined** in the Lovable production environment.

When `VITE_SUPABASE_URL` is undefined, the fetch URLs become:
```
undefined/functions/v1/client-portal-upload  ❌
```

Instead of:
```
https://wevdjmdlsrljanttykzu.supabase.co/functions/v1/client-portal-upload  ✓
```

## Root Cause

The project has a `config` module (`src/lib/config.ts`) that handles environment-aware configuration with production fallbacks. However, `ClientPortal.tsx` bypasses this and uses `import.meta.env.VITE_SUPABASE_URL` directly in 5 places.

## Solution

Import and use `config.supabaseUrl` from the config module instead of `import.meta.env.VITE_SUPABASE_URL`.

## Changes Required

### File: `src/pages/client-portal/ClientPortal.tsx`

**1. Add config import (at the top, around line 14)**

```typescript
import { config } from "@/lib/config";
```

**2. Replace all 5 occurrences of `import.meta.env.VITE_SUPABASE_URL` with `config.supabaseUrl`**

| Line | Function | Current | Fixed |
|------|----------|---------|-------|
| 412 | `handleFileUpload` | `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-upload` | `${config.supabaseUrl}/functions/v1/client-portal-upload` |
| 463 | `handleRemoveAttachment` | `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-remove-document` | `${config.supabaseUrl}/functions/v1/client-portal-remove-document` |
| 495 | `handleRemoveDocument` | `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-remove-document` | `${config.supabaseUrl}/functions/v1/client-portal-remove-document` |
| 572 | `getPreviewUrl` | `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-get-file-url` | `${config.supabaseUrl}/functions/v1/client-portal-get-file-url` |
| 638 | `handleSubmit` | `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-portal-submit` | `${config.supabaseUrl}/functions/v1/client-portal-submit` |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/client-portal/ClientPortal.tsx` | Add import for `config`, replace 5 occurrences of `import.meta.env.VITE_SUPABASE_URL` with `config.supabaseUrl` |

## Expected Result

After this fix:
- The Client Portal will correctly construct edge function URLs
- Token validation, document uploads, removals, previews, and submissions will all work
- The production fallback URL (`https://wevdjmdlsrljanttykzu.supabase.co`) will be used automatically

