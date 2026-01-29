

# Remove "New Application" and "Create Application" Buttons from Client Detail

## Overview

Remove the two application creation buttons from the client detail page in the Applications section:

1. **"New Application" button** - In the section header (top right of Applications section)
2. **"Create Application" button** - In the empty state when there are no applications

## File to Change

| File | Change |
|------|--------|
| `src/pages/migration/ClientDetail.tsx` | Remove both buttons from the Applications section |

## Changes

### 1. Remove "New Application" Button from Header

**Before (lines 631-637):**
```tsx
<div className="flex items-center justify-between">
  <h2 className="text-xl font-semibold">Applications</h2>
  <Button onClick={() => setIsCreateApplicationOpen(true)}>
    <Plus className="w-4 h-4 mr-2" />
    New Application
  </Button>
</div>
```

**After:**
```tsx
<div className="flex items-center justify-between">
  <h2 className="text-xl font-semibold">Applications</h2>
</div>
```

### 2. Remove "Create Application" Button from Empty State

**Before (lines 639-650):**
```tsx
{visaApplications.length === 0 ? (
  <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="text-lg font-medium mb-2">No Applications</h3>
    <p className="text-muted-foreground mb-4">
      Create the first application for this client.
    </p>
    <Button onClick={() => setIsCreateApplicationOpen(true)}>
      <Plus className="w-4 h-4 mr-2" />
      Create Application
    </Button>
  </div>
) : (
```

**After:**
```tsx
{visaApplications.length === 0 ? (
  <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="text-lg font-medium mb-2">No Applications</h3>
    <p className="text-muted-foreground">
      This client has no applications yet.
    </p>
  </div>
) : (
```

## Visual Result

**Before:**
```
Applications                    [+ New Application]
┌─────────────────────────────────────────────────┐
│         📄                                      │
│    No Applications                              │
│    Create the first application for this client │
│         [+ Create Application]                  │
└─────────────────────────────────────────────────┘
```

**After:**
```
Applications
┌─────────────────────────────────────────────────┐
│         📄                                      │
│    No Applications                              │
│    This client has no applications yet.         │
└─────────────────────────────────────────────────┘
```

Users will need to create applications from the main Applications page (`/app/migration/applications`) instead.

