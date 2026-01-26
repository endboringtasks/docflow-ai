
## Fix Applicant Selection to Use Related Applicants from Client Profile

### The Problem
The "Applicants" section in the Create Application dialog is currently looking for Partners and Dependants from **other clients** in the company. However, based on the new client-centric model we implemented, Partners/Dependants/Witnesses are now stored in the **`related_applicants` JSONB field** on the primary client's profile.

This is why you see "No available clients" in the dropdown - it's looking in the wrong place.

---

### The Solution
Modify the `ApplicantSelector` component to:
1. Fetch the selected client's `related_applicants` data
2. For each applicant type (Partner, Dependant, etc.), show only the related applicants that match that type
3. Update the state structure to store related applicant IDs instead of client IDs

---

### Technical Changes

#### 1. Update ApplicantSelector Component

**File: `src/components/visa-application/ApplicantSelector.tsx`**

| Change | Description |
|--------|-------------|
| Add new query | Fetch the primary client's `related_applicants` field |
| Filter by type | Show only related applicants that match the applicant type code |
| Update dropdown | Display related applicant names from the JSONB array |
| Update selection | Store related applicant ID (from JSONB) instead of client ID |

**New data flow:**
```text
Primary Client Selected
    ↓
Fetch client.related_applicants
    ↓
Filter by type:
  - Partner toggle → show applicants where type = "partner"
  - Dependant list → show applicants where type = "dependant"
  - Witness toggle → show applicants where type = "witness"
```

**Example related_applicants structure:**
```json
[
  { "id": "uuid-1", "type": "partner", "first_name": "Maria", "last_name": "Santos", ... },
  { "id": "uuid-2", "type": "dependant", "first_name": "João", "last_name": "Santos", ... }
]
```

#### 2. Update Props Interface

```typescript
// Remove clients prop - no longer needed
interface ApplicantSelectorProps {
  categoryId: string;
  primaryClientId: string;
  // clients: Client[];  ← REMOVE
  selections: ApplicantSelection;
  onSelectionsChange: (selections: ApplicantSelection) => void;
}
```

#### 3. Add Query for Client's Related Applicants

```typescript
// Inside ApplicantSelector component
const { data: primaryClientData } = useQuery({
  queryKey: ["client-related-applicants", primaryClientId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("first_name, last_name, company_name, client_type, related_applicants")
      .eq("id", primaryClientId)
      .single();
    if (error) throw error;
    return data;
  },
  enabled: !!primaryClientId,
});

const relatedApplicants = (primaryClientData?.related_applicants || []) as RelatedApplicant[];
```

#### 4. Update Filtering Logic

```typescript
// Get available related applicants for a type
const getAvailableApplicants = (typeCode: string, currentIndex: number) => {
  // Map applicant type code to related_applicants type
  const typeMapping: Record<string, string> = {
    partner: "partner",
    dependant: "dependant", 
    witness: "witness",
  };
  
  const matchingType = typeMapping[typeCode];
  if (!matchingType) return [];
  
  // Filter related applicants by type
  const applicantsOfType = relatedApplicants.filter(a => a.type === matchingType);
  
  // Exclude already selected ones
  const selectedIds = selections[typeId]?.clients || [];
  return applicantsOfType.filter(a => {
    const indexOfApplicant = selectedIds.indexOf(a.id);
    return indexOfApplicant === -1 || indexOfApplicant === currentIndex;
  });
};
```

#### 5. Update Dropdown Rendering

```typescript
// In the Select dropdown, show related applicants instead of clients
{availableApplicants.map((applicant) => (
  <SelectItem key={applicant.id} value={applicant.id}>
    {applicant.first_name} {applicant.last_name} ({applicant.relationship})
  </SelectItem>
))}
```

#### 6. Update Applications.tsx

**File: `src/pages/migration/Applications.tsx`**

- Remove the `clients` prop from `ApplicantSelector` usage (line 1126)

---

### Updated UI Flow

After these changes, when creating an application:

```text
1. Select client "Anderson Santos"
2. Select category "Visa"
3. Applicants section appears:
   
   ┌─────────────────────────────────────────┐
   │ Primary Applicant                       │
   │ 👤 Anderson Santos                      │
   ├─────────────────────────────────────────┤
   │ Partner                           [ON]  │
   │ ┌───────────────────────────────────┐   │
   │ │ Maria Santos (Spouse)          ▼ │   │
   │ └───────────────────────────────────┘   │
   ├─────────────────────────────────────────┤
   │ Dependant (max 10)                 [1]  │
   │ ┌───────────────────────────────────┐   │
   │ │ João Santos (Child)            ▼ │   │
   │ └───────────────────────────────────┘   │
   └─────────────────────────────────────────┘
```

---

### Edge Cases

1. **No related applicants**: Show helpful message "No [type] added to this client's profile"
2. **Empty state**: If client has no related applicants for a type, show "No available [type]s - add them in the client profile"
3. **Primary client display**: Use the fetched client data to show the name (already working)

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/visa-application/ApplicantSelector.tsx` | Add query for client data, filter by type, update dropdown content |
| `src/pages/migration/Applications.tsx` | Remove `clients` prop from ApplicantSelector |
