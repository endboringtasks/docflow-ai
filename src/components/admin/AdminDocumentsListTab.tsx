import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DocumentDefinition {
  id: string;
  company_id: string;
  category: string;
  document_name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

export default function AdminDocumentsListTab() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");

  // Fetch all companies for the filter
  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  // Fetch all document definitions across all companies
  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ["admin-document-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_definitions")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("sort_order")
        .order("document_name");
      if (error) throw error;
      return data as DocumentDefinition[];
    },
  });

  // Build company name lookup
  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [companies]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(definitions.map((d) => d.category));
    return Array.from(cats).sort();
  }, [definitions]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = definitions;
    if (filterCompany && filterCompany !== "all") {
      list = list.filter((d) => d.company_id === filterCompany);
    }
    if (filterCategory && filterCategory !== "all") {
      list = list.filter((d) => d.category === filterCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.document_name.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [definitions, filterCompany, filterCategory, search]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearch("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {search || filterCategory !== "all" || filterCompany !== "all"
              ? "No documents match your filter"
              : "No document definitions found"}
          </h3>
          <p className="text-muted-foreground">
            {search || filterCategory !== "all" || filterCompany !== "all"
              ? "Try a different search, category, or company."
              : "Companies haven't created any document definitions yet."}
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Document Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((def) => (
                <TableRow key={def.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {companyMap.get(def.company_id) || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{def.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{def.document_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">
                    {def.description || <span className="italic">No description</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-sm text-muted-foreground">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== definitions.length && ` (of ${definitions.length} total)`}
          </div>
        </>
      )}
    </div>
  );
}
