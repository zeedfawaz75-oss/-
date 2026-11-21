import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECTORS, type Sector } from "@/lib/directory-data";

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  description: string | null;
  keywords: string[];
  sort_order: number;
  is_hidden: boolean;
}

/** Compose the DB id of a subsection: `sectorId:subId`. */
export const subRowId = (sectorId: string, subId: string) => `${sectorId}:${subId}`;

/** Turn flat category rows into the Sector[] shape the app already uses. */
export function buildSectors(rows: CategoryRow[]): Sector[] {
  const parents = rows
    .filter((r) => !r.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  return parents.map((p) => ({
    id: p.id,
    title: p.title,
    icon: p.icon ?? "📌",
    keywords: p.keywords ?? [],
    subsections: rows
      .filter((r) => r.parent_id === p.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id.includes(":") ? s.id.split(":").slice(1).join(":") : s.id,
        title: s.title,
        description: s.description ?? undefined,
        keywords: s.keywords ?? [],
      })),
  }));
}

export async function fetchCategoryRows(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, title, icon, description, keywords, sort_order, is_hidden")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryRow[];
}

/**
 * Categories loaded from the database (managed in the admin dashboard),
 * falling back to the bundled static list until the first load resolves.
 */
export function useCategories() {
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchCategoryRows());
    } catch {
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const sectors: Sector[] = rows && rows.length > 0 ? buildSectors(rows) : SECTORS;
  const hidden = new Set((rows ?? []).filter((r) => !r.parent_id && r.is_hidden).map((r) => r.id));
  const visibleSectors = rows && rows.length > 0
    ? sectors.filter((s) => !hidden.has(s.id))
    : sectors.filter((s) => s.id !== "misc");

  return { rows: rows ?? [], sectors, visibleSectors, loading, reload };
}