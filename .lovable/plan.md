# Docflow Reverse Engineer — Phase 1

A new section inside the existing app that lets a company member capture an existing product's structure through a guided wizard and assemble structured Markdown deliverables (DDD / BDD / Tech Specs / Docs). Phase 1 is **template-only** (no AI yet) and scoped **per company** (existing RLS model). A seeded "Docflow AI" demo project is included so it works immediately.

## Scope of Phase 1
- Database schema + RLS for projects and all intake entities
- Reusable app shell + sidebar entry for the new section
- Projects list + create
- 6-step intake wizard (Steps 0–5) with progress tracking
- Deliverables area with tabs, template-assembled Markdown, per-section editing
- Single-file and per-deliverable Markdown export
- Seed demo project

Deferred to later phases: AI generation/regeneration, Notion-ready export polish, screenshot uploads, SQL import parsing, versioned deliverable history UI.

## Routes
```text
/app/reverse-engineer                      → Projects list
/app/reverse-engineer/:projectId/wizard    → Wizard (steps 0–5)
/app/reverse-engineer/:projectId/deliverables → Deliverables tabs + export
```
Added to `App.tsx` under `ProtectedRoute`, and a sidebar link in `AppLayout`.

## Wizard steps
- **Step 0 – Project setup**: name, product URL, description, industry, audience, output toggles (DDD/BDD/Tech/Docs), output format (Markdown / Notion-ready).
- **Step 1 – Roles & permissions**: add/edit roles with permission lists; paste-to-import.
- **Step 2 – Journeys**: 5–10 journeys, each with trigger, preconditions, main steps, variations, errors/edge cases.
- **Step 3 – Domain discovery**: nouns (tagged Entity / Value Object / Aggregate / External), verbs/commands, policies/rules, states, artifacts, external systems.
- **Step 4 – Data & source-of-truth**: data objects + system of record + sync rules; paste schema text (stored raw for now).
- **Step 5 – Synthesis**: choose deliverable sets, generate → assembles Markdown from intake into deliverable rows, navigates to Deliverables.

Each step autosaves to Supabase. A progress bar reflects completed steps.

## Deliverables area
Tabs: **DDD**, **BDD**, **Tech Specs**, **Docs**. Each contains the sections listed in the brief, rendered as editable Markdown (textarea + preview). Every generated section appends an **Assumptions** and **Open Questions** block. Buttons: "Export all", "Export this deliverable". Editing persists to the deliverable row.

## Technical details

### Database (new tables, all `company_id`-scoped, RLS via `is_company_member` / `is_company_admin_or_owner`)
- `re_projects` — name, product_url, description, industry, audience, output_config (jsonb), output_format, created_by
- `re_roles` — project_id, name, permissions (text[]), sort_order
- `re_journeys` — project_id, title, trigger, preconditions, main_steps, variations, errors, sort_order
- `re_domain_terms` — project_id, kind (noun/verb/policy/state/artifact/external_system), term, definition, classification (entity/value_object/aggregate/external), sort_order
- `re_data_objects` — project_id, name, system_of_record, sync_rules, notes
- `re_external_systems` — project_id, name, purpose, direction
- `re_deliverables` — project_id, category (ddd/bdd/tech/docs), section_key, title, content_md, version, assumptions, open_questions

Each table: full GRANTs (`authenticated`, `service_role`), RLS (members read/write within their company; mutations restricted to members like existing tables), and `updated_at` triggers. `company_id` non-nullable; `created_by` set to `auth.uid()` on insert.

### Frontend
- `ReverseEngineerLayout` wrapper reusing the existing sidebar shell pattern (or extend `AppLayout` niche items with a Reverse Engineer link).
- React Query hooks per table (`useReProjects`, etc.) following existing Supabase client usage.
- Wizard built with existing shadcn components (Tabs/RadioGroup/Input/Textarea/Progress/Card).
- Template assembly: pure TS helpers in `src/lib/reverseEngineer/templates.ts` that map intake rows → Markdown strings per section, including consistent terminology, status names, Assumptions and Open Questions.
- Export: client-side blob download of concatenated or per-deliverable Markdown.

### Seed demo project
Inserted via the data-insert tool after migration (not a schema migration): a "Docflow AI" project with sample roles (Admin/Staff/Client), journeys (client upload, staff validation, submit application), domain terms (Case/Application, Client, Document, Checklist, Requirement, Validation, Status), data objects, and external systems (Drive, email).

## Build order
1. Migration: create the 7 tables with GRANTs, RLS, triggers.
2. Seed demo project data.
3. Routes + sidebar entry + projects list/create.
4. Wizard steps 0–5 with autosave.
5. Template assembly + Deliverables tabs + editing.
6. Export (single file + per deliverable).
