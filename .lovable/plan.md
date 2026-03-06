

## Problem

The admin `AdminDocumentsListTab` component is **read-only** -- it only displays a table with filters. There are no "Add Document", "Edit", or "Delete" buttons. The company-level `DocumentsListTab` has full CRUD, but the admin version was built as a view-only overview.

## Solution

Add full CRUD capabilities to `AdminDocumentsListTab`, matching the company-level component's functionality but adapted for the admin context (cross-company).

### Changes to `src/components/admin/AdminDocumentsListTab.tsx`

1. **Add "Add Document" button** with a dialog that includes a company selector (required), category, name, and description fields
2. **Add Edit and Delete action buttons** on each row (pencil + trash icons), same as the company-level component
3. **Edit dialog** with category, document name, description fields -- plus description sync via `sync_definition_description_to_all` RPC
4. **Delete confirmation** dialog (soft-delete by setting `is_active = false`)
5. Import mutations from `@tanstack/react-query` (`useMutation`, `useQueryClient`) and necessary UI components (`Dialog`, `AlertDialog`, `Textarea`, `Label`, action icons)

### No database changes needed

RLS already has a policy: "Platform admins can manage document definitions" with `FOR ALL` using `is_platform_admin(auth.uid())`. INSERT, UPDATE, DELETE are all covered.

