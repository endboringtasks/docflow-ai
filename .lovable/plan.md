

## Remove Timeline Dot from Document History

The small circle (timeline dot) shown to the left of archived/deleted file entries in the document history will be removed, along with the vertical connector line between entries.

### Changes

**File: `src/components/visa-application/DocumentHistorySection.tsx`**

- Remove the timeline connector line (vertical bar between entries, lines ~206-208)
- Remove the timeline dot element (the circle, lines ~212-216)
- Remove the outer flex container that creates the dot + content layout, so the content card renders directly without the left-side timeline decoration
- Keep all other content (file info, dates, buttons, rejection reasons) unchanged

This simplifies the history entries to just show the content cards without the timeline visual treatment.

