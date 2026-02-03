
# Replace Contact Email Address

## Summary

Replace all occurrences of `anderson@endboringtasks.com` with `info@endboringtasks.com` across the codebase.

## Files to Modify

| File | Locations | Changes |
|------|-----------|---------|
| `src/pages/Privacy.tsx` | Lines 116-117, 141 | Update `mailto:` link and display text |
| `src/pages/Terms.tsx` | Lines 129-130, 154 | Update `mailto:` link and display text |
| `src/pages/Index.tsx` | Line 681 | Update `mailto:` link |

## Changes

### 1. Privacy.tsx (2 locations)

**Contact section (line 116-117):**
```typescript
<a href="mailto:info@endboringtasks.com" className="text-primary hover:underline">
  info@endboringtasks.com
</a>
```

**Footer (line 141):**
```typescript
<a href="mailto:info@endboringtasks.com" className="hover:text-foreground transition-colors">Contact</a>
```

### 2. Terms.tsx (2 locations)

**Contact section (line 129-130):**
```typescript
<a href="mailto:info@endboringtasks.com" className="text-primary hover:underline">
  info@endboringtasks.com
</a>
```

**Footer (line 154):**
```typescript
<a href="mailto:info@endboringtasks.com" className="hover:text-foreground transition-colors">Contact</a>
```

### 3. Index.tsx (1 location)

**Footer (line 681):**
```typescript
<a href="mailto:info@endboringtasks.com" className="hover:text-foreground transition-colors">
  Contact
</a>
```

## Total: 5 replacements across 3 files
