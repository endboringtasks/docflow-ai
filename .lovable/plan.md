

# Add Date of Birth, Passport Number, and Nationality to Client Form

## Overview

Add three new personal information fields to the Create New Client and Edit Client dialogs. These fields are optional and only shown for personal (non-corporate) clients.

## Database Changes

Add three new nullable columns to the `clients` table:

| Column | Type | Description |
|--------|------|-------------|
| `date_of_birth` | `date` | Client's date of birth |
| `passport_number` | `text` | Client's passport number |
| `nationality` | `text` | Client's nationality (e.g., "Australian") |

## UI Changes

### Create Client Dialog (Personal clients only)

New field order after the current fields:

```
First Name *        [________________]
Last Name *         [________________]
Date of Birth       [____-__-__      ]    ← NEW
Passport Number     [________________]    ← NEW  
Nationality         [🇦🇺 Australian  ▼]    ← NEW (reusing NationalitySelect)
Email *             [________________]
Phone *             [🇦🇺 +61 ▼][____]
```

### Edit Client Dialog

Same fields added in the same location.

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add 3 new columns to clients table |
| `src/integrations/supabase/types.ts` | Add new fields to types (auto-generated) |
| `src/pages/migration/Clients.tsx` | Update form state, create/edit handlers, add form fields |

## Implementation Details

### 1. Database Migration

```sql
ALTER TABLE clients
ADD COLUMN date_of_birth date,
ADD COLUMN passport_number text,
ADD COLUMN nationality text;
```

### 2. Form State Updates

Update `newClient` and `editForm` state to include:

```typescript
const [newClient, setNewClient] = useState({
  clientType: "personal" as "personal" | "corporate",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phoneCountryCode: "+61",
  phoneNumber: "",
  dateOfBirth: "",        // NEW
  passportNumber: "",      // NEW
  nationality: "",         // NEW
});
```

### 3. Create Handler Update

```typescript
createClientMutation.mutate({
  // ... existing fields
  date_of_birth: isCorporate ? null : (newClient.dateOfBirth || null),
  passport_number: isCorporate ? null : (newClient.passportNumber.trim() || null),
  nationality: isCorporate ? null : (newClient.nationality || null),
});
```

### 4. Form Fields (for personal clients)

After Last Name, before Email:

```tsx
{/* Date of Birth */}
<div className="space-y-2">
  <Label>Date of Birth</Label>
  <Input
    type="date"
    value={newClient.dateOfBirth}
    onChange={(e) => setNewClient({...newClient, dateOfBirth: e.target.value})}
    className="bg-secondary border-border"
  />
</div>

{/* Passport Number */}
<div className="space-y-2">
  <Label>Passport Number</Label>
  <Input
    value={newClient.passportNumber}
    onChange={(e) => setNewClient({...newClient, passportNumber: e.target.value})}
    placeholder="Enter passport number"
    className="bg-secondary border-border"
  />
</div>

{/* Nationality */}
<div className="space-y-2">
  <Label>Nationality</Label>
  <NationalitySelect
    value={newClient.nationality}
    onValueChange={(value) => setNewClient({...newClient, nationality: value})}
    placeholder="Select nationality..."
  />
</div>
```

### 5. Edit Form Population

When opening edit dialog, populate the new fields:

```typescript
const handleEditClient = (client: Client) => {
  // ... existing code
  setEditForm({
    // ... existing fields
    dateOfBirth: client.date_of_birth || "",
    passportNumber: client.passport_number || "",
    nationality: client.nationality || "",
  });
};
```

## Visual Result

**Create Client Dialog (Personal type):**

```
┌─────────────────────────────────────────┐
│  Create New Client                    ✕ │
│  Add a new visa applicant...            │
├─────────────────────────────────────────┤
│  Client Type                            │
│  [Personal                          ▼]  │
│                                         │
│  First Name *                           │
│  [John                               ]  │
│                                         │
│  Last Name *                            │
│  [Smith                              ]  │
│                                         │
│  Date of Birth                          │
│  [1990-05-15                         ]  │
│                                         │
│  Passport Number                        │
│  [PA1234567                          ]  │
│                                         │
│  Nationality                            │
│  [🇦🇺 Australian                     ▼]  │
│                                         │
│  Email *                                │
│  [john@example.com                   ]  │
│                                         │
│  Phone *                                │
│  [🇦🇺 +61 ▼] [412345678             ]  │
│                                         │
│    [Cancel]        [Create Client]      │
└─────────────────────────────────────────┘
```

These fields will help capture essential visa applicant information at the point of client creation, improving data completeness for migration services workflows.

