# Docflow AI — Product Documentation

> **Version:** 1.0  
> **Date:** 2026-02-16  
> **Status:** Current Implementation (no roadmap items)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Feature Mapping by Domain](#3-feature-mapping-by-domain)
4. [Business Rules](#4-business-rules)
5. [Permissions & Roles Matrix](#5-permissions--roles-matrix)
6. [Data Model Summary](#6-data-model-summary)
7. [Technical Constraints](#7-technical-constraints)
8. [Test Scenarios](#8-test-scenarios)
9. [Gaps & Risks](#9-gaps--risks)

---

## 1. System Overview

**Docflow AI** is a multi-niche SaaS platform built for professional services firms. It provides document management, client management, and workflow automation with Google Drive integration.

**Brand structure:**
- **End Boring Tasks** — Company umbrella brand
- **Docflow AI** — Shared automation engine across niches

**Supported niches:**
- Migration Services (visa/immigration)
- Audit Services
- HR Services

Each niche uses the same core engine with industry-specific terminology, workflows, and UI.

**Tech stack:**
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Supabase (PostgreSQL, Auth, Edge Functions, Storage, Realtime)
- Integrations: Google Drive API, Stripe (partial), Make.com webhooks
- i18n: English, Spanish, Portuguese

---

## 2. Architecture

### 2.1 Multi-Company Isolation

Every data table includes a `company_id` column. Row Level Security (RLS) policies enforce that users can only access data belonging to companies they are members of. Company membership is stored in `company_members` with role assignments.

### 2.2 Authentication Flow

1. User signs in via Supabase Auth (email/password or Google OAuth)
2. System checks `company_members` for existing memberships
3. If no membership → redirect to Onboarding to create a company
4. If membership exists → redirect to niche-specific dashboard
5. Multi-company users can switch via `CompanySwitcher`

### 2.3 Edge Function Architecture

21 Supabase Edge Functions handle server-side logic:
- Google Drive operations (auth, callback, folder management)
- Client portal (upload, download, submit, remove)
- Webhook dispatching and automation events
- Admin operations (impersonation, user deletion)
- Internal file operations (upload, attachment removal)

### 2.4 Google Drive Folder Structure

```
Root Folder (company-selected)
└── {Client Name}/ (client_folder_id)
    ├── Documents Received/ (documents_received_folder_id)
    └── {Application Name}/ (visa_application_folder_id)
        └── [uploaded documents]
```

Folder creation is async via webhook → Make.com → Google Drive API. Status tracking: `not_started` → `pending` → `created` → `error`.

---

## 3. Feature Mapping by Domain

### EPIC 1: Authentication & Multi-Company

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Email/Password Sign-up/Login | Supabase Auth with email confirmation | Public | `auth.users`, `profiles` |
| Google OAuth | Sign in with Google (configurable) | Public | `auth.users`, `profiles` |
| Company Creation (Onboarding) | Wizard: niche selection → company name → profile | Authenticated | `companies`, `company_members`, `profiles` |
| Company Switching | Dropdown to switch active company | Multi-company users | `company_members` |
| Team Invitations | Invite by email with role assignment | Owner, Admin | `team_invitations` |
| Pending Invitation Acceptance | Auto-accept on login if matching email | Authenticated | `team_invitations`, `company_members` |
| Protected Routes | Redirect unauthenticated users to /auth | System | — |

**Limitations:**
- No email verification enforcement beyond Supabase defaults
- No password reset UI (relies on Supabase default)
- Google OAuth diagnostics page exists but is a debug tool

---

### EPIC 2: Client Management

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Client List | Paginated list with search | All members | `clients` |
| Client Creation | Personal or Corporate type | All members | `clients` |
| Client Detail View | Full profile with applications list | All members | `clients`, `visa_applications` |
| Client Editing | Update name, email, phone, nationality, passport, DOB | All members | `clients` |
| Client Deletion | Soft delete with confirmation | Owner, Admin | `clients` |
| Related Applicants | Link clients as related (spouse, child, etc.) | All members | `clients.related_applicants` (JSON) |
| Client Folder Status | Real-time status of Google Drive folder creation | All members | `clients.folder_status` |

**Limitations:**
- No bulk operations
- Related applicants stored as JSON, not normalized
- No client archiving (only delete)

---

### EPIC 3: Visa Application (Matter) Management

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Application List | All applications with filters | All members | `visa_applications` |
| Application Creation | Name, category, subcategory, country selection | All members | `visa_applications` |
| Application Detail | Full view with document checklist, applicants | All members | `visa_applications`, `document_checklist` |
| Application Status | Draft → Active → Done lifecycle | All members | `visa_applications.status` |
| Applicant Management | Add/remove applicants with types (primary, spouse, etc.) | All members | `application_applicants` |
| Category/Subcategory Selection | Hierarchical visa type selection | All members | `application_categories`, `application_subcategories` |
| Country Selection | Filter categories by country | All members | `countries` |

**Limitations:**
- No application cloning/templates
- Status transitions have no validation rules
- No deadline or SLA tracking

---

### EPIC 4: Document Management

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Document Checklist | Auto-generated from templates per application | All members | `document_checklist` |
| Document Upload | Upload files to Supabase Storage + Google Drive | All members | `document_attachments` |
| Document Review | Approve/reject with comments | All members | `document_checklist.review_status` |
| Review Status | pending_client → in_review → approved / rejected | All members | `document_checklist` |
| Multi-file Attachments | Multiple files per checklist item | All members | `document_attachments` |
| Document History | Archive of replaced documents | All members | `document_attachment_history` |
| Document Templates | Configurable checklist templates per visa type | Owner, Admin | `document_checklist_templates` |
| Translation Requirements | Mark docs requiring translation with cert type | All members | `document_checklist` |
| Applicability Conditions | Conditional document requirements (age, etc.) | System | `document_checklist.applicability_condition` |
| Document Preview | PDF thumbnail generation and preview dialog | All members | — |

**Limitations:**
- No OCR or document content extraction
- No automatic document classification
- Templates are per visa type, not per company+visa type combination
- No version control beyond history archive

---

### EPIC 5: Client Portal

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Portal Invitation | Generate token-based access link for clients | All members | `client_portal_access` |
| Token-Based Access | Clients access portal without authentication | External clients | `client_portal_access` |
| Document Upload | Clients upload required documents | Portal token holder | `document_attachments` |
| Document Removal | Clients can remove their uploaded documents | Portal token holder | `document_attachments` |
| Form Data Entry | Clients fill in personal information | Portal token holder | `client_form_data` |
| Portal Submission | One-time submit that locks further edits | Portal token holder | `client_portal_access.is_submitted` |
| Token Expiry | Configurable expiration for access tokens | System | `client_portal_access.token_expires_at` |

**Limitations:**
- Token transmitted as URL parameter (security concern)
- No multi-language portal content (UI is translated but document names are not)
- No email notifications when portal is ready
- Submitted portal is permanently locked (no re-open flow)

---

### EPIC 6: Google Drive Integration

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| OAuth Connection | Connect company Google Drive account | Owner, Admin | `google_drive_connections` |
| Root Folder Selection | Pick root folder via folder browser | Owner, Admin | `google_drive_connections.root_folder_id` |
| Auto Folder Creation | Triggered on client/application creation via webhooks | System | `clients.folder_status` |
| File Upload to Drive | Documents uploaded to both Storage and Drive | System | — |
| File URL Retrieval | Get signed download URLs from Drive | All members | — |
| Disconnection | Revoke Drive access | Owner, Admin | `google_drive_connections` |
| Folder Status Tracking | Real-time status via Supabase Realtime | System | `clients.folder_status`, `visa_applications.folder_status` |
| Token Encryption | Access/refresh tokens encrypted at rest | System | `google_drive_connections` |

**Limitations:**
- Single Google account per company
- Folder creation depends on external Make.com webhook (latency + failure risk)
- 30-second timeout for folder creation before marking as error
- No retry mechanism for failed folder creation in the UI

---

### EPIC 7: Webhook & Automation System

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Webhook Configuration | Create webhooks with URL, events, and field selection | Platform Admin | `platform_webhooks` |
| Event Types | client.created/updated/deleted, application.created/updated/deleted | System | — |
| Payload Field Selection | Choose which fields to include in webhook payload | Platform Admin | `platform_webhooks.included_fields` |
| Secret Key Signing | HMAC-SHA256 signature for webhook verification | System | `platform_webhooks.secret_key` |
| Retry Configuration | Configurable retries with exponential backoff | Platform Admin | `platform_webhooks` |
| Automation Events | Log of all dispatched automation events | Platform Admin | `automation_events` |
| Webhook Monitoring | Request logs with success/failure tracking | Platform Admin | `webhook_request_logs` |
| Rate Limiting | Per-endpoint rate limiting for webhook consumers | System | `webhook_rate_limits` |

**Limitations:**
- Webhooks are platform-level only (not per-company)
- No webhook testing/ping from UI
- No dead letter queue for permanently failed deliveries

---

### EPIC 8: Platform Administration

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Admin Dashboard | Platform-wide metrics and overview | Platform Admin | Multiple |
| Company Management | View/edit all companies | Platform Admin | `companies` |
| User Management | View all users, delete users | Platform Admin | `profiles`, `auth.users` |
| User Impersonation | Act as another user for debugging | Super Admin | — |
| Audit Logs | Track admin actions | Platform Admin | `platform_audit_logs` |
| Platform Settings | Key-value configuration store | Platform Admin | `platform_settings` |
| Reference Data Management | Manage countries, languages, visa types, etc. | Platform Admin | Multiple reference tables |
| Feedback Management | Review user-submitted feedback | Platform Admin | `beta_feedback` |

**Limitations:**
- Impersonation has no session timeout
- No role hierarchy enforcement beyond super_admin
- Audit log has no retention policy

---

### EPIC 9: Billing & Subscriptions

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Billing Page (Company) | Displays current plan and subscription info | Owner, Admin | `companies` |
| Admin Billing Page | Platform-level billing overview | Platform Admin | `companies` |
| Subscription Plans | free, basic, pro, teams, enterprise (enum defined) | System | `companies.subscription_plan` |
| Stripe Customer ID | Stored but not actively used | System | `companies.stripe_customer_id` |

**Limitations:**
- **No actual payment processing implemented**
- **No plan limit enforcement** (all plans have same access)
- Stripe integration is schema-only (no checkout, no webhooks)
- No usage tracking or metering

---

### EPIC 10: Notification System

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| In-App Notifications | Bell icon with unread count | All members | `notifications` |
| Notification Types | client_portal_submitted, document_uploaded, etc. | System | `notifications.type` |
| Mark as Read | Individual and bulk mark-as-read | All members | `notifications.is_read` |
| Real-time Updates | New notifications via Supabase Realtime | System | — |

**Limitations:**
- No email notifications
- No push notifications
- No notification preferences/settings
- No notification grouping or digest

---

### EPIC 11: User Feedback System

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Feedback Widget | Floating button to submit feedback | All members | `beta_feedback` |
| Feedback Types | Bug report, feature request, general | All members | `beta_feedback.type` |
| Admin Feedback View | Review and annotate feedback | Platform Admin | `beta_feedback` |
| Status Tracking | Track feedback resolution | Platform Admin | `beta_feedback.status` |

---

### EPIC 12: Internationalization (i18n)

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Language Switching | EN, ES, PT via language switcher | All users | — |
| UI Translation | All UI strings translated | All users | `public/locales/` |
| Database Translations | Entity-level translations | System | `translations` |
| Company Preferred Language | Default language per company | Owner, Admin | `companies.preferred_language` |

**Limitations:**
- Document names in checklists are not translated
- Client portal content is partially translated
- Not all edge function error messages are translated

---

### EPIC 13: Reference Data Management

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Countries | Country list with language defaults | Platform Admin | `countries` |
| Languages | Supported languages | Platform Admin | `languages` |
| Applicant Types | Primary, Spouse, Child, etc. | Platform Admin | `applicant_types` |
| Application Categories | Visa categories by country | Platform Admin | `application_categories` |
| Application Subcategories | Sub-types within categories | Platform Admin | `application_subcategories` |
| Visa Types | Specific visa types | Platform Admin | `visa_types` |
| Translation Certification Types | NAATI, sworn translation, etc. | Platform Admin | `translation_certification_types` |
| Category-Applicant Rules | Which applicant types apply to which categories | Platform Admin | `category_applicant_types` |

---

### EPIC 14: SEO & Marketing

| Feature | Description | Access | Tables |
|---------|-------------|--------|--------|
| Meta Tags | Dynamic title, description per page | Public | — |
| Open Graph | OG tags for social sharing | Public | — |
| Sitemap | Static sitemap.xml | Public | — |
| Robots.txt | Crawl directives | Public | — |
| Google Verification | Search Console verification file | Public | — |
| Privacy Policy | Static page | Public | — |
| Terms of Service | Static page | Public | — |
| noIndex for Auth Pages | Prevent indexing of authenticated pages | System | — |

---

## 4. Business Rules

### 4.1 Role-Based Access

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Owner** | Company | Full access, can manage billing, team, settings, delete company |
| **Admin** | Company | Same as Owner except cannot delete company or transfer ownership |
| **Member** | Company | CRUD on clients, applications, documents; no settings access |
| **Guest** | Company | Defined in enum but **no specific restrictions implemented** |
| **Platform Super Admin** | Platform | Access to admin panel, all companies, impersonation |

### 4.2 Data Isolation

- All client-facing tables include `company_id`
- RLS policies enforce `company_id` matches the user's active company via `company_members`
- Users can belong to multiple companies but interact with one at a time
- Platform admins can bypass company isolation via impersonation

### 4.3 Document Review Flow

```
[No Attachment] → Client uploads → pending_client
pending_client → Agent reviews → in_review
in_review → Agent approves → approved
in_review → Agent rejects → rejected (with comment)
rejected → Client re-uploads → pending_client
Any status → Client deletes all files → in_review
```

### 4.4 Client Portal Lifecycle

1. Agent creates portal invitation (generates token, sets expiry)
2. Client receives link with token parameter
3. Client accesses portal, uploads documents, fills form data
4. Client submits portal (one-time, irreversible)
5. Agent receives notification of submission
6. Portal access expires at `token_expires_at` regardless of submission

### 4.5 Folder Creation Flow

1. Client/Application created → automation event inserted
2. Database trigger fires → calls `webhook-automation-event` edge function
3. Edge function dispatches to configured webhooks (Make.com)
4. Make.com creates folder in Google Drive
5. Make.com calls back to update `folder_status` and folder IDs
6. 30-second timeout function marks stuck folders as `error`

### 4.6 Subscription Plans (Defined but Not Enforced)

| Plan | Defined | Enforced |
|------|---------|----------|
| free | ✅ | ❌ |
| basic | ✅ | ❌ |
| pro | ✅ | ❌ |
| teams | ✅ | ❌ |
| enterprise | ✅ | ❌ |

No feature gating, usage limits, or billing enforcement exists.

### 4.7 File Handling Rules

- Files uploaded to Supabase Storage first
- If Google Drive is connected, files are also uploaded to Drive
- `save_original_to_documents_received` company setting controls whether originals are kept in a separate folder
- Client portal uploads go through dedicated edge functions with token validation

---

## 5. Permissions & Roles Matrix

| Feature | Owner | Admin | Member | Guest | Platform Admin |
|---------|-------|-------|--------|-------|----------------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ (own panel) |
| Create Client | ✅ | ✅ | ✅ | ❓ | Via impersonation |
| Edit Client | ✅ | ✅ | ✅ | ❓ | Via impersonation |
| Delete Client | ✅ | ✅ | ❌ | ❌ | Via impersonation |
| Create Application | ✅ | ✅ | ✅ | ❓ | Via impersonation |
| Manage Documents | ✅ | ✅ | ✅ | ❓ | Via impersonation |
| Review Documents | ✅ | ✅ | ✅ | ❓ | Via impersonation |
| Invite Team Members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Company Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Connect Google Drive | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Billing | ✅ | ✅ | ❌ | ❌ | ✅ (platform) |
| Manage Webhooks | ❌ | ❌ | ❌ | ❌ | ✅ |
| Impersonate Users | ❌ | ❌ | ❌ | ❌ | ✅ (super_admin) |
| Manage Reference Data | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| Submit Feedback | ✅ | ✅ | ✅ | ✅ | ✅ |

❓ = Guest role is defined but has no specific restrictions implemented (defaults to member-level access)

---

## 6. Data Model Summary

### 6.1 Core Entities

```
companies (1) ──┬── (N) company_members ── (1) auth.users
                │                              │
                │                              └── (1) profiles
                │
                ├── (N) clients ──┬── (N) visa_applications ── (N) document_checklist
                │                 │                                    │
                │                 │                                    ├── (N) document_attachments
                │                 │                                    └── (N) document_attachment_history
                │                 │
                │                 ├── (N) application_applicants
                │                 ├── (N) client_portal_access
                │                 └── (N) client_form_data
                │
                ├── (1) google_drive_connections
                ├── (N) automation_events
                ├── (N) notifications
                ├── (N) team_invitations
                └── (N) beta_feedback
```

### 6.2 Reference Data Entities

```
countries ── (N) application_categories ── (N) application_subcategories
                      │                              │
                      └── (N) visa_types ─────────────┘
                      │
                      └── (N) category_applicant_types ── applicant_types

languages
translation_certification_types
```

### 6.3 Platform Entities

```
platform_admins
platform_audit_logs
platform_settings
platform_webhooks
webhook_rate_limits
webhook_request_logs
```

### 6.4 Key Relationships

| Parent | Child | FK Column | Cardinality |
|--------|-------|-----------|-------------|
| companies | clients | company_id | 1:N |
| companies | company_members | company_id | 1:N |
| companies | google_drive_connections | company_id | 1:1 |
| clients | visa_applications | client_id | 1:N |
| visa_applications | document_checklist | visa_application_id | 1:N |
| document_checklist | document_attachments | document_checklist_id | 1:N |
| document_checklist | document_attachment_history | document_checklist_id | 1:N |
| clients | client_portal_access | client_id | 1:N |
| visa_applications | application_applicants | visa_application_id | 1:N |
| application_categories | application_subcategories | category_id | 1:N |
| countries | application_categories | country_id | 1:N |

### 6.5 RLS Implementation

- All company-scoped tables have RLS enabled
- Policies use `auth.uid()` and `company_members` to verify access
- Helper functions: `is_company_member()`, `is_company_admin_or_owner()`, `is_platform_admin()`, `has_client_access()`
- Client portal tables use token-based access via `validate_portal_access_token()`

---

## 7. Technical Constraints

### 7.1 Edge Functions (21 total)

| Function | Purpose | Auth |
|----------|---------|------|
| admin-delete-user | Delete user account | Platform Admin |
| admin-impersonate | Generate impersonation token | Super Admin |
| cleanup-rate-limits | Cron: clean expired rate limit records | Service role |
| client-portal-get-file-url | Get download URL for portal documents | Token-based |
| client-portal-remove-document | Remove client-uploaded document | Token-based |
| client-portal-submit | Submit completed portal | Token-based |
| client-portal-upload | Upload document via portal | Token-based |
| dispatch-webhook | Send webhook to configured endpoints | Service role |
| get-drive-file-url | Get signed Drive download URL | Authenticated |
| google-drive-auth | Initiate OAuth flow | Authenticated |
| google-drive-callback | Handle OAuth callback | System |
| google-drive-disconnect | Revoke Drive connection | Authenticated |
| google-drive-list-folders | Browse Drive folders | Authenticated |
| google-drive-set-root | Set root folder for company | Authenticated |
| internal-remove-attachment | Remove file from Storage + Drive | Authenticated |
| internal-upload | Upload file to Storage + Drive | Authenticated |
| timeout-folder-creation | Mark stuck folders as error | Service role |
| webhook-application-folder | Callback for application folder creation | Webhook secret |
| webhook-automation-event | Dispatch automation events | Service role |
| webhook-client-folder | Callback for client folder creation | Webhook secret |

### 7.2 Rate Limits

- Webhook endpoints: configurable per-endpoint rate limiting
- Rate limit data stored in `webhook_rate_limits` table
- Cleanup via `cleanup-rate-limits` edge function (cron)
- Default: configurable via `check_rate_limit()` function parameters

### 7.3 Timeouts

- Folder creation: 30-second timeout before marking as `error`
- Edge function execution: Supabase default (varies by plan)
- Portal token expiry: configurable per invitation

### 7.4 Third-Party Dependencies

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| Supabase | Auth, DB, Storage, Edge Functions, Realtime | SDK + REST |
| Google Drive API | File storage, folder management | OAuth 2.0 + REST |
| Make.com | Webhook automation (folder creation) | HTTP webhooks |
| Stripe | Payment processing (not active) | Schema only |
| Kong | API gateway for edge functions | Configuration |

### 7.5 OAuth Scopes (Google)

- `https://www.googleapis.com/auth/drive.file` — Manage files created by the app
- `https://www.googleapis.com/auth/drive` — Full Drive access (for folder browsing)
- `https://www.googleapis.com/auth/userinfo.email` — Get connected account email

### 7.6 File Handling

- Upload: Supabase Storage (primary) + Google Drive (secondary, if connected)
- Download: Signed URLs from Supabase Storage or Google Drive
- Supported types: No explicit restrictions in edge functions
- Size limits: Supabase Storage defaults (varies by plan)

---

## 8. Test Scenarios

### TS-1: Authentication

#### TS-1.1: Email Sign-Up
- **Precondition:** No existing account
- **Steps:** Navigate to /auth → Enter email/password → Click Sign Up
- **Expected:** Account created, redirect to onboarding
- **Edge cases:** Duplicate email, weak password, invalid email format

#### TS-1.2: Google OAuth Sign-In
- **Precondition:** Google OAuth configured
- **Steps:** Click "Sign in with Google" → Complete Google flow
- **Expected:** Account created/linked, redirect to dashboard or onboarding
- **Edge cases:** OAuth popup blocked, user cancels consent

#### TS-1.3: Multi-Company Switch
- **Precondition:** User belongs to 2+ companies
- **Steps:** Click CompanySwitcher → Select different company
- **Expected:** Context switches, data reloads for new company
- **Edge cases:** Company deleted while switching, network error during switch

### TS-2: Client Management

#### TS-2.1: Create Personal Client
- **Precondition:** Authenticated, company selected
- **Steps:** Navigate to Clients → Click Add → Fill first/last name, email → Save
- **Expected:** Client created, appears in list, folder creation triggered
- **Edge cases:** Missing required fields, duplicate client

#### TS-2.2: Create Corporate Client
- **Precondition:** Authenticated, company selected
- **Steps:** Navigate to Clients → Click Add → Select Corporate → Fill company name → Save
- **Expected:** Corporate client created with company_name field
- **Edge cases:** Switch type mid-form

### TS-3: Document Management

#### TS-3.1: Upload Document
- **Precondition:** Application exists with checklist items
- **Steps:** Navigate to checklist item → Click Upload → Select file → Confirm
- **Expected:** File uploaded to Storage + Drive, attachment record created, status updated
- **Edge cases:** Large file, network interruption, Drive disconnected

#### TS-3.2: Review Document
- **Precondition:** Document uploaded by client
- **Steps:** Open document → Click Approve/Reject → Add comment (if rejecting)
- **Expected:** Review status updated, notification sent
- **Edge cases:** Approve already-approved doc, reject without comment

### TS-4: Client Portal

#### TS-4.1: Portal Invitation
- **Precondition:** Client and application exist
- **Steps:** Open application → Click Invite Client → Set expiry → Generate link
- **Expected:** Token generated, link displayed for sharing
- **Edge cases:** Generate multiple invitations for same client

#### TS-4.2: Portal Document Upload
- **Precondition:** Valid portal token
- **Steps:** Access portal link → Select document → Upload file
- **Expected:** File uploaded, review status set to pending_client
- **Edge cases:** Expired token, submitted portal, max file limit

#### TS-4.3: Portal Submission
- **Precondition:** Portal accessed, documents uploaded
- **Steps:** Click Submit → Confirm
- **Expected:** Portal locked, notification sent to agent, is_submitted = true
- **Edge cases:** Double-click submit, session expires during submit

### TS-5: Google Drive

#### TS-5.1: Connect Google Drive
- **Precondition:** Owner/Admin role
- **Steps:** Settings → Google Drive → Connect → OAuth flow → Select root folder
- **Expected:** Connection saved, tokens encrypted, root folder set
- **Edge cases:** Revoke consent externally, token expiry

#### TS-5.2: Auto Folder Creation
- **Precondition:** Drive connected, webhooks configured
- **Steps:** Create new client
- **Expected:** Automation event created → webhook dispatched → folder created in Drive → status updated
- **Edge cases:** Make.com down, Drive quota exceeded, timeout

### TS-6: Webhooks

#### TS-6.1: Configure Webhook
- **Precondition:** Platform Admin
- **Steps:** Admin → Webhooks → Create → Set URL, events, fields → Save
- **Expected:** Webhook saved, begins receiving events
- **Edge cases:** Invalid URL, duplicate name, all events deselected

---

## 9. Gaps & Risks

### 9.1 Partially Implemented Features

| Feature | Status | Impact |
|---------|--------|--------|
| Billing/Subscriptions | Schema only, no payment processing | All users have unlimited access regardless of plan |
| AI Features | Not implemented despite product naming | Misleading product positioning |
| Audit Niche | Dashboard exists, minimal functionality | Users in this niche have limited utility |
| HR Niche | Dashboard exists, minimal functionality | Users in this niche have limited utility |
| Guest Role | Defined in enum, no restrictions | Guests have same access as members |
| Email Notifications | Not implemented | Users must check app for updates |

### 9.2 Security Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Portal Token in URL | Medium | Access tokens transmitted as URL parameters, visible in browser history and server logs |
| Impersonation Session | Medium | No automatic timeout or session recording for impersonation |
| Google Tokens | Low | Encrypted at rest but encryption key management is manual |
| No CSRF Protection | Low | Relies on Supabase Auth tokens; edge functions validate auth header |

### 9.3 Scalability Concerns

| Area | Concern |
|------|---------|
| Client List | No pagination in some views; full table load |
| Document Checklist | No lazy loading for large checklists |
| Webhook Dispatching | Sequential dispatch to multiple endpoints |
| Rate Limit Cleanup | Cron-based; could accumulate records between runs |

### 9.4 Technical Debt

| Item | Description |
|------|-------------|
| Large Components | Several components exceed 500 lines (DocumentChecklist, ApplicationDetail) |
| Type Safety | Multiple `as any` casts in Supabase queries |
| Test Coverage | Zero automated tests |
| Error Handling | Inconsistent error handling across edge functions |
| Related Applicants | Stored as JSON instead of normalized table |

### 9.5 Missing Validations

| Area | Missing |
|------|---------|
| Application Status | No transition validation (can go from draft to done) |
| File Types | No file type restrictions on upload |
| File Size | No explicit size limits in application code |
| Client Email | No format validation beyond HTML input type |
| Portal Token | No rate limiting on token validation attempts |

---

*End of document. Generated from codebase analysis on 2026-02-16.*
