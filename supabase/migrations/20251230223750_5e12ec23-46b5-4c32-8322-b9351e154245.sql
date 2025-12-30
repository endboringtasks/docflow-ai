-- ============================================
-- PHASE 1: RENAME MATTERS TABLE TO VISA_APPLICATIONS
-- ============================================

-- Drop existing RLS policies on matters table
DROP POLICY IF EXISTS "Users can view matters for their company" ON matters;
DROP POLICY IF EXISTS "Users can insert matters for their company" ON matters;
DROP POLICY IF EXISTS "Users can update matters for their company" ON matters;
DROP POLICY IF EXISTS "Users can delete matters for their company" ON matters;

-- Rename the table
ALTER TABLE matters RENAME TO visa_applications;

-- Rename the matter_name column
ALTER TABLE visa_applications RENAME COLUMN matter_name TO application_name;

-- ============================================
-- PHASE 2: UPDATE FOREIGN KEY REFERENCES
-- ============================================

-- Update document_checklist table
ALTER TABLE document_checklist RENAME COLUMN matter_id TO visa_application_id;

-- Update client_portal_access table
ALTER TABLE client_portal_access RENAME COLUMN matter_id TO visa_application_id;

-- Update client_form_data table
ALTER TABLE client_form_data RENAME COLUMN matter_id TO visa_application_id;

-- Update automation_events table
ALTER TABLE automation_events RENAME COLUMN matter_id TO visa_application_id;

-- ============================================
-- PHASE 3: CREATE LANGUAGES TABLE
-- ============================================

CREATE TABLE languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

-- Languages are readable by everyone
CREATE POLICY "Languages are publicly readable"
  ON languages FOR SELECT
  USING (true);

-- Only platform admins can modify languages
CREATE POLICY "Platform admins can manage languages"
  ON languages FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Seed initial languages
INSERT INTO languages (code, name, native_name, is_default, sort_order) VALUES
  ('en', 'English', 'English', true, 1),
  ('es', 'Spanish', 'Español', false, 2),
  ('pt', 'Portuguese', 'Português', false, 3),
  ('zh', 'Chinese', '中文', false, 4),
  ('ar', 'Arabic', 'العربية', false, 5),
  ('fr', 'French', 'Français', false, 6),
  ('de', 'German', 'Deutsch', false, 7),
  ('hi', 'Hindi', 'हिन्दी', false, 8),
  ('ja', 'Japanese', '日本語', false, 9),
  ('ko', 'Korean', '한국어', false, 10);

-- ============================================
-- PHASE 4: CREATE COUNTRIES TABLE
-- ============================================

CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_language_code TEXT REFERENCES languages(code),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- Countries are readable by everyone
CREATE POLICY "Countries are publicly readable"
  ON countries FOR SELECT
  USING (true);

-- Only platform admins can modify countries
CREATE POLICY "Platform admins can manage countries"
  ON countries FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Seed initial countries
INSERT INTO countries (code, name, default_language_code, sort_order) VALUES
  ('AU', 'Australia', 'en', 1),
  ('US', 'United States', 'en', 2),
  ('GB', 'United Kingdom', 'en', 3),
  ('CA', 'Canada', 'en', 4),
  ('NZ', 'New Zealand', 'en', 5),
  ('DE', 'Germany', 'de', 6),
  ('FR', 'France', 'fr', 7),
  ('ES', 'Spain', 'es', 8),
  ('IT', 'Italy', 'en', 9),
  ('JP', 'Japan', 'ja', 10),
  ('KR', 'South Korea', 'ko', 11),
  ('CN', 'China', 'zh', 12),
  ('IN', 'India', 'hi', 13),
  ('BR', 'Brazil', 'pt', 14),
  ('AE', 'United Arab Emirates', 'ar', 15),
  ('SG', 'Singapore', 'en', 16),
  ('IE', 'Ireland', 'en', 17),
  ('NL', 'Netherlands', 'en', 18),
  ('CH', 'Switzerland', 'de', 19),
  ('SE', 'Sweden', 'en', 20);

-- ============================================
-- PHASE 5: CREATE VISA_TYPES TABLE
-- ============================================

CREATE TABLE visa_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_id, code)
);

-- Enable RLS
ALTER TABLE visa_types ENABLE ROW LEVEL SECURITY;

-- Visa types are readable by everyone
CREATE POLICY "Visa types are publicly readable"
  ON visa_types FOR SELECT
  USING (true);

-- Only platform admins can modify visa types
CREATE POLICY "Platform admins can manage visa types"
  ON visa_types FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Seed Australian visa types
