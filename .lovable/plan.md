

# Enhance Add Custom Document with Category and Applicant Selection

## Problem

Currently, the "Add Custom Document" feature in the Application Detail page is a simple text input that only allows entering a document name. The user wants to add:
1. **Document Category** selection (Identity, Character, Health, etc.)
2. **Applicant Type** selection (Primary Applicant, Partner, Dependant, etc.) based on the applicants in the current application

## Solution

Transform the simple inline input into a dialog-based form with:
1. Document name input
2. Category dropdown (using the same categories as DocumentChecklist)
3. Applicant type dropdown (populated from the application's actual applicants)

## Files to Change

| File | Change |
|------|--------|
| `src/pages/migration/ApplicationDetail.tsx` | Add dialog, state, fetch applicants, update mutation |

## Implementation Details

### 1. Add Default Categories Constant
Add the same document categories used in DocumentChecklist.tsx:
```typescript
const defaultCategories = [
  "Identity", "Character", "Health", "Employment", "Skills",
  "English", "Education", "Financial", "Relationship",
  "Sponsor", "Insurance", "Nomination", "Other",
];
```

### 2. Add State for Dialog and Form Fields
```typescript
const [isAddDocOpen, setIsAddDocOpen] = useState(false);
const [newDocForm, setNewDocForm] = useState({
  name: "",
  category: "",
  applicantType: "",
});
```

### 3. Fetch Application Applicants
Add a query to fetch the applicants linked to this application:
```typescript
const { data: applicationApplicants = [] } = useQuery({
  queryKey: ["application-applicants", visaApplicationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("application_applicants")
      .select(`
        id, 
        applicant_type:applicant_types(id, code, name),
        client:clients(id, first_name, last_name)
      `)
      .eq("visa_application_id", visaApplicationId)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
  enabled: !!visaApplicationId,
});
```

### 4. Update the Mutation
Update `addDocumentMutation` to include category and applicant_type:
```typescript
const addDocumentMutation = useMutation({
  mutationFn: async (doc: { name: string; category: string; applicantType: string }) => {
    const { data, error } = await supabase
      .from("document_checklist")
      .insert({
        visa_application_id: visaApplicationId,
        company_id: visaApplication.company_id,
        document_name: `[Custom] ${doc.name}`,
        category: doc.category || "Other",
        applicant_type: doc.applicantType || null,
        is_completed: false,
        review_status: "pending_client",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["document-checklist", visaApplicationId] });
    setNewDocForm({ name: "", category: "", applicantType: "" });
    setIsAddDocOpen(false);
    toast.success("Document added to checklist");
  },
});
```

### 5. Replace Inline Form with Dialog Trigger
Replace the current inline input with a button that opens a dialog:
```tsx
{/* Add Custom Document */}
<div className="card-gradient rounded-xl border border-border/50 p-6">
  <div className="flex items-center justify-between">
    <h3 className="font-semibold">Add Custom Document</h3>
    <Button variant="outline" onClick={() => setIsAddDocOpen(true)}>
      <Plus className="w-4 h-4 mr-2" />
      Add Document
    </Button>
  </div>
</div>
```

### 6. Add Dialog Component
```tsx
<Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Custom Document</DialogTitle>
      <DialogDescription>
        Add a custom document to the checklist.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      {/* Document Name */}
      <div className="space-y-2">
        <Label>Document Name</Label>
        <Input
          value={newDocForm.name}
          onChange={(e) => setNewDocForm({ ...newDocForm, name: e.target.value })}
          placeholder="Enter document name..."
        />
      </div>
      
      {/* Category Dropdown */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={newDocForm.category}
          onValueChange={(value) => setNewDocForm({ ...newDocForm, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {defaultCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Applicant Type Dropdown */}
      <div className="space-y-2">
        <Label>For Applicant</Label>
        <Select
          value={newDocForm.applicantType}
          onValueChange={(value) => setNewDocForm({ ...newDocForm, applicantType: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select applicant (optional)..." />
          </SelectTrigger>
          <SelectContent>
            {applicationApplicants.map((applicant) => (
              <SelectItem 
                key={applicant.id} 
                value={applicant.applicant_type?.name || "Unknown"}
              >
                {applicant.applicant_type?.name} 
                {applicant.client && ` - ${applicant.client.first_name} ${applicant.client.last_name || ""}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => setIsAddDocOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={() => addDocumentMutation.mutate(newDocForm)}
        disabled={!newDocForm.name.trim() || addDocumentMutation.isPending}
      >
        {addDocumentMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Add Document
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

## Visual Result

**Before:**
```
┌─────────────────────────────────────────────┐
│ Add Custom Document                         │
│ [Document name...          ] [+ Add]        │
└─────────────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────────────┐
│ Add Custom Document            [+ Add Document] │
└─────────────────────────────────────────────┘

Dialog opens with:
┌─────────────────────────────────────────────┐
│ Add Custom Document                      ✕  │
│ Add a custom document to the checklist.     │
│                                             │
│ Document Name                               │
│ [Enter document name...                  ]  │
│                                             │
│ Category                                    │
│ [Select category...                    ▾]  │
│                                             │
│ For Applicant                               │
│ [Select applicant (optional)...        ▾]  │
│   - Primary Applicant - John Smith          │
│   - Partner - Jane Smith                    │
│   - Dependant - Tom Smith                   │
│                                             │
│                      [Cancel] [+ Add Document] │
└─────────────────────────────────────────────┘
```

The document will then appear in the correct category section and under the correct applicant type heading in the document checklist.

