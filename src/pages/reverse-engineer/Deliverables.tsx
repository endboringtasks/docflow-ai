import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Save, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReverseEngineerLayout from "@/components/reverse-engineer/ReverseEngineerLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CATEGORY_LABELS, deliverableToMarkdown } from "@/lib/reverseEngineer/templates";
import type { ReDeliverable, DeliverableCategory, ReProject } from "@/lib/reverseEngineer/types";

const CATS: DeliverableCategory[] = ["ddd", "bdd", "tech", "docs"];

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const Deliverables = () => {
  const { projectId } = useParams();
  const { toast } = useToast();
  const qc = useQueryClient();

  const projQ = useQuery({
    queryKey: ["re_project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("re_projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data as unknown as ReProject;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["re_deliverables", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("re_deliverables").select("*").eq("project_id", projectId!).order("sort_order");
      if (error) throw error;
      return data as unknown as ReDeliverable[];
    },
  });

  const exportAll = () => {
    const name = projQ.data?.name || "project";
    const md = `# ${name} — Reverse Engineering Deliverables\n\n${CATS.flatMap((c) => {
      const group = items.filter((d) => d.category === c);
      if (!group.length) return [];
      return [`# ${CATEGORY_LABELS[c]}\n`, ...group.map(deliverableToMarkdown)];
    }).join("\n")}`;
    download(`${slug(name)}-deliverables.md`, md);
  };

  const exportCategory = (cat: DeliverableCategory) => {
    const name = projQ.data?.name || "project";
    const group = items.filter((d) => d.category === cat);
    const md = `# ${name} — ${CATEGORY_LABELS[cat]}\n\n${group.map(deliverableToMarkdown).join("\n")}`;
    download(`${slug(name)}-${cat}.md`, md);
  };

  return (
    <ReverseEngineerLayout title={projQ.data?.name} backTo="/app/reverse-engineer">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Deliverables</h1>
          <Button onClick={exportAll} disabled={!items.length}><Download className="w-4 h-4 mr-2" /> Export all (.md)</Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            No deliverables yet. Run the wizard's Synthesis step to generate them.
          </CardContent></Card>
        ) : (
          <Tabs defaultValue="ddd">
            <TabsList className="flex-wrap h-auto">
              {CATS.map((c) => <TabsTrigger key={c} value={c}>{CATEGORY_LABELS[c]}</TabsTrigger>)}
            </TabsList>
            {CATS.map((c) => {
              const group = items.filter((d) => d.category === c);
              return (
                <TabsContent key={c} value={c} className="space-y-4">
                  {group.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Not generated for this project.</p>
                  ) : (
                    <>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => exportCategory(c)}>
                          <Download className="w-4 h-4 mr-2" /> Export {CATEGORY_LABELS[c]}
                        </Button>
                      </div>
                      {group.map((d) => <DeliverableEditor key={d.id} item={d} onSaved={() => qc.invalidateQueries({ queryKey: ["re_deliverables", projectId] })} />)}
                    </>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </ReverseEngineerLayout>
  );
};

const DeliverableEditor = ({ item, onSaved }: { item: ReDeliverable; onSaved: () => void }) => {
  const { toast } = useToast();
  const [content, setContent] = useState(item.content_md);
  const [assumptions, setAssumptions] = useState(item.assumptions || "");
  const [openQ, setOpenQ] = useState(item.open_questions || "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("re_deliverables")
        .update({ content_md: content, assumptions, open_questions: openQ, version: item.version + 1 })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Saved" }); onSaved(); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const dirty = content !== item.content_md || assumptions !== (item.assumptions || "") || openQ !== (item.open_questions || "");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{item.title}</CardTitle>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs min-h-[180px]" />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Assumptions</Label>
          <Textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} className="font-mono text-xs min-h-[70px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Open questions</Label>
          <Textarea value={openQ} onChange={(e) => setOpenQ(e.target.value)} className="font-mono text-xs min-h-[70px]" />
        </div>
      </CardContent>
    </Card>
  );
};

export default Deliverables;