INSERT INTO visa_types (country_id, code, name, description, sort_order)
SELECT c.id, v.code, v.name, v.description, v.sort_order
FROM countries c
CROSS JOIN (VALUES
  ('482', 'Temporary Skill Shortage (Subclass 482)', 'Employer-sponsored temporary work visa', 1),
  ('186', 'Employer Nomination Scheme (Subclass 186)', 'Permanent employer-sponsored visa', 2),
  ('189', 'Skilled Independent (Subclass 189)', 'Points-tested permanent visa without sponsorship', 3),
  ('190', 'Skilled Nominated (Subclass 190)', 'State/territory nominated permanent visa', 4),
  ('491', 'Skilled Work Regional (Subclass 491)', 'Points-tested provisional regional visa', 5),
  ('494', 'Skilled Employer Sponsored Regional (Subclass 494)', 'Employer-sponsored regional provisional visa', 6),
  ('500', 'Student Visa (Subclass 500)', 'Study in Australia', 7),
  ('485', 'Temporary Graduate (Subclass 485)', 'Post-study work rights', 8),
  ('600', 'Visitor Visa (Subclass 600)', 'Tourism, business visitor, or family visit', 9),
  ('820/801', 'Partner Visa (Subclass 820/801)', 'Partner or spouse visa (onshore)', 10),
  ('309/100', 'Partner Visa (Subclass 309/100)', 'Partner or spouse visa (offshore)', 11),
  ('143', 'Contributory Parent (Subclass 143)', 'Permanent contributory parent visa', 12),
  ('188', 'Business Innovation and Investment (Subclass 188)', 'Business and investor provisional visa', 13),
  ('888', 'Business Innovation and Investment (Subclass 888)', 'Business and investor permanent visa', 14),
  ('407', 'Training Visa (Subclass 407)', 'Occupational training visa', 15),
  ('408', 'Temporary Activity (Subclass 408)', 'Temporary activity or event participation', 16)
) AS v(code, name, description, sort_order)
WHERE c.code = 'AU';

-- Seed US visa types
INSERT INTO visa_types (country_id, code, name, description, sort_order)
SELECT c.id, v.code, v.name, v.description, v.sort_order
FROM countries c
CROSS JOIN (VALUES
  ('H-1B', 'H-1B Specialty Occupation', 'Temporary work visa for specialty occupations', 1),
  ('H-2A', 'H-2A Temporary Agricultural', 'Seasonal agricultural workers', 2),
  ('H-2B', 'H-2B Temporary Non-Agricultural', 'Temporary non-agricultural workers', 3),
  ('L-1A', 'L-1A Intracompany Transferee Manager', 'Managers and executives transferred within company', 4),
  ('L-1B', 'L-1B Intracompany Transferee Specialized Knowledge', 'Specialized knowledge employees', 5),
  ('O-1', 'O-1 Extraordinary Ability', 'Individuals with extraordinary ability', 6),
  ('E-2', 'E-2 Treaty Investor', 'Investors from treaty countries', 7),
  ('EB-1', 'EB-1 Employment-Based First Preference', 'Priority workers, extraordinary ability', 8),
  ('EB-2', 'EB-2 Employment-Based Second Preference', 'Advanced degree professionals', 9),
  ('EB-3', 'EB-3 Employment-Based Third Preference', 'Skilled workers and professionals', 10),
  ('EB-5', 'EB-5 Immigrant Investor', 'Investment-based green card', 11),
  ('F-1', 'F-1 Student Visa', 'Academic students', 12),
  ('J-1', 'J-1 Exchange Visitor', 'Exchange visitor program', 13),
  ('B-1/B-2', 'B-1/B-2 Visitor Visa', 'Business or tourism', 14),
  ('K-1', 'K-1 Fiancé(e) Visa', 'Fiancé(e) of US citizen', 15)
) AS v(code, name, description, sort_order)
WHERE c.code = 'US';

-- Seed UK visa types
INSERT INTO visa_types (country_id, code, name, description, sort_order)
SELECT c.id, v.code, v.name, v.description, v.sort_order
FROM countries c
CROSS JOIN (VALUES
  ('SKILLED', 'Skilled Worker Visa', 'Employer-sponsored skilled work', 1),
  ('HEALTH', 'Health and Care Worker Visa', 'Healthcare sector workers', 2),
  ('ICT', 'Intra-company Transfer Visa', 'Transfer within multinational company', 3),
  ('GLOBAL', 'Global Talent Visa', 'Leaders or potential leaders in academia or arts', 4),
  ('STUDENT', 'Student Visa', 'Study at UK institution', 5),
  ('GRADUATE', 'Graduate Visa', 'Post-study work rights', 6),
  ('FAMILY', 'Family Visa', 'Join family member in UK', 7),
  ('INNOVATOR', 'Innovator Founder Visa', 'Start an innovative business', 8),
  ('STARTUP', 'Start-up Visa', 'Early-stage entrepreneurs', 9),
  ('VISITOR', 'Standard Visitor Visa', 'Tourism, business, medical treatment', 10),
  ('ANCESTRY', 'UK Ancestry Visa', 'Commonwealth citizens with UK-born grandparent', 11),
  ('YOUTH', 'Youth Mobility Scheme', 'Young people from participating countries', 12)
) AS v(code, name, description, sort_order)
WHERE c.code = 'GB';

