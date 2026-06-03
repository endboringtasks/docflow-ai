import type {
  ProjectBundle,
  DeliverableCategory,
  ReDomainTerm,
} from "./types";

export interface GeneratedSection {
  category: DeliverableCategory;
  section_key: string;
  title: string;
  content_md: string;
  assumptions: string;
  open_questions: string;
  sort_order: number;
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");
const bullets = (text: string | null | undefined): string => {
  if (!text || !text.trim()) return "_None provided._";
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("-") ? l : `- ${l}`))
    .join("\n");
};

const termsOf = (bundle: ProjectBundle, kind: ReDomainTerm["kind"]) =>
  bundle.terms.filter((t) => t.kind === kind);

const STD_ASSUMPTIONS =
  "- Outputs were assembled from the intake provided in the wizard; gaps were filled with conservative defaults.\n- Status names and terminology are reused consistently across all deliverables.";
const STD_OPEN_QUESTIONS =
  "- Confirm the inferred items below with a domain expert.\n- Validate that no key flows, entities, or integrations are missing.";

// ---------------- DDD ----------------
function dddSections(b: ProjectBundle): GeneratedSection[] {
  const nouns = termsOf(b, "noun");
  const verbs = termsOf(b, "verb");
  const policies = termsOf(b, "policy");
  const states = termsOf(b, "state");
  const externals = b.externalSystems;

  const glossaryRows =
    nouns.length || verbs.length
      ? [...nouns, ...verbs]
          .map(
            (t) =>
              `| ${dash(t.term)} | ${dash(t.definition)} | — | ${t.kind}${
                t.classification ? ` / ${t.classification}` : ""
              } |`
          )
          .join("\n")
      : "| — | — | — | — |";

  const entities = nouns.filter((n) => n.classification === "entity" || n.classification === "aggregate");
  const valueObjects = nouns.filter((n) => n.classification === "value_object");
  const aggregates = nouns.filter((n) => n.classification === "aggregate");

  return [
    {
      category: "ddd",
      section_key: "glossary",
      title: "Ubiquitous Language Glossary",
      content_md: `| Term | Definition | Synonyms | Notes |\n|------|-----------|----------|-------|\n${glossaryRows}`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 0,
    },
    {
      category: "ddd",
      section_key: "bounded_contexts",
      title: "Bounded Contexts & Context Map",
      content_md: `### Candidate Bounded Contexts\n${
        b.journeys.length
          ? b.journeys.map((j) => `- **${dash(j.title)}** context`).join("\n")
          : "- Core context"
      }\n\n### Context Map\n- Upstream/Downstream relationships to confirm.\n- Shared Kernel: shared identifiers and status vocabulary.\n- Anti-Corruption Layer: wrap external systems (${
        externals.map((e) => e.name).join(", ") || "external integrations"
      }).`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 1,
    },
    {
      category: "ddd",
      section_key: "domain_model",
      title: "Domain Model",
      content_md: `### Entities\n${
        entities.length ? entities.map((e) => `- **${e.term}** — ${dash(e.definition)}`).join("\n") : "_None identified._"
      }\n\n### Value Objects\n${
        valueObjects.length ? valueObjects.map((v) => `- **${v.term}** — ${dash(v.definition)}`).join("\n") : "_None identified._"
      }\n\n### Aggregates & Invariants\n${
        aggregates.length
          ? aggregates.map((a) => `- **${a.term}** (aggregate root) — invariants to confirm.`).join("\n")
          : "_None identified._"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 2,
    },
    {
      category: "ddd",
      section_key: "domain_events",
      title: "Domain Events",
      content_md: `| Event | When it fires | Payload fields | Consumers |\n|-------|---------------|----------------|-----------|\n${
        verbs.length
          ? verbs.map((v) => `| ${v.term}d | After "${v.term}" command | id, actor, timestamp | TBD |`).join("\n")
          : "| — | — | — | — |"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 3,
    },
    {
      category: "ddd",
      section_key: "commands",
      title: "Command Model",
      content_md: `| Command | Actor | Preconditions | Validations |\n|---------|-------|---------------|-------------|\n${
        verbs.length
          ? verbs
              .map(
                (v) =>
                  `| ${v.term} | ${b.roles[0]?.name || "User"} | Authenticated | ${dash(policies[0]?.term)} |`
              )
              .join("\n")
          : "| — | — | — | — |"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 4,
    },
    {
      category: "ddd",
      section_key: "source_of_truth",
      title: "Source of Truth Matrix",
      content_md: `| Data item | System of record | Sync rules |\n|-----------|------------------|------------|\n${
        b.dataObjects.length
          ? b.dataObjects.map((d) => `| ${dash(d.name)} | ${dash(d.system_of_record)} | ${dash(d.sync_rules)} |`).join("\n")
          : "| — | — | — |"
      }\n\n### States / Statuses\n${
        states.length ? states.map((s) => `- ${s.term}`).join("\n") : "_None identified._"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 5,
    },
  ];
}

// ---------------- BDD ----------------
function bddSections(b: ProjectBundle): GeneratedSection[] {
  const gherkin = b.journeys
    .map(
      (j) =>
        `\`\`\`gherkin\nFeature: ${dash(j.title)}\n\n  Scenario: Happy path\n    Given ${dash(j.preconditions)}\n    When ${dash(j.trigger)}\n    Then the journey completes successfully\n\n  Scenario: Error handling\n    Given ${dash(j.preconditions)}\n    When an error occurs (${dash(j.errors)})\n    Then the user is informed and can retry\n\`\`\``
    )
    .join("\n\n");

  return [
    {
      category: "bdd",
      section_key: "personas",
      title: "Personas",
      content_md: b.roles.length
        ? b.roles
            .map(
              (r) =>
                `### ${r.name}\n- **Goals:** use the product to ${r.permissions.join(", ") || "perform their work"}.\n- **Pains:** friction in current manual processes.`
            )
            .join("\n\n")
        : "_No roles defined._",
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 0,
    },
    {
      category: "bdd",
      section_key: "user_stories",
      title: "User Stories",
      content_md: b.journeys.length
        ? b.journeys
            .map(
              (j) =>
                `- As a **${b.roles[0]?.name || "user"}**, I want to **${j.title.toLowerCase()}** so that I achieve the intended outcome.`
            )
            .join("\n")
        : "_No journeys defined._",
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 1,
    },
    {
      category: "bdd",
      section_key: "acceptance_criteria",
      title: "Acceptance Criteria",
      content_md: b.journeys.length
        ? b.journeys
            .map((j) => `### ${dash(j.title)}\n${bullets(j.main_steps)}`)
            .join("\n\n")
        : "_No journeys defined._",
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 2,
    },
    {
      category: "bdd",
      section_key: "gherkin",
      title: "Gherkin Scenarios",
      content_md: gherkin || "_No journeys defined._",
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 3,
    },
    {
      category: "bdd",
      section_key: "business_rules",
      title: "Business Rules Catalogue",
      content_md: `| Rule | Rationale | Enforcement point |\n|------|-----------|-------------------|\n${
        termsOf(b, "policy").length
          ? termsOf(b, "policy").map((p) => `| ${dash(p.term)} | ${dash(p.definition)} | Application / domain layer |`).join("\n")
          : "| — | — | — |"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 4,
    },
  ];
}

// ---------------- TECH ----------------
function techSections(b: ProjectBundle): GeneratedSection[] {
  return [
    {
      category: "tech",
      section_key: "architecture",
      title: "System Architecture",
      content_md: `- **Frontend:** web client (SPA).\n- **Backend:** API + business logic.\n- **Storage:** ${
        b.dataObjects.map((d) => d.system_of_record).filter(Boolean).join(", ") || "application database"
      }.\n- **Auth:** authenticated users with role-based access.\n- **Integrations:** ${
        b.externalSystems.map((e) => e.name).join(", ") || "none identified"
      }.`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 0,
    },
    {
      category: "tech",
      section_key: "data_model",
      title: "Data Model",
      content_md: `| Object | System of record | Notes |\n|--------|------------------|-------|\n${
        b.dataObjects.length
          ? b.dataObjects.map((d) => `| ${dash(d.name)} | ${dash(d.system_of_record)} | ${dash(d.notes)} |`).join("\n")
          : "| — | — | — |"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 1,
    },
    {
      category: "tech",
      section_key: "api_spec",
      title: "API Spec Summary",
      content_md: `> Inferred from journeys — confirm against the real implementation.\n\n${
        b.journeys.length
          ? b.journeys
              .map(
                (j) =>
                  `- \`POST /${j.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}\` — ${dash(j.trigger)} _(assumption)_`
              )
              .join("\n")
          : "_No journeys defined._"
      }`,
      assumptions: STD_ASSUMPTIONS + "\n- Endpoints are inferred from journeys and marked as assumptions.",
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 2,
    },
    {
      category: "tech",
      section_key: "integrations",
      title: "Integrations",
      content_md: b.externalSystems.length
        ? `| System | Purpose | Direction |\n|--------|---------|-----------|\n${b.externalSystems
            .map((e) => `| ${dash(e.name)} | ${dash(e.purpose)} | ${dash(e.direction)} |`)
            .join("\n")}`
        : "_No external systems identified._",
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 3,
    },
    {
      category: "tech",
      section_key: "nfr",
      title: "Non-Functional Requirements",
      content_md: `### Security & Privacy\n- Role-based access control; audit logs for sensitive actions; data retention policy to confirm.\n\n### Performance\n- Define expected load and latency targets.\n\n### Observability\n- Logging, metrics, and alerting to be specified.`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 4,
    },
    {
      category: "tech",
      section_key: "runbook",
      title: "Runbook",
      content_md: `### Environments\n- dev / staging / production.\n\n### Deployments\n- CI/CD pipeline (to confirm).\n\n### Backups\n- Scheduled database and file backups.\n\n### Common Failures\n${
        b.journeys.length ? b.journeys.map((j) => `- ${dash(j.title)}: ${dash(j.errors)}`).join("\n") : "_To be documented._"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 5,
    },
  ];
}

// ---------------- DOCS ----------------
function docsSections(b: ProjectBundle): GeneratedSection[] {
  return [
    {
      category: "docs",
      section_key: "product_overview",
      title: "Product Overview",
      content_md: `**${dash(b.project.name)}** — ${dash(b.project.description)}\n\n- **Industry:** ${dash(b.project.industry)}\n- **Target audience:** ${dash(b.project.audience)}\n- **Key concepts:** ${
        termsOf(b, "noun").map((n) => n.term).slice(0, 8).join(", ") || "—"
      }`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 0,
    },
    {
      category: "docs",
      section_key: "end_user_guide",
      title: "End-User Guide",
      content_md: b.journeys.length
        ? b.journeys.map((j) => `### ${dash(j.title)}\n${bullets(j.main_steps)}`).join("\n\n")
        : "_No journeys defined._",
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 1,
    },
    {
      category: "docs",
      section_key: "admin_guide",
      title: "Admin Guide",
      content_md: `### Roles & Permissions\n${
        b.roles.length
          ? b.roles.map((r) => `- **${r.name}:** ${r.permissions.join(", ") || "—"}`).join("\n")
          : "_No roles defined._"
      }\n\n### Configuration\n- Manage templates, checklists, and external integrations.`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 2,
    },
    {
      category: "docs",
      section_key: "developer_notes",
      title: "Developer Notes",
      content_md: `### Modules\n${
        b.journeys.map((j) => `- ${dash(j.title)}`).join("\n") || "—"
      }\n\n### Extension Points\n- Domain events and external system adapters.`,
      assumptions: STD_ASSUMPTIONS,
      open_questions: STD_OPEN_QUESTIONS,
      sort_order: 3,
    },
  ];
}

export function generateSections(bundle: ProjectBundle): GeneratedSection[] {
  const cfg = bundle.project.output_config;
  const out: GeneratedSection[] = [];
  if (cfg.ddd) out.push(...dddSections(bundle));
  if (cfg.bdd) out.push(...bddSections(bundle));
  if (cfg.tech) out.push(...techSections(bundle));
  if (cfg.docs) out.push(...docsSections(bundle));
  return out;
}

export function deliverableToMarkdown(d: {
  title: string;
  content_md: string;
  assumptions: string | null;
  open_questions: string | null;
}): string {
  return `## ${d.title}\n\n${d.content_md}\n\n**Assumptions**\n\n${
    d.assumptions || "_None._"
  }\n\n**Open Questions**\n\n${d.open_questions || "_None._"}\n`;
}

export const CATEGORY_LABELS: Record<DeliverableCategory, string> = {
  ddd: "DDD",
  bdd: "BDD",
  tech: "Tech Specs",
  docs: "Documentation",
};
