

# Plan: Add Edit Functionality for Related Applicants

## Overview

Add an edit button next to each related applicant's delete button, and reuse the existing `AddRelatedApplicantDialog` by converting it to support both add and edit modes.

## Changes

### 1. Update `AddRelatedApplicantDialog.tsx` to support edit mode

- Rename to a dual-purpose dialog (keep filename, update props)
- Add optional `initialData` prop with the applicant data to edit
- Add optional `mode` prop (`"add"` | `"edit"`, default `"add"`)
- When `initialData` is provided, pre-fill the form with existing values instead of `DEFAULT_FORM`
- Change dialog title to "Edit Related Applicant" and button to "Save Changes" when in edit mode

### 2. Update `RelatedApplicantsSection.tsx`

- Add `Pencil` icon import from lucide-react
- Add `applicantToEdit` state (`RelatedApplicant | null`)
- Add `editApplicantMutation` that updates the specific applicant in the JSONB array (maps over `relatedApplicants`, replaces matching ID, writes back to Supabase)
- Add an edit button (pencil icon) next to the delete button for each applicant row
- Render the dialog in edit mode when `applicantToEdit` is set, passing the applicant data as `initialData`

## Technical Details

### `AddRelatedApplicantDialog.tsx` changes

| Area | Change |
|------|--------|
| Props | Add `initialData?: RelatedApplicantFormData & { id?: string }` and `mode?: "add" \| "edit"` |
| useEffect | Pre-fill form from `initialData` when provided, otherwise use `DEFAULT_FORM` |
| Dialog title | Conditional: "Edit Related Applicant" vs "Add Related Applicant" |
| Submit button | Conditional: "Save Changes" vs "Add Applicant" |

### `RelatedApplicantsSection.tsx` changes

| Area | Change |
|------|--------|
| State | Add `applicantToEdit` state |
| Mutation | Add `editApplicantMutation` that maps over array and replaces matching entry by ID |
| UI | Add pencil edit button next to trash button per row |
| Dialog | Pass `initialData` and `mode="edit"` when editing; reuse `onAdd` callback for both add/edit by checking mode |

### Applicant row actions layout

Each row will have two icon buttons side by side:
- Pencil (edit) -- opens dialog pre-filled with that applicant's data
- Trash (delete) -- existing delete confirmation behavior

