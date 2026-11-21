import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  cta_label: string | null;
  target_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const COLS = "id, title, subtitle, image_url, cta_label, target_url, sort_order, is_active";

/** Active banners for the home page (public read). */
export function useBanners() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("banners")
      .select(COLS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setBanners((data ?? []) as BannerRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { banners, loading };
}

/** All banners, including inactive ones — admin only (RLS enforced). */
export function useAllBanners() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("banners")
      .select(COLS)
      .order("sort_order", { ascending: true });
    setBanners((data ?? []) as BannerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { banners, loading, reload };
}