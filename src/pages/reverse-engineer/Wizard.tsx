import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReverseEngineerLayout from "@/components/reverse-engineer/ReverseEngineerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { generateSections } from "@/lib/reverseEngineer/templates";
import type {
  ReProject, ReRole, ReJourney, ReDomainTerm, ReDataObject, ReExternalSystem, ProjectBundle, DomainKind,
} from "@/lib/reverseEngineer/types";

const STEPS = ["Project", "Roles", "Journeys", "Domain", "Data", "Synthesis"];

const KIND_LABELS: Record<DomainKind, string> = {
  noun: "Noun (entity)", verb: "Verb (command)", policy: "Policy / rule",
  state: "State / status", artifact: "Artifact", external_system: "External system",
};

const Wizard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);

  const projQ = useQuery({
    queryKey: ["re_project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("re_projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data as unknown as ReProject;
    },
  });

  const useList = <T,>(table: string) =>
    useQuery({
      queryKey: [table, projectId],
      enabled: !!projectId,
      queryFn: async () => {
        const { data, error } = await supabase.from(table as any).select("*").eq("project_id", projectId!).order("sort_order");
        if (error) throw error;
        return (data as unknown as T[]) || [];
      },
    });

  const rolesQ = useList<ReRole>("re_roles");
  const journeysQ = useList<ReJourney>("re_journeys");
  const termsQ = useList<ReDomainTerm>("re_domain_terms");
  const dataQ = useList<ReDataObject>("re_data_objects");
  const extQ = useList<ReExternalSystem>("re_external_systems");

  const companyId = projQ.data?.company_id;

  const refetchAll = () => {
    ["re_roles", "re_journeys", "re_domain_terms", "re_data_objects", "re_external_systems"].forEach((t) =>
      qc.invalidateQueries({ queryKey: [t, projectId] })
    );
  };

  const addRow = async (table: string, row: Record<string, unknown>) => {
    if (!companyId) return;
    const { error } = await supabase.from(table as any).insert({ ...row, project_id: projectId, company_id: companyId });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refetchAll();
  };
  const updateRow = async (table: string, id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from(table as any).update(patch).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refetchAll();
  };
  const deleteRow = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else refetchAll();
  };

  const generate = async () => {
    if (!projQ.data || !companyId) return;
    setGenerating(true);
    try {
      const bundle: ProjectBundle = {
        project: projQ.data,
        roles: rolesQ.data || [],
        journeys: journeysQ.data || [],
        terms: termsQ.data || [],
        dataObjects: dataQ.data || [],
        externalSystems: extQ.data || [],
      };
      const sections = generateSections(bundle);
      await supabase.from("re_deliverables").delete().eq("project_id", projectId!);
      const rows = sections.map((s) => ({
        project_id: projectId, company_id: companyId, category: s.category, section_key: s.section_key,
        title: s.title, content_md: s.content_md, assumptions: s.assumptions, open_questions: s.open_questions,
        sort_order: s.sort_order,
      }));
      const { error } = await supabase.from("re_deliverables").insert(rows);
      if (error) throw error;
      toast({ title: "Deliverables generated", description: `${rows.length} sections created.` });
      navigate(`/app/reverse-engineer/${projectId}/deliverables`);
    } catch (e) {
      toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (projQ.isLoading) {
    return <ReverseEngineerLayout><div className="p-6 text-muted-foreground">Loading…</div></ReverseEngineerLayout>;
  }

  return (
    <ReverseEngineerLayout title={projQ.data?.name} backTo="/app/reverse-engineer">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
            <span className="text-muted-foreground">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => setStep(i)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                {i + 1}. {s}
              </button>
            ))}
          </div>
        </div>

        {step === 0 && projQ.data && <StepProject project={projQ.data} onSave={(patch) => updateRow("re_projects", projQ.data!.id, patch)} />}
        {step === 1 && <StepRoles rows={rolesQ.data || []} add={(r) => addRow("re_roles", r)} update={(id, p) => updateRow("re_roles", id, p)} del={(id) => deleteRow("re_roles", id)} />}
        {step === 2 && <StepJourneys rows={journeysQ.data || []} add={(r) => addRow("re_journeys", r)} update={(id, p) => updateRow("re_journeys", id, p)} del={(id) => deleteRow("re_journeys", id)} />}
        {step === 3 && <StepDomain rows={termsQ.data || []} add={(r) => addRow("re_domain_terms", r)} update={(id, p) => updateRow("re_domain_terms", id, p)} del={(id) => deleteRow("re_domain_terms", id)} />}
        {step === 4 && <StepData data={dataQ.data || []} ext={extQ.data || []} addData={(r) => addRow("re_data_objects", r)} updateData={(id, p) => updateRow("re_data_objects", id, p)} delData={(id) => deleteRow("re_data_objects", id)} addExt={(r) => addRow("re_external_systems", r)} updateExt={(id, p) => updateRow("re_external_systems", id, p)} delExt={(id) => deleteRow("re_external_systems", id)} />}
        {step === 5 && (
          <Card>
            <CardHeader><CardTitle>Synthesis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate editable Markdown deliverables for the selected output types. Regenerating replaces existing deliverables for this project.
              </p>
              <ul className="text-sm space-y-1">
                <li>Roles: {(rolesQ.data || []).length}</li>
                <li>Journeys: {(journeysQ.data || []).length}</li>
                <li>Domain terms: {(termsQ.data || []).length}</li>
                <li>Data objects: {(dataQ.data || []).length}</li>
                <li>External systems: {(extQ.data || []).length}</li>
              </ul>
              <Button onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Generate deliverables
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(`/app/reverse-engineer/${projectId}/deliverables`)}>
              View deliverables
            </Button>
          )}
        </div>
      </div>
    </ReverseEngineerLayout>
  );
};

