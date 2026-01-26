

## Store Related Applicants as JSON on Client Profile

### Overview
Change the data model so that Partner, Dependant, and Witness information is stored as a JSON array directly on the client (main applicant) record. This means a client can have related people (family members, witnesses) attached to their profile without needing to create them as separate clients.

---

### New Data Model

**Current Model:**
```text
clients table
├── first_name, last_name
├── email, phone
└── (no related applicants)

application_applicants (junction table)
├── visa_application_id
├── client_id → clients table
└── applicant_type_id
```

**Proposed Model:**
```text
clients table
├── first_name, last_name
├── email, phone
├── related_applicants (NEW - JSON array)
│   ├── [0] { type: "partner", first_name, last_name, date_of_birth, ... }
│   ├── [1] { type: "dependant", first_name, last_name, date_of_birth, relationship, ... }
│   ├── [2] { type: "dependant", first_name, last_name, date_of_birth, relationship, ... }
│   └── [3] { type: "witness", first_name, last_name, ... }
```

---

### Database Changes

**Add new column to `clients` table:**

```sql
ALTER TABLE public.clients
ADD COLUMN related_applicants JSONB DEFAULT '[]'::jsonb;
```

**JSON Structure for each related applicant:**
```json
{
  "id": "uuid-generated-locally",
  "type": "partner" | "dependant" | "witness",
  "first_name": "Maria",
  "last_name": "Santos",
  "date_of_birth": "1990-05-15",
  "passport_number": "ABC123456",
  "nationality": "Brazil",
  "relationship": "Spouse" | "Child" | "Step-child" | "Witness"
}
```

---

### UI Changes

#### 1. Client Detail Page - New "Related Applicants" Section

After the main client info, show a card for related applicants:

```text
┌─────────────────────────────────────────────────────────┐
│ Related Applicants                           [+ Add]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👤 Maria Santos                                    [✕]  │
│    Partner • Spouse                                     │
│    DOB: 15 May 1990 • Passport: ABC123456               │
│                                                         │
│ 👤 João Santos                                     [✕]  │
│    Dependant • Child                                    │
│    DOB: 10 Mar 2015 • Passport: DEF789012               │
│                                                         │
│ 👤 Ana Santos                                      [✕]  │
│    Dependant • Child                                    │
│    DOB: 22 Jul 2018 • Passport: GHI345678               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 2. Add Related Applicant Dialog

```text
┌─────────────────────────────────────────────────────────┐
│ Add Related Applicant                               ✕   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Type                                                    │
│ [Partner ▼]                                             │
│                                                         │
│ First Name *                                            │
│ [________________]                                      │
│                                                         │
│ Last Name *                                             │
│ [________________]                                      │
│                                                         │
│ Date of Birth                                           │
│ [DD/MM/YYYY]                                            │
│                                                         │
│ Passport Number                                         │
│ [________________]                                      │
│                                                         │
│ Nationality                                             │
│ [Australia ▼]                                           │
│                                                         │
│ Relationship                                            │
│ [Spouse ▼]  (options change based on type)              │
│                                                         │
│              [Cancel]  [Add Applicant]                  │
└─────────────────────────────────────────────────────────┘
```

**Relationship options by type:**
- **Partner**: Spouse, De facto partner
- **Dependant**: Child, Step-child, Adopted child
- **Witness**: Witness (fixed)

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| New migration file | Create | Add `related_applicants` JSONB column to clients |
| `src/components/client/RelatedApplicantsSection.tsx` | Create | New component to display and manage related applicants |
| `src/components/client/AddRelatedApplicantDialog.tsx` | Create | Dialog form to add/edit a related applicant |
| `src/pages/migration/ClientDetail.tsx` | Modify | Add RelatedApplicantsSection to the client detail page |
| `src/pages/migration/Clients.tsx` | Modify | Update Client interface to include related_applicants |
| `src/integrations/supabase/types.ts` | Auto-update | Will include new column after migration |

---

### TypeScript Interfaces

```typescript
interface RelatedApplicant {
  id: string;  // UUID generated client-side
  type: "partner" | "dependant" | "witness";
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  passport_number?: string;
  nationality?: string;
  relationship: string;
}

interface Client {
  // ... existing fields ...
  related_applicants: RelatedApplicant[];
}
```

---

### Application Creation Flow Update

When creating an application, the "Applicants" section changes to:

1. **Primary Applicant**: The main client (auto-selected)
2. **Additional Applicants**: Show checkboxes/toggles to include related applicants from the client's profile

```text
Applicants
─────────────────────────────────────────
Primary Applicant
[Anderson Santos ✓] (auto-selected)

Include Related Applicants
☑ Maria Santos (Partner - Spouse)
☑ João Santos (Dependant - Child)
☑ Ana Santos (Dependant - Child)
☐ Carlos Silva (Witness) 
─────────────────────────────────────────
```

This allows selecting which of the client's related applicants should be included in this specific application.

---

### Benefits of This Approach

1. **Simpler workflow**: Add family members once to client profile, reuse across applications
2. **Client-centric**: Related people belong to the main applicant, not floating as separate clients
3. **Flexibility**: Can include or exclude related applicants per application
4. **No duplicate clients**: Partner and children don't clutter the client list
5. **Cleaner data model**: Related applicants are scoped to their primary client

---

### Technical Considerations

- Use `crypto.randomUUID()` to generate IDs for related applicants
- Store dates in ISO format (YYYY-MM-DD)
- JSONB allows querying and indexing if needed later
- Update RPC function `get_clients_secure` to include `related_applicants`
- Consider adding a utility function to get applicant by ID from the JSON array

