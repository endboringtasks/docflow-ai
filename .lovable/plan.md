

# Add Person Names to Applicant Type Headers

## Problem

Currently, the document checklist groups documents by applicant type (Primary Applicant, Partner, Dependant), but only shows the generic type name without the actual person's name. This makes it difficult for users to identify which person should upload which documents, especially when there are multiple dependants.

**Current Display:**
```
Partner           0/10
Dependant         0/5
```

**Desired Display:**
```
Partner - Jane Smith           0/10
Dependant - Tom Smith          0/5
```

## Solution

Create a mapping from applicant type to the person's display name using the existing `applicationApplicants` data, then display the person's name alongside the applicant type in the document section headers.

## File to Change

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add name mapping and update header display |

## Implementation Details

### 1. Create Applicant Name Mapping

Add a memoized mapping that links applicant types to their display names:

```typescript
// Create a map from applicant type name to display name
const applicantTypeToName = useMemo(() => {
  const mapping: Record<string, string> = {};
  applicationApplicants.forEach(applicant => {
    const typeName = applicant.applicant_type?.name;
    if (typeName && applicant.displayName) {
      mapping[typeName] = applicant.displayName;
    }
  });
  return mapping;
}, [applicationApplicants]);
```

### 2. Update Applicant Type Header

Update the header rendering (around line 2010) to include the person's name:

```tsx
{/* Before */}
<h2 className="text-lg font-semibold">{applicantType}</h2>

{/* After */}
<h2 className="text-lg font-semibold">
  {applicantType}
  {applicantTypeToName[applicantType] && (
    <span className="text-muted-foreground font-normal ml-2">
      - {applicantTypeToName[applicantType]}
    </span>
  )}
</h2>
```

## Visual Result

**Before:**
```
┌────────────────────────────────────────┐
│ 👤 Primary Applicant          0/21     │
├────────────────────────────────────────┤
│   📄 Identity Documents       0/5      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 👤 Partner                    0/10     │
├────────────────────────────────────────┤
│   📄 Identity Documents       0/3      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 👤 Dependant                  0/5      │
├────────────────────────────────────────┤
│   📄 Identity Documents       0/5      │
└────────────────────────────────────────┘
```

**After:**
```
┌────────────────────────────────────────┐
│ 👤 Primary Applicant - John Smith  0/21│
├────────────────────────────────────────┤
│   📄 Identity Documents       0/5      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 👤 Partner - Jane Smith       0/10     │
├────────────────────────────────────────┤
│   📄 Identity Documents       0/3      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 👤 Dependant - Tom Smith      0/5      │
├────────────────────────────────────────┤
│   📄 Identity Documents       0/5      │
└────────────────────────────────────────┘
```

This makes it immediately clear which person needs to provide which documents.