// ---------- Step 0 ----------
const StepProject = ({ project, onSave }: { project: ReProject; onSave: (patch: Record<string, unknown>) => void }) => {
  const [form, setForm] = useState(project);
  useEffect(() => setForm(project), [project.id]);
  const cfg = form.output_config;
  const setCfg = (key: keyof typeof cfg, val: boolean) => {
    const next = { ...cfg, [key]: val };
    setForm({ ...form, output_config: next });
    onSave({ output_config: next });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Project setup</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Project name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => onSave({ name: form.name })} /></Field>
        <Field label="Product URL"><Input value={form.product_url || ""} onChange={(e) => setForm({ ...form, product_url: e.target.value })} onBlur={() => onSave({ product_url: form.product_url })} placeholder="https://…" /></Field>
        <Field label="Short description"><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} onBlur={() => onSave({ description: form.description })} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Primary industry"><Input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} onBlur={() => onSave({ industry: form.industry })} /></Field>
          <Field label="Target audience"><Input value={form.audience || ""} onChange={(e) => setForm({ ...form, audience: e.target.value })} onBlur={() => onSave({ audience: form.audience })} /></Field>
        </div>
        <div className="space-y-2">
          <Label>Generate outputs for</Label>
          <div className="flex flex-wrap gap-4">
            {(["ddd", "bdd", "tech", "docs"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={cfg[k]} onCheckedChange={(v) => setCfg(k, !!v)} />
                {k.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
        <Field label="Output format">
          <Select value={form.output_format} onValueChange={(v) => { setForm({ ...form, output_format: v }); onSave({ output_format: v }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="notion">Notion-ready Markdown</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2"><Label>{label}</Label>{children}</div>
);

// ---------- Step 1 ----------
const StepRoles = ({ rows, add, update, del }: {
  rows: ReRole[]; add: (r: Record<string, unknown>) => void; update: (id: string, p: Record<string, unknown>) => void; del: (id: string) => void;
}) => {
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Roles & permissions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name (e.g. Admin)" />
          <Button onClick={() => { if (name.trim()) { add({ name: name.trim(), permissions: [], sort_order: rows.length }); setName(""); } }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input defaultValue={r.name} onBlur={(e) => e.target.value !== r.name && update(r.id, { name: e.target.value })} className="font-medium" />
              <Button variant="ghost" size="icon" onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea defaultValue={r.permissions.join("\n")} placeholder="One permission per line"
              onBlur={(e) => update(r.id, { permissions: e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No roles yet.</p>}
      </CardContent>
    </Card>
  );
};

// ---------- Step 2 ----------
const StepJourneys = ({ rows, add, update, del }: {
  rows: ReJourney[]; add: (r: Record<string, unknown>) => void; update: (id: string, p: Record<string, unknown>) => void; del: (id: string) => void;
}) => {
  const [title, setTitle] = useState("");
  const fields: { key: keyof ReJourney; label: string }[] = [
    { key: "trigger", label: "Trigger" }, { key: "preconditions", label: "Preconditions" },
    { key: "main_steps", label: "Main steps (one per line)" }, { key: "variations", label: "Variations" },
    { key: "errors", label: "Errors / edge cases" },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Key user journeys</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Journey title" />
          <Button onClick={() => { if (title.trim()) { add({ title: title.trim(), sort_order: rows.length }); setTitle(""); } }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {rows.map((j) => (
          <div key={j.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input defaultValue={j.title} onBlur={(e) => e.target.value !== j.title && update(j.id, { title: e.target.value })} className="font-medium" />
              <Button variant="ghost" size="icon" onClick={() => del(j.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Textarea defaultValue={(j[f.key] as string) || ""} onBlur={(e) => update(j.id, { [f.key]: e.target.value })} className="min-h-[60px]" />
              </div>
            ))}
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Add 5–10 journeys.</p>}
      </CardContent>
    </Card>
  );
};

// ---------- Step 3 ----------
const StepDomain = ({ rows, add, update, del }: {
  rows: ReDomainTerm[]; add: (r: Record<string, unknown>) => void; update: (id: string, p: Record<string, unknown>) => void; del: (id: string) => void;
}) => {
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<DomainKind>("noun");
  return (
    <Card>
      <CardHeader><CardTitle>Domain discovery</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Select value={kind} onValueChange={(v) => setKind(v as DomainKind)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="flex-1 min-w-[160px]" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />
          <Button onClick={() => { if (term.trim()) { add({ term: term.trim(), kind, classification: "", sort_order: rows.length }); setTerm(""); } }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {rows.map((t) => (
          <div key={t.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded bg-muted">{KIND_LABELS[t.kind]}</span>
              <Input defaultValue={t.term} onBlur={(e) => e.target.value !== t.term && update(t.id, { term: e.target.value })} className="font-medium flex-1 min-w-[140px]" />
              {t.kind === "noun" && (
                <Select value={t.classification || ""} onValueChange={(v) => update(t.id, { classification: v })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Classify" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entity">Entity</SelectItem>
                    <SelectItem value="value_object">Value Object</SelectItem>
                    <SelectItem value="aggregate">Aggregate</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" size="icon" onClick={() => del(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea defaultValue={t.definition || ""} placeholder="Definition" onBlur={(e) => update(t.id, { definition: e.target.value })} className="min-h-[50px]" />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Capture nouns, verbs, policies, states, artifacts.</p>}
      </CardContent>
    </Card>
  );
};

// ---------- Step 4 ----------
const StepData = ({ data, ext, addData, updateData, delData, addExt, updateExt, delExt }: {
  data: ReDataObject[]; ext: ReExternalSystem[];
  addData: (r: Record<string, unknown>) => void; updateData: (id: string, p: Record<string, unknown>) => void; delData: (id: string) => void;
  addExt: (r: Record<string, unknown>) => void; updateExt: (id: string, p: Record<string, unknown>) => void; delExt: (id: string) => void;
}) => {
  const [dname, setDname] = useState("");
  const [ename, setEname] = useState("");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Data & source of truth</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={dname} onChange={(e) => setDname(e.target.value)} placeholder="Data object" />
            <Button onClick={() => { if (dname.trim()) { addData({ name: dname.trim(), sort_order: data.length }); setDname(""); } }}><Plus className="w-4 h-4" /></Button>
          </div>
          {data.map((d) => (
            <div key={d.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input defaultValue={d.name} onBlur={(e) => e.target.value !== d.name && updateData(d.id, { name: e.target.value })} className="font-medium" />
                <Button variant="ghost" size="icon" onClick={() => delData(d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
              <Input defaultValue={d.system_of_record || ""} placeholder="System of record (app DB, Drive, email…)" onBlur={(e) => updateData(d.id, { system_of_record: e.target.value })} />
              <Textarea defaultValue={d.sync_rules || ""} placeholder="Sync rules" onBlur={(e) => updateData(d.id, { sync_rules: e.target.value })} className="min-h-[50px]" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>External systems</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={ename} onChange={(e) => setEname(e.target.value)} placeholder="External system (Drive, CRM…)" />
            <Button onClick={() => { if (ename.trim()) { addExt({ name: ename.trim(), sort_order: ext.length }); setEname(""); } }}><Plus className="w-4 h-4" /></Button>
          </div>
          {ext.map((e) => (
            <div key={e.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input defaultValue={e.name} onBlur={(ev) => ev.target.value !== e.name && updateExt(e.id, { name: ev.target.value })} className="font-medium" />
                <Button variant="ghost" size="icon" onClick={() => delExt(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
              <Input defaultValue={e.purpose || ""} placeholder="Purpose" onBlur={(ev) => updateExt(e.id, { purpose: ev.target.value })} />
              <Input defaultValue={e.direction || ""} placeholder="Direction (upstream/downstream)" onBlur={(ev) => updateExt(e.id, { direction: ev.target.value })} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Wizard;
