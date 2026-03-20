import { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc";

type ColumnAccessors<T> = Record<string, (item: T) => string | number | boolean | null | undefined>;

export function useTableSort<T>(
  data: T[] | undefined | null,
  accessors: ColumnAccessors<T>
) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }, [sortColumn]);

  const sortedData = useMemo(() => {
    if (!data || !sortColumn || !accessors[sortColumn]) return data ?? [];
    const accessor = accessors[sortColumn];
    return [...data].sort((a, b) => {
      const valA = accessor(a);
      const valB = accessor(b);
      let cmp: number;
      if (typeof valA === "number" && typeof valB === "number") {
        cmp = valA - valB;
      } else {
        cmp = String(valA ?? "").localeCompare(String(valB ?? ""));
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection, accessors]);

  return { sortedData, sortColumn, sortDirection, handleSort };
}

export function SortableTableHead({
  column,
  currentSort,
  direction,
  onSort,
  children,
  className,
}: {
  column: string;
  currentSort: string | null;
  direction: SortDirection;
  onSort: (col: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = currentSort === column;
  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}
