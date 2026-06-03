// Demo "Docflow AI" project data used to seed a working example for the current company.

export function buildDemoData(projectId: string, companyId: string) {
  const roles = [
    { project_id: projectId, company_id: companyId, name: "Admin", permissions: ["manage users", "configure checklists", "manage integrations"], sort_order: 0 },
    { project_id: projectId, company_id: companyId, name: "Staff", permissions: ["review documents", "validate checklist", "communicate with clients"], sort_order: 1 },
    { project_id: projectId, company_id: companyId, name: "Client", permissions: ["upload documents", "view status", "submit application"], sort_order: 2 },
  ];

  const journeys = [
    {
      project_id: projectId, company_id: companyId, title: "Client uploads documents", sort_order: 0,
      trigger: "Client opens the portal upload link",
      preconditions: "Client has a valid portal access token",
      main_steps: "Open portal\nSelect required document\nUpload file\nFile is staged and synced to Drive",
      variations: "Multiple files per requirement\nReplacing a rejected document",
      errors: "Invalid/expired link\nUnsupported file type\nUpload failure",
    },
    {
      project_id: projectId, company_id: companyId, title: "Staff validates checklist", sort_order: 1,
      trigger: "Staff opens the application checklist",
      preconditions: "Client has submitted documents",
      main_steps: "Review each document\nApprove or reject with comment\nUpdate review status",
      variations: "Request revision\nBulk approve",
      errors: "Missing required document\nConflicting validation",
    },
    {
      project_id: projectId, company_id: companyId, title: "Submit application", sort_order: 2,
      trigger: "All required documents approved",
      preconditions: "Checklist is complete and validated",
      main_steps: "Confirm completeness\nSubmit application\nNotify stakeholders",
      variations: "Submit with conditional items",
      errors: "Incomplete checklist\nNotification delivery failure",
    },
  ];

  const terms = [
    { project_id: projectId, company_id: companyId, kind: "noun", term: "Application", definition: "A case representing a visa/migration request.", classification: "aggregate", sort_order: 0 },
    { project_id: projectId, company_id: companyId, kind: "noun", term: "Client", definition: "The applicant or company submitting documents.", classification: "entity", sort_order: 1 },
    { project_id: projectId, company_id: companyId, kind: "noun", term: "Document", definition: "An uploaded file fulfilling a requirement.", classification: "entity", sort_order: 2 },
    { project_id: projectId, company_id: companyId, kind: "noun", term: "Checklist", definition: "The set of required documents for an application.", classification: "entity", sort_order: 3 },
    { project_id: projectId, company_id: companyId, kind: "noun", term: "Requirement", definition: "A single item the client must provide.", classification: "value_object", sort_order: 4 },
    { project_id: projectId, company_id: companyId, kind: "noun", term: "Validation", definition: "A staff review decision on a document.", classification: "value_object", sort_order: 5 },
    { project_id: projectId, company_id: companyId, kind: "verb", term: "Upload", definition: "Client provides a document.", classification: "", sort_order: 6 },
    { project_id: projectId, company_id: companyId, kind: "verb", term: "Validate", definition: "Staff reviews a document.", classification: "", sort_order: 7 },
    { project_id: projectId, company_id: companyId, kind: "verb", term: "Submit", definition: "Client submits the completed application.", classification: "", sort_order: 8 },
    { project_id: projectId, company_id: companyId, kind: "policy", term: "All required documents must be approved before submission", definition: "Submission is blocked until the checklist is complete.", classification: "", sort_order: 9 },
    { project_id: projectId, company_id: companyId, kind: "state", term: "Pending / Approved / Rejected / Submitted", definition: "Document and application statuses.", classification: "", sort_order: 10 },
    { project_id: projectId, company_id: companyId, kind: "artifact", term: "Portal upload", definition: "File uploaded through the client portal.", classification: "", sort_order: 11 },
  ];

  const dataObjects = [
    { project_id: projectId, company_id: companyId, name: "Document file", system_of_record: "Google Drive", sync_rules: "Staged in Storage, async sync to Drive, Drive is source of truth.", notes: "", sort_order: 0 },
    { project_id: projectId, company_id: companyId, name: "Application metadata", system_of_record: "App database", sync_rules: "Owned by the app.", notes: "", sort_order: 1 },
    { project_id: projectId, company_id: companyId, name: "Notifications", system_of_record: "Email / Make.com", sync_rules: "Dispatched via webhooks.", notes: "", sort_order: 2 },
  ];

  const externalSystems = [
    { project_id: projectId, company_id: companyId, name: "Google Drive", purpose: "Document storage / source of truth", direction: "downstream", sort_order: 0 },
    { project_id: projectId, company_id: companyId, name: "Email", purpose: "Client communication", direction: "downstream", sort_order: 1 },
    { project_id: projectId, company_id: companyId, name: "Make.com", purpose: "Webhook automation", direction: "downstream", sort_order: 2 },
  ];

  return { roles, journeys, terms, dataObjects, externalSystems };
}
