import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileSearch, Trash2, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReverseEngineerLayout from "@/components/reverse-engineer/ReverseEngineerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buildDemoData } from "@/lib/reverseEngineer/demo";
import type { ReProject } from "@/lib/reverseEngineer/types";

const Projects = () => {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const companyId = currentCompany?.id;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [seeding, setSeeding] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["re_projects", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("re_projects")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ReProject[];
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("re_projects")
        .insert({ company_id: companyId!, name: name.trim(), description: description.trim() || null, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ReProject;
    },
    onSuccess: (p) => {
      setOpen(false); setName(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["re_projects", companyId] });
      navigate(`/app/reverse-engineer/${p.id}/wizard`);
    },
    onError: (e: Error) => toast({ title: "Failed to create project", description: e.message, variant: "destructive" }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("re_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["re_projects", companyId] }),
    onError: (e: Error) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const createDemo = async () => {
    if (!companyId || !user) return;
    setSeeding(true);
    try {
      const { data: proj, error } = await supabase
        .from("re_projects")
        .insert({
          company_id: companyId,
          name: "Docflow AI (Demo)",
          description: "Document collection & validation platform for migration agents.",
          industry: "Migration / Legal Services",
          audience: "Migration agents and their clients",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      const id = (proj as unknown as ReProject).id;
      const demo = buildDemoData(id, companyId);
      await Promise.all([
        supabase.from("re_roles").insert(demo.roles),
        supabase.from("re_journeys").insert(demo.journeys),
        supabase.from("re_domain_terms").insert(demo.terms),
        supabase.from("re_data_objects").insert(demo.dataObjects),
        supabase.from("re_external_systems").insert(demo.externalSystems),
      ]);
      qc.invalidateQueries({ queryKey: ["re_projects", companyId] });
      toast({ title: "Demo project created" });
      navigate(`/app/reverse-engineer/${id}/wizard`);
    } catch (e) {
      toast({ title: "Failed to seed demo", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ReverseEngineerLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSearch className="w-6 h-6 text-primary" /> Reverse Engineer
            </h1>
            <p className="text-muted-foreground mt-1">
              Turn an existing product into DDD, BDD, technical specs and documentation.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={createDemo} disabled={seeding}>
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Demo project
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> New project</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-name">Project name</Label>
                    <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My product" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-desc">Short description</Label>
                    <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does it do?" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => createProject.mutate()} disabled={!name.trim() || createProject.isPending}>
                    {createProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <FileSearch className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">Create a project or load the demo to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes "{p.name}" and its intake data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteProject.mutate(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {p.description && <CardDescription>{p.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/app/reverse-engineer/${p.id}/wizard`}>Open wizard</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to={`/app/reverse-engineer/${p.id}/deliverables`}>Deliverables</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ReverseEngineerLayout>
  );
};

export default Projects;
