
## Goal
Make the **History → View** button open an **in-app preview (visualization)** instead of opening a new browser tab (currently opening a `data:application/pdf;base64,...` URL). Also ensure the **“Previous Versions”** header text does not appear on the Application Detail page (keep history inline).

---

## What’s happening now (root cause)
- `DocumentHistorySection` only opens a preview inside the app **if** an `onViewDocument` callback is provided.
- On the Application Detail page (`src/pages/migration/ApplicationDetail.tsx`), we currently render:
  - `inline={true}` (so “Previous Versions” is already removed)
  - but we do **not** pass `onViewDocument`
- Therefore `DocumentHistorySection` falls back to:
  - `window.open(signedUrl, "_blank")`
- For Google Drive PDFs, the edge function returns a `data:application/pdf;base64,...` URL, which the browser opens in a new tab.

---

## Implementation approach
We’ll keep `inline={true}` (so no “Previous Versions” text), and wire the View button to an **in-page modal viewer** that renders the PDF/image with an `<iframe>` or `<img>`.

This avoids trying to “trick” the existing Preview & Review dialog (which is designed for reviewing the *current* document and includes approve/reject actions that shouldn’t apply to archived versions).

---

## Changes to make

### 1) `src/pages/migration/ApplicationDetail.tsx`
#### A. Add state for an “archived/history preview” modal
Add something like:
- `historyPreview` state: `{ url: string; name: string } | null`
- optional zoom/rotation state (can be minimal at first)

#### B. Pass `onViewDocument` into both `DocumentHistorySection` usages
There are two locations (attachments view + legacy single-file view). Update both:

- Keep:
  - `inline={true}`
- Add:
  - `onViewDocument={(url, fileName) => setHistoryPreview({ url, name: fileName })}`

This ensures the View button never calls `window.open(...)` from this page.

#### C. Render a new Dialog for visualization
Near the bottom of the page (close to where `DocumentPreviewDialog` is rendered), add a new `<Dialog>`:

- `open={!!historyPreview}`
- `onOpenChange={(open) => !open && setHistoryPreview(null)}`

Dialog content:
- Title: `historyPreview?.name`
- If `name` ends with image extensions → `<img src={historyPreview.url} />`
- If `name` ends with `.pdf` → `<iframe src={historyPreview.url} />`
- Otherwise → show “Preview not available” with a button “Open in new tab” (optional fallback)

This will display the base64 `data:` PDF directly inside the app (no new tab).

---

## Optional cleanup (recommended, but not required for the fix)
Since the user asked to “move the history from preview/review to this page”, we can simplify the review dialog:

### 2) `src/components/visa-application/DocumentPreviewDialog.tsx`
- Add a prop like `showHistoryTab?: boolean` (default `true`)
- In `ApplicationDetail.tsx`, pass `showHistoryTab={false}` so History doesn’t appear in the review dialog anymore (avoids duplication/confusion)

If you want this, I’ll include it in the same implementation pass; otherwise we can leave it.

---

## Acceptance criteria (how we’ll verify)
1. On Application Detail, under a document’s history list, clicking **View**:
   - opens an **in-app dialog**
   - does **not** open a new browser tab
2. The preview works for:
   - Google Drive archived PDFs (the `data:application/pdf;base64,...` URL renders inside the iframe)
   - Supabase storage archived PDFs/images (signed URLs render)
3. The “Previous Versions” header is not shown on this page (history remains inline).
4. Quick regression check:
   - Client Portal still behaves as before (collapsible header + new-tab behavior where appropriate), because we’re only changing how Application Detail passes callbacks.

---

## Files involved
- `src/pages/migration/ApplicationDetail.tsx` (required)
- `src/components/visa-application/DocumentPreviewDialog.tsx` (optional cleanup to hide/remove the History tab there)
