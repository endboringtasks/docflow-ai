export interface ReProject {
  id: string;
  company_id: string;
  name: string;
  product_url: string | null;
  description: string | null;
  industry: string | null;
  audience: string | null;
  output_config: { ddd: boolean; bdd: boolean; tech: boolean; docs: boolean };
  output_format: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReRole {
  id: string;
  project_id: string;
  company_id: string;
  name: string;
  permissions: string[];
  sort_order: number;
}

export interface ReJourney {
  id: string;
  project_id: string;
  company_id: string;
  title: string;
  trigger: string | null;
  preconditions: string | null;
  main_steps: string | null;
  variations: string | null;
  errors: string | null;
  sort_order: number;
}

export type DomainKind = "noun" | "verb" | "policy" | "state" | "artifact" | "external_system";
export type DomainClassification = "entity" | "value_object" | "aggregate" | "external" | "";

export interface ReDomainTerm {
  id: string;
  project_id: string;
  company_id: string;
  kind: DomainKind;
  term: string;
  definition: string | null;
  classification: DomainClassification | null;
  sort_order: number;
}

export interface ReDataObject {
  id: string;
  project_id: string;
  company_id: string;
  name: string;
  system_of_record: string | null;
  sync_rules: string | null;
  notes: string | null;
  sort_order: number;
}

export interface ReExternalSystem {
  id: string;
  project_id: string;
  company_id: string;
  name: string;
  purpose: string | null;
  direction: string | null;
  sort_order: number;
}

export type DeliverableCategory = "ddd" | "bdd" | "tech" | "docs";

export interface ReDeliverable {
  id: string;
  project_id: string;
  company_id: string;
  category: DeliverableCategory;
  section_key: string;
  title: string;
  content_md: string;
  assumptions: string | null;
  open_questions: string | null;
  version: number;
  sort_order: number;
}

export interface ProjectBundle {
  project: ReProject;
  roles: ReRole[];
  journeys: ReJourney[];
  terms: ReDomainTerm[];
  dataObjects: ReDataObject[];
  externalSystems: ReExternalSystem[];
}
