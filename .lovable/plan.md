

# Add Nationality Dropdown to Add Related Applicant Dialog

## Problem

The "Nationality" field in the Add Related Applicant dialog is currently a simple text input where users have to type the nationality manually. This is prone to typos and inconsistencies.

## Solution

Replace the text input with a searchable dropdown (combobox) that uses the existing country list. The dropdown will:
1. Show country flags alongside names for better visual recognition
2. Be searchable so users can quickly find their nationality
3. Use the existing `COUNTRY_CODES` list from `phone-input.tsx` (already has 60+ countries)

## Files to Change

| File | Change |
|------|--------|
| `src/lib/nationalities.ts` | Create a new file with nationality list and utility |
| `src/components/ui/nationality-select.tsx` | Create reusable NationalitySelect component |
| `src/components/client/AddRelatedApplicantDialog.tsx` | Replace text input with NationalitySelect |

## Implementation Details

### 1. Create Nationalities List (`src/lib/nationalities.ts`)

Create a comprehensive list of nationalities (derived from countries) that can be reused across the app:

```typescript
export interface Nationality {
  code: string;  // ISO country code (AU, US, etc.)
  name: string;  // Nationality name (Australian, American, etc.)
  country: string; // Country name (Australia, United States, etc.)
}

// Priority nationalities at top, then alphabetical
export const NATIONALITIES: Nationality[] = [
  { code: "AU", name: "Australian", country: "Australia" },
  { code: "GB", name: "British", country: "United Kingdom" },
  { code: "US", name: "American", country: "United States" },
  // ... ~100+ nationalities
];
```

### 2. Create NationalitySelect Component (`src/components/ui/nationality-select.tsx`)

A searchable combobox following the same pattern as the phone input:

```tsx
<Popover>
  <PopoverTrigger>
    <Button variant="outline">
      {selectedFlag} {selectedNationality}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Command>
      <CommandInput placeholder="Search nationality..." />
      <CommandList>
        {NATIONALITIES.map((nat) => (
          <CommandItem key={nat.code}>
            {getCountryFlag(nat.code)} {nat.name}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

### 3. Update AddRelatedApplicantDialog

Replace the Input with NationalitySelect:

```tsx
// Before
<Input
  value={form.nationality}
  onChange={(e) => setForm(prev => ({ ...prev, nationality: e.target.value }))}
  placeholder="Enter nationality"
/>

// After
<NationalitySelect
  value={form.nationality}
  onValueChange={(value) => setForm(prev => ({ ...prev, nationality: value }))}
  placeholder="Select nationality..."
/>
```

## Visual Result

**Before:**
```
Nationality
[Enter nationality...          ]
```

**After:**
```
Nationality
[🇦🇺 Australian              ▼]
  ↓ Opens searchable dropdown:
  ┌────────────────────────────┐
  │ 🔍 Search nationality...   │
  ├────────────────────────────┤
  │ 🇦🇺 Australian             │
  │ 🇬🇧 British                │
  │ 🇺🇸 American               │
  │ 🇳🇿 New Zealander          │
  │ 🇮🇳 Indian                 │
  │ 🇧🇷 Brazilian              │
  │ ...                        │
  └────────────────────────────┘
```

## Nationalities List

The list will include 100+ nationalities with priority countries first (Australia, UK, US, NZ, India) followed by alphabetical list. Each entry will have:
- ISO country code for flag display
- Nationality demonym (Australian, British, etc.)
- Country name for search fallback