-- Seed Canada visa types
INSERT INTO visa_types (country_id, code, name, description, sort_order)
SELECT c.id, v.code, v.name, v.description, v.sort_order
FROM countries c
CROSS JOIN (VALUES
  ('EE-FSW', 'Express Entry - Federal Skilled Worker', 'Points-based skilled worker program', 1),
  ('EE-FST', 'Express Entry - Federal Skilled Trades', 'Skilled trades workers', 2),
  ('EE-CEC', 'Express Entry - Canadian Experience Class', 'Candidates with Canadian work experience', 3),
  ('PNP', 'Provincial Nominee Program', 'Provincial/territorial nomination', 4),
  ('LMIA', 'Temporary Work Permit (LMIA)', 'Employer-specific work permit', 5),
  ('IEC', 'International Experience Canada', 'Youth work and travel', 6),
  ('STUDY', 'Study Permit', 'Study at designated institution', 7),
  ('PGWP', 'Post-Graduation Work Permit', 'Work after graduation', 8),
  ('VISITOR', 'Visitor Visa (TRV)', 'Tourism, business, family visit', 9),
  ('SPOUSE', 'Spousal Sponsorship', 'Sponsor spouse or partner', 10),
  ('PARENT', 'Parents and Grandparents Program', 'Sponsor parents/grandparents', 11),
  ('STARTUP', 'Start-up Visa', 'Entrepreneurs with innovative business', 12),
  ('INVESTOR', 'Quebec Investor Program', 'Business investors (Quebec)', 13)
) AS v(code, name, description, sort_order)
WHERE c.code = 'CA';

-- ============================================
-- PHASE 6: CREATE DOCUMENT_CHECKLIST_TEMPLATES TABLE
-- ============================================

CREATE TABLE document_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  country_id UUID REFERENCES countries(id),
  visa_type_id UUID REFERENCES visa_types(id),
  visa_subclass TEXT,
  document_name TEXT NOT NULL,
  category TEXT,
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE document_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Company members can view their templates
CREATE POLICY "Company members can view document templates"
  ON document_checklist_templates FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id) OR company_id IS NULL);

-- Admins/owners can manage their company's templates
CREATE POLICY "Admins can manage document templates"
  ON document_checklist_templates FOR ALL
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- ============================================
-- PHASE 7: CREATE TRANSLATIONS TABLE
-- ============================================

CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  language_code TEXT REFERENCES languages(code),
  field_name TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, entity_id, language_code, field_name)
);

-- Enable RLS
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Translations are readable by everyone
CREATE POLICY "Translations are publicly readable"
  ON translations FOR SELECT
  USING (true);

-- Platform admins can manage translations
CREATE POLICY "Platform admins can manage translations"
  ON translations FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Create updated_at trigger for translations
CREATE TRIGGER update_translations_updated_at
  BEFORE UPDATE ON translations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PHASE 8: ADD PREFERRED_LANGUAGE TO COMPANIES
-- ============================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- ============================================
-- PHASE 9: ADD COUNTRY_ID TO VISA_APPLICATIONS
-- ============================================

ALTER TABLE visa_applications ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id);

-- Set default country to Australia for existing records
UPDATE visa_applications 
SET country_id = (SELECT id FROM countries WHERE code = 'AU')
WHERE country_id IS NULL;

-- ============================================
-- PHASE 10: RECREATE RLS POLICIES FOR VISA_APPLICATIONS
-- ============================================

CREATE POLICY "Users can view visa applications for their company"
  ON visa_applications FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Users can insert visa applications for their company"
  ON visa_applications FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Users can update visa applications for their company"
  ON visa_applications FOR UPDATE
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can delete visa applications for their company"
  ON visa_applications FOR DELETE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- ============================================
-- PHASE 11: UPDATE DATABASE FUNCTIONS
-- ============================================

-- Update get_portal_matter_details to use new table name
CREATE OR REPLACE FUNCTION public.get_portal_visa_application_details(p_token text)
 RETURNS TABLE(visa_application_id uuid, application_name text, visa_subclass text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    va.id as visa_application_id,
    va.application_name,
    va.visa_subclass,
    va.status::text
  FROM public.client_portal_access cpa
  INNER JOIN public.visa_applications va ON va.id = cpa.visa_application_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  LIMIT 1;
$$;

-- Update get_portal_documents to use new column name
CREATE OR REPLACE FUNCTION public.get_portal_documents(p_token text)
 RETURNS TABLE(id uuid, document_name text, is_completed boolean, file_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    dc.id,
    dc.document_name,
    dc.is_completed,
    dc.file_path
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  ORDER BY dc.document_name;
$$;

-- Drop old function
DROP FUNCTION IF EXISTS public.get_portal_matter_details(text);

-- ============================================
-- PHASE 12: DROP OLD VISA_DOCUMENT_TEMPLATES TABLE
-- ============================================

DROP TABLE IF EXISTS visa_document_templates CASCADE;