
## Add Dynamic Applicant Types to Application Creation and Management

### Overview
This implementation adds a new "Applicants" section to both the Create Application dialog and the Application Detail page. When creating an application, users will see applicant type options (Partner Yes/No, Dependant count 0-10, etc.) based on the selected category's configuration. After creation, users can add or remove applicants from the Application Detail page.

---

### Current Database State

The required tables already exist:
- `category_applicant_types` - Rules for each category (e.g., Visa allows Partner, Dependant)
- `application_applicants` - Tracks applicants per application
- `applicant_types` - Reference data (Primary, Partner, Dependant, Sponsor, Witness)

Current category configurations include:
- **Visa**: Primary (required), Partner (optional, max 2), Dependant (optional, multiple)
- **Citizenship**: Primary (required), Partner (optional), Dependant (optional, multiple)
- **Other categories**: Primary applicant only

---

### Part 1: Create Application Dialog Changes

**File: `src/pages/migration/Applications.tsx`**

#### 1. Add New State for Applicants

```typescript
// Track applicant selections during creation
const [applicantSelections, setApplicantSelections] = useState<{
  [applicantTypeId: string]: {
    enabled: boolean;
    clients: string[]; // Array of client IDs
  }
}>({});
```

#### 2. Add Query for Category Applicant Rules

```typescript
const { data: categoryApplicantRules = [] } = useQuery({
  queryKey: ["category-applicant-rules", newApplication.categoryId],
  queryFn: async () => {
    if (!newApplication.categoryId) return [];
    const { data, error } = await supabase
      .from("category_applicant_types")
      .select("*, applicant_type:applicant_types(id, code, name)")
      .eq("category_id", newApplication.categoryId)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
  enabled: !!newApplication.categoryId,
});
```

#### 3. Add Applicants Section to Dialog UI

After the "Application Name" selector, add a new collapsible "Applicants" section:

| Applicant Type | UI Behavior |
|----------------|-------------|
| **Primary** (is_required) | Auto-selected as main client, read-only display |
| **Partner** (optional, single) | Toggle Yes/No, shows client dropdown if Yes |
| **Dependant** (optional, multiple) | Number input (0-max), shows client dropdowns |
| **Sponsor** (required, single) | Required client dropdown |
| **Witness** (optional, single) | Toggle Yes/No, shows client dropdown if Yes |

Example UI flow:

```
----- Applicants -----

Primary Applicant
[Anderson Santos] (auto-selected, read-only)

Partner
[Yes] [No]
[Select partner...] (only shows if Yes)

Dependants (0-10)
[2]
Dependant 1: [Maria Santos]
Dependant 2: [+ Select client...]
```

#### 4. Update Create Mutation

After creating the visa_application, insert applicant records:

```typescript
// In onSuccess callback, insert applicants
const applicantRecords = [];

// Add primary applicant
const primaryRule = categoryApplicantRules.find(r => r.applicant_type?.code === 'primary');
if (primaryRule) {
  applicantRecords.push({
    visa_application_id: data.id,
    client_id: applicationData.client_id,
    applicant_type_id: primaryRule.applicant_type_id,
    is_primary: true,
    sort_order: 0,
  });
}

// Add other selected applicants
Object.entries(applicantSelections).forEach(([typeId, selection], index) => {
  if (selection.enabled && selection.clients.length > 0) {
    selection.clients.forEach((clientId, clientIndex) => {
      if (clientId) {
        applicantRecords.push({
          visa_application_id: data.id,
          client_id: clientId,
          applicant_type_id: typeId,
          is_primary: false,
          sort_order: (index + 1) * 10 + clientIndex,
        });
      }
    });
  }
});

if (applicantRecords.length > 0) {
  await supabase.from("application_applicants").insert(applicantRecords);
}
```

#### 5. Reset State When Category Changes

When category selection changes, reset applicant selections and pre-configure based on rules.

---

### Part 2: Application Detail Page Changes

**File: `src/pages/migration/ApplicationDetail.tsx`**

#### 1. Add Applicants Section in Application Info Area

Create a new "Applicants" card/section showing:
- All linked applicants with their types
- Add button for optional applicant types
- Remove button (X) for non-primary applicants

#### 2. Add New Queries

```typescript
// Fetch application applicants
const { data: applicationApplicants = [] } = useQuery({
  queryKey: ["application-applicants", visaApplicationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("application_applicants")
      .select(`
        id, 
        client_id, 
        applicant_type_id,
        is_primary,
        sort_order,
        applicant_type:applicant_types(id, code, name),
        client:clients(id, first_name, last_name, company_name, client_type)
      `)
      .eq("visa_application_id", visaApplicationId)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
  enabled: !!visaApplicationId,
});

// Fetch category applicant rules (to know what's allowed)
const { data: categoryRules = [] } = useQuery({
  queryKey: ["category-applicant-rules", visaApplication?.category_id],
  queryFn: async () => {
    if (!visaApplication?.category_id) return [];
    const { data, error } = await supabase
      .from("category_applicant_types")
      .select("*, applicant_type:applicant_types(id, code, name)")
      .eq("category_id", visaApplication.category_id)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
  enabled: !!visaApplication?.category_id,
});
```

#### 3. Add Mutations for Managing Applicants

```typescript
// Add applicant mutation
const addApplicantMutation = useMutation({
  mutationFn: async ({ clientId, applicantTypeId }: { 
    clientId: string; 
    applicantTypeId: string;
  }) => {
    const { error } = await supabase
      .from("application_applicants")
      .insert({
        visa_application_id: visaApplicationId,
        client_id: clientId,
        applicant_type_id: applicantTypeId,
        is_primary: false,
        sort_order: (applicationApplicants.length + 1) * 10,
      });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["application-applicants"] });
    toast.success("Applicant added");
  },
});

// Remove applicant mutation
const removeApplicantMutation = useMutation({
  mutationFn: async (applicantId: string) => {
    const { error } = await supabase
      .from("application_applicants")
      .delete()
      .eq("id", applicantId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["application-applicants"] });
    toast.success("Applicant removed");
  },
});
```

#### 4. UI for Applicants Section

```
┌─────────────────────────────────────────────────┐
│ Applicants                            [+ Add]   │
├─────────────────────────────────────────────────┤
│ 👤 Anderson Santos                              │
│    Primary Applicant                            │
│                                                 │
│ 👤 Maria Santos                           [✕]   │
│    Partner                                      │
│                                                 │
│ 👤 João Santos                            [✕]   │
│    Dependant                                    │
│                                                 │
│ 👤 Ana Santos                             [✕]   │
│    Dependant                                    │
└─────────────────────────────────────────────────┘

[+ Add] Dialog:
┌─────────────────────────────────────────────────┐
│ Add Applicant                               ✕   │
├─────────────────────────────────────────────────┤
│ Applicant Type                                  │
│ [Partner ▼]                                     │
│                                                 │
│ Client                                          │
│ [Select client... ▼]                            │
│                                                 │
│              [Cancel]  [Add Applicant]          │
└─────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/migration/Applications.tsx` | Add applicant state, query rules, render Applicants section in create dialog, update create mutation |
| `src/pages/migration/ApplicationDetail.tsx` | Add Applicants section, queries for applicants/rules, add/remove mutations and UI |

---

### Validation Rules

1. **Primary applicant** is automatically set from the main client
2. **Required applicants** must have a client selected before creating
3. **Max count** limits how many of a type can be added
4. **Min count** enforces minimum required (validation message if not met)
5. **Cannot remove** primary applicant
6. **Available client list** filters out already-selected clients for the same type

---

### Technical Considerations

- Applicants section only appears after category is selected
- Primary Applicant type (code: 'primary') is auto-added with main client
- Client dropdowns use existing `clients` array from the company
- For "allow_multiple" types, show count input or "Add another" pattern
- Dialog uses existing UI components (Select, Switch, Input, Button)

