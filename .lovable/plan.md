## Goal

Change how document guidance text is shown to clients in the Client Portal. Stop merging the two description fields into one block. Instead:

- If an **Application Checklist instruction** exists for a document → show **only** that instruction.
- If the Application Checklist instruction is empty → fall back to and show the **global (master) description**.

## Background

Today, the client portal combines both fields into one paragraph:

```text
[master/global description]
[application-specific instruction]
```

This happens in a single place — `src/pages/client-portal/ClientPortal.tsx` (around lines 1247–1259), where `cleanedDesc` (global description) and `cleanedInstructions` (Application Checklist instruction) are joined with a newline and rendered together.

No other view performs this merge, so only this one location needs to change. This is a frontend-only, presentation change — no database or business-logic changes.

## Change

In `ClientPortal.tsx`, replace the merge logic so it picks one value instead of joining both:

```text
- clean the global description (strip the [type:required/optional] tags) → cleanedDesc
- clean the instruction → cleanedInstructions
- displayText = cleanedInstructions (if non-empty) else cleanedDesc
- render displayText in the same <p> styling as today (only when non-empty and the doc is not completed)
```

Behaviour after change:

| Application Checklist instruction | Global description | Shown to client |
|---|---|---|
| Has text | (any) | Instruction only |
| Empty | Has text | Global description |
| Empty | Empty | Nothing (as today) |

## Out of scope

- No changes to how descriptions/instructions are stored or edited (admin tabs unchanged).
- No database migration.
- No changes to other views.
