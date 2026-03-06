

## Issue: "Documents List" Tab Not Visible

After investigating the code, the tabs structure is correctly implemented in `DocumentChecklist.tsx` (lines 801-809). The `DocumentsListTab` component exists and is properly imported.

The most likely cause: **the default active tab is set to `"checklist"`** (line 255), so "Documents List" is there but requires clicking the tab. However, if the user is saying they literally cannot see the tab trigger itself, it could be a styling issue with the `TabsList` not being wide enough.

### Changes

1. **Set "Documents List" as the default tab** -- change `useState("checklist")` to `useState("documents-list")` on line 255 so users land on the Documents List tab first (it's the foundational step before configuring checklists).

2. **Verify tab visibility** -- no structural issues found; the `TabsList`, `TabsTrigger`, and `TabsContent` are all correctly nested inside `Tabs`.

This is a one-line change: update the default tab value from `"checklist"` to `"documents-list"`.

