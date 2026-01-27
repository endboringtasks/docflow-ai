
## Replace "Applies" Button with Toggle Switch

### Summary
Replace the current button-based toggle with a proper Switch component for conditional documents. The switch will have clear labels showing "Applies" (ON) and "N/A" (OFF), with N/A as the default state.

---

### Changes Overview

| Change | Description |
|--------|-------------|
| Replace button with Switch | Use the existing Radix Switch component for clearer ON/OFF interaction |
| Change default value | New conditional documents default to `is_applicable: false` (N/A) |
| Add inline labels | Show "N/A" and "Applies" labels next to the switch |
| Update visual styling | Remove the "Not Applicable" badge since the switch state is now obvious |

---

### UI Design

**Current:**
```
[Applies] button → click → [N/A] button with strikethrough
```

**New:**
```
N/A  [○────]  Applies    (OFF state - default)
N/A  [────●]  Applies    (ON state)
```

---

### Technical Details

#### 1. Update Default Value (line 598)

```typescript
// Before
is_applicable: true, // Default to applicable, staff can toggle off

// After  
is_applicable: false, // Default to N/A for conditional docs, staff toggles on if applicable
```

#### 2. Replace Button with Switch (lines 2056-2082)

```tsx
{doc.requirementType === "conditional" && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs ${!doc.isApplicable ? 'text-muted-foreground font-medium' : 'text-muted-foreground'}`}>
            N/A
          </span>
          <Switch
            checked={doc.isApplicable}
            onCheckedChange={(checked) => 
              toggleApplicabilityMutation.mutate({ docId: doc.id, isApplicable: checked })
            }
            disabled={toggleApplicabilityMutation.isPending}
            className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-muted h-5 w-9"
          />
          <span className={`text-xs ${doc.isApplicable ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
            Applies
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          Toggle whether this document applies to this case
        </p>
        {doc.applicabilityCondition && (
          <p className="text-xs text-muted-foreground mt-1">{doc.applicabilityCondition}</p>
        )}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

#### 3. Keep "Not Applicable" Badge (optional)
The badge at lines 1934-1938 can remain as a visual indicator in the document name area, or be removed since the switch state is now obvious. I recommend keeping it for quick scanning of the checklist.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/ApplicationDetail.tsx` | Replace button with Switch, update default value |

---

### Visual Behavior

| State | Switch | Left Label | Right Label | Row Styling |
|-------|--------|------------|-------------|-------------|
| N/A (default) | OFF (left) | **N/A** (bold) | Applies (muted) | Normal |
| Applies | ON (right) | N/A (muted) | **Applies** (amber, bold) | Normal |

The switch uses amber color when ON to match the existing "If Applicable" badge styling.
