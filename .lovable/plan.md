
# Add Client Name Prefix to Uploaded File Names

## Summary

Change the file naming convention for documents uploaded to Google Drive Visa Application folders:

**Current format**: `{DocumentName}_{OriginalFilename}`  
Example: `Passport_my_passport_scan.pdf`

**New format**: `{LASTNAME}_{FirstName}_{DocumentName}.{extension}`  
Example: `SANTOS_Anderson_Passport.pdf`

## Changes Required

### Both Edge Functions Need Updates

| File | Current Behavior | New Behavior |
|------|-----------------|--------------|
| `supabase/functions/client-portal-upload/index.ts` | Uses `cleanDocName_file.name` | Uses `{LASTNAME}_{FirstName}_{cleanDocName}.{ext}` |
| `supabase/functions/internal-upload/index.ts` | Uses `cleanDocName_file.name` | Uses `{LASTNAME}_{FirstName}_{cleanDocName}.{ext}` |

### Implementation Details

#### 1. Fetch Client Name When Getting Client Data

Both functions already fetch client data for folder IDs. Extend the query to include `first_name` and `last_name`:

```typescript
const { data: clientData } = await supabase
  .from('clients')
  .select('documents_received_folder_id, client_folder_id, first_name, last_name, company_name, client_type')
  .eq('id', applicationData.client_id)
  .single()
```

#### 2. Create Helper Function for Name Prefix

```typescript
function buildClientPrefix(clientData: {
  first_name: string | null
  last_name: string | null  
  company_name: string | null
  client_type: string
}): string {
  if (clientData.client_type === 'corporate' && clientData.company_name) {
    // For corporate clients, use sanitized company name
    return clientData.company_name.replace(/[^a-zA-Z0-9]/g, '_')
  }
  
  // For personal clients: LASTNAME_FirstName
  const lastName = clientData.last_name || 'Unknown'
  const firstName = clientData.first_name || 'Client'
  
  // Extract last word of last_name for multi-word surnames
  // "Ribeiro dos Santos" → "SANTOS"
  const lastNameParts = lastName.trim().split(/\s+/)
  const primaryLastName = lastNameParts[lastNameParts.length - 1].toUpperCase()
  
  // Capitalize first letter of first name
  const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  
  return `${primaryLastName}_${formattedFirstName}`
}
```

#### 3. Update Visa Application Folder Upload

**Current code (client-portal-upload around line 514):**
```typescript
const cleanDocName = docData.document_name.replace(/[^a-zA-Z0-9]/g, '_')
const driveFileName = `${cleanDocName}_${file.name}`
```

**New code:**
```typescript
const cleanDocName = docData.document_name.replace(/[^a-zA-Z0-9]/g, '_')
const fileExt = file.name.includes('.') ? file.name.split('.').pop() : ''
const clientPrefix = buildClientPrefix(clientData)
const driveFileName = `${clientPrefix}_${cleanDocName}.${fileExt}`
```

**Current code (internal-upload around line 486):**
```typescript
const cleanDocName = (documentName || 'Document').replace(/[^a-zA-Z0-9]/g, '_')
const driveFileName = `${cleanDocName}_${file.name}`
```

**New code:**
```typescript
const cleanDocName = (documentName || 'Document').replace(/[^a-zA-Z0-9]/g, '_')
const fileExt = file.name.includes('.') ? file.name.split('.').pop() : ''
const clientPrefix = buildClientPrefix(clientData)
const driveFileName = `${clientPrefix}_${cleanDocName}.${fileExt}`
```

## Examples

| Client Name | Document | Original File | New Drive Filename |
|-------------|----------|---------------|-------------------|
| Anderson Ribeiro dos Santos | Passport | scan123.pdf | `SANTOS_Anderson_Passport.pdf` |
| Maria Silva | Tax Returns | my_taxes.pdf | `SILVA_Maria_Tax_Returns.pdf` |
| ABC Corp (corporate) | Contract | doc.pdf | `ABC_Corp_Contract.pdf` |
| John O'Brien | Birth Certificate | cert.jpeg | `OBRIEN_John_Birth_Certificate.jpeg` |

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Missing last_name | Uses "Unknown" |
| Missing first_name | Uses "Client" |
| Multi-word surname | Takes last word: "Ribeiro dos Santos" → "SANTOS" |
| Corporate client | Uses sanitized company_name |
| Special characters in names | Removed via regex |

## Notes

- **Documents Received folder**: Continues to use **original filename** (unchanged) - this preserves the client's own naming for reference
- **Visa Application folder**: Uses the new `{LASTNAME}_{FirstName}_{DocumentName}.{ext}` format
- Client data is already being fetched in both functions - we just need to add name fields to the select
