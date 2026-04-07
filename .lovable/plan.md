

## Update Application Card Display

### Summary
Three changes to how application cards display across the app:
1. Show visa subclass code after the flag: `🇦🇺 500 Student`
2. Replace the "Subclass 500 - Student Visa" line with the subcategory name
3. Add an application number in format `500-Student-b5dc8956` (visa_subclass + application_name + first 8 chars of UUID)

### Changes

**File: `src/pages/migration/ApplicationDetail.tsx` (header area ~lines 1867-1883)**

1. Change the title line from `🇦🇺 Student` to `🇦🇺 500 Student` — insert `visa_subclass` between flag and `application_name`
2. Replace the "Subclass 500 - Student Visa" paragraph with the subcategory name (need to fetch subcategories data — currently not loaded in this component)
3. Add application number line: `500-Student-b5dc8956` using `visa_subclass`, `application_name`, and first 8 chars of `id`
4. Fetch `application_subcategories` in the existing data-loading query so subcategory name is available

**File: `src/pages/migration/ClientDetail.tsx` (~lines 773-792)**

1. Same title change: insert `visa_subclass` code between flag and `application_name`
2. Replace the `visa_subclass` subtitle line with subcategory name (need to add `subcategory_id` to interface and fetch subcategories)
3. Add application number below
4. Update `VisaApplication` interface to include `subcategory_id`
5. Fetch `application_subcategories` reference data

**File: `src/pages/migration/Applications.tsx` (~lines 1140-1172)**

1. Same title change: insert `visa_subclass` between flag and name
2. In the subtitle line, replace the `visa_subclass` text with subcategory name (already available via `getSubcategoryName`)
3. Remove the existing subcategory Badge (now shown in subtitle instead)
4. Add application number

### Application Number Format
Computed client-side: `{visa_subclass}-{application_name}-{id.slice(0,8)}`
Example: `500-Student-b5dc8956`
No database changes needed — purely derived from existing fields.

