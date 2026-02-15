

# Plan: Add Column Sorting to Application Types Overview Table

## Overview
Add clickable column headers to the "Application Types Overview" table so users can sort by Application Name, Code, Country, Category, and Documents count. Clicking a header toggles between ascending and descending order, with a visual arrow indicator.

## Changes

### File: `src/pages/migration/DocumentChecklist.tsx`

1. **Add sort state** (around line 246, with the other filter states):
   - `sortColumn`: tracks which column is active (`'name' | 'code' | 'country' | 'category' | 'documents'`)
   - `sortDirection`: tracks `'asc' | 'desc'`
   - Default: sort by name ascending

2. **Add sorted data memo** (after `applicationSummary` query):
   - Create a `sortedApplicationSummary` useMemo that sorts the `applicationSummary` array based on the active sort column and direction
   - String columns use `localeCompare`, documents column uses numeric comparison

3. **Make table headers clickable** (lines 916-923):
   - Replace plain text headers with clickable elements that call a `handleSort` function
   - Add `ArrowUpDown` / `ArrowUp` / `ArrowDown` icon from lucide-react to indicate sort state
   - Apply `cursor-pointer` and hover styling to sortable headers

4. **Use sorted data in table body** (line 926):
   - Replace `applicationSummary.map(...)` with `sortedApplicationSummary.map(...)`

## Technical Details

### New state variables
```ts
const [sortColumn, setSortColumn] = useState<'name' | 'code' | 'country' | 'category' | 'documents'>('name');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
```

### Sort handler
```ts
const handleSort = (column: typeof sortColumn) => {
  if (sortColumn === column) {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setSortColumn(column);
    setSortDirection('asc');
  }
};
```

### Sorted memo
```ts
const sortedApplicationSummary = useMemo(() => {
  return [...applicationSummary].sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'code': cmp = a.code.localeCompare(b.code); break;
      case 'country': cmp = (a.country?.name || '').localeCompare(b.country?.name || ''); break;
      case 'category': cmp = (a.category?.name || '').localeCompare(b.category?.name || ''); break;
      case 'documents': cmp = a.document_count - b.document_count; break;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });
}, [applicationSummary, sortColumn, sortDirection]);
```

### Sortable header component (inline)
Each header cell becomes clickable with an icon showing sort direction:
```tsx
<TableHead 
  className="cursor-pointer select-none hover:text-foreground"
  onClick={() => handleSort('name')}
>
  <span className="flex items-center gap-1">
    Application Name
    {sortColumn === 'name' ? (
      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
    ) : (
      <ArrowUpDown className="w-3 h-3 opacity-40" />
    )}
  </span>
</TableHead>
```

### New icon imports
Add `ArrowUp`, `ArrowDown`, `ArrowUpDown` to the existing lucide-react import.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/migration/DocumentChecklist.tsx` | Add sort state, sort handler, sorted memo, clickable headers with icons |

