## Goal

On the Application page, each document currently shows only a status badge (Approved/Rejected/etc.) and Download/Review buttons. There's no visible audit trail of **who uploaded** the file and **who approved or rejected** it. We'll surface that information directly on each document card.

The good news: all the required data is already fetched per document — `uploadedByName` / `uploadedByClientName`, `uploadedAt`, `reviewedByName`, `reviewedAt`, and `reviewStatus`. No backend or query changes are needed; this is a presentation-only change.

## What will be added

For each document that has at least one uploaded file, render a small muted audit line beneath the document row showing:

- **Uploaded by** — agent name, or client name with a "(Client)" tag, plus the upload date/time.
- **Reviewed by** — for approved/rejected documents only: the reviewer's name plus the review date/time, colored green for approved and red for rejected (matching existing badge styling). If a document is approved/rejected but has no reviewer recorded, show just the action and date.

Example rendering:

```text
Uploaded by Anderson Santos (Client) · Jun 1, 2026 at 8:07 pm
Approved by Maria Lopez · Jun 1, 2026 at 8:40 pm
```

This mirrors the existing audit format already used in the Document History timeline (the `DocumentHistorySection` component), keeping the styling consistent.

## Where

`src/pages/migration/ApplicationDetail.tsx` — inside the document card map (around the document row at lines ~2366–2459), add the audit line within the card, shown only when `doc.attachmentCount > 0`. Uses `date-fns` `format` (already imported) for timestamps and existing semantic color tokens. No other files change.

## Notes

- Purely additive UI; no schema, query, or business-logic changes.
- Respects the existing enterprise/compliance tone (formal, read-only audit text).
- Will verify rendering in the preview against the attached screenshot layout.
