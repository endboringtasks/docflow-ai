

## Block "Invite Client" Button on Drive Mismatch

### What Changes

The "Invite Client" button on the ApplicationDetail page will be **disabled** when a Google Drive account mismatch is detected. A tooltip will explain why, and suggest two options: reconnect the original Drive account, or create a new client/application on the current Drive account.

### How It Works

1. **Lift the mismatch computation** -- Currently `isDriveMismatch` is computed inline inside the folder status button's render function (around line 1906). Move it to the component body level so both the folder button and the Invite Client button can reference it.

2. **Disable the Invite Client button** -- When `isDriveMismatch` is true, the button becomes disabled with `opacity-50 cursor-not-allowed` styling.

3. **Add a tooltip** -- Wrap the button in a Tooltip that explains the situation when disabled:
   > "Cannot invite client: this application's folder was created with [bound email], but Drive is now connected to [current email]. Reconnect the original account or create a new client and application on the current Drive account."

### Technical Details

**File: `src/pages/migration/ApplicationDetail.tsx`**

- Move these lines from the inline render (around line 1906) to the component body (before the JSX return):
  ```typescript
  const boundEmail = clientDriveEmail;
  const currentEmail = driveStatus?.connected_email;
  const isDriveMismatch = isDriveConnected && !!boundEmail && !!currentEmail && boundEmail !== currentEmail;
  ```

- Update the Invite Client button (line 1862) from:
  ```tsx
  <Button variant="outline" onClick={() => setIsInviteOpen(true)}>
    <Mail className="w-4 h-4 mr-2" />
    Invite Client
  </Button>
  ```
  To a tooltip-wrapped, conditionally disabled button:
  ```tsx
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={isDriveMismatch ? 0 : undefined}>
          <Button
            variant="outline"
            onClick={() => setIsInviteOpen(true)}
            disabled={isDriveMismatch}
          >
            <Mail className="w-4 h-4 mr-2" />
            Invite Client
          </Button>
        </span>
      </TooltipTrigger>
      {isDriveMismatch && (
        <TooltipContent side="bottom" className="max-w-xs">
          Cannot invite client: folder was created with {boundEmail},
          but Drive is now connected to {currentEmail}. Reconnect the
          original account or create a new client and application on
          the current Drive account.
        </TooltipContent>
      )}
    </Tooltip>
  </TooltipProvider>
  ```

- The inline folder status render will reference the same component-level variables instead of re-declaring them.

| File | Change |
|---|---|
| `src/pages/migration/ApplicationDetail.tsx` | Lift `isDriveMismatch` to component body; disable Invite Client button with tooltip when mismatch detected |
