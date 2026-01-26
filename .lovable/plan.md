

## Fix Table Alignment on Beta Feedback Page

### The Problem
The table rows are not aligned with the column headers because the `Collapsible` component (which renders as a `<div>`) is wrapping `<TableRow>` elements. This breaks the HTML table structure since `<tr>` elements must be direct children of `<tbody>`, not wrapped in `<div>` elements.

**Current Structure (Invalid):**
```text
<tbody>
  <div> <!-- Collapsible renders as div - INVALID -->
    <tr>...</tr>
    <tr>...</tr>
  </div>
  <div>
    <tr>...</tr>
    <tr>...</tr>
  </div>
</tbody>
```

**Required Structure (Valid):**
```text
<tbody>
  <tr>...</tr>
  <tr>...</tr>
  <tr>...</tr>
</tbody>
```

---

### The Solution
Remove the `Collapsible` wrapper and manually control the visibility of the expanded content row using React state. This keeps proper table semantics while maintaining the expand/collapse functionality.

---

### Technical Changes

#### File: `src/pages/admin/Feedback.tsx`

| Line | Change |
|------|--------|
| 26-30 | Remove unused Collapsible imports |
| 300 | Remove `<Collapsible>` wrapper |
| 303-307 | Change `CollapsibleTrigger` to regular `Button` with onClick handler |
| 358-428 | Replace `<CollapsibleContent asChild>` with conditional rendering based on `isExpanded` state |
| 360 | Fix `colSpan={7}` to `colSpan={8}` to match all 8 columns |
| 429 | Remove closing `</Collapsible>` tag |

---

### Updated Code Structure

**Before (with Collapsible - broken):**
```jsx
<Collapsible key={item.id} open={isExpanded} onOpenChange={...}>
  <TableRow>
    <TableCell>
      <CollapsibleTrigger asChild>
        <Button>...</Button>
      </CollapsibleTrigger>
    </TableCell>
    ...
  </TableRow>
  <CollapsibleContent asChild>
    <TableRow>...</TableRow>
  </CollapsibleContent>
</Collapsible>
```

**After (without Collapsible - fixed):**
```jsx
<>
  <TableRow key={item.id}>
    <TableCell>
      <Button onClick={() => setExpandedId(isExpanded ? null : item.id)}>
        ...
      </Button>
    </TableCell>
    ...
  </TableRow>
  {isExpanded && (
    <TableRow>...</TableRow>
  )}
</>
```

---

### Summary of Changes

1. **Remove Collapsible imports** - No longer needed
2. **Replace Collapsible wrapper** with React Fragment (`<>...</>`)
3. **Change CollapsibleTrigger** to regular Button with onClick
4. **Replace CollapsibleContent** with conditional rendering (`{isExpanded && ...}`)
5. **Fix colSpan** from 7 to 8 to match the number of columns

This will restore proper table alignment while keeping the expand/collapse functionality working correctly.

