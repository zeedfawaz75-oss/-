import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase-backed user rating (1..5) for a specific shop.
 * The DB trigger recomputes shops.rating as the AVG of all ratings.
 */
export function useShopRating(shopId: string) {
  const [userRating, setUserRating] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async (uid: string | null) => {
      setUserId(uid);
      if (!uid) { setUserRating(0); setLoading(false); return; }
      const { data } = await supabase
        .from("ratings")
        .select("rating")
        .eq("user_id", uid)
        .eq("shop_id", shopId)
        .maybeSingle();
      if (cancelled) return;
      setUserRating(data?.rating ?? 0);
      setLoading(false);
    };
    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => load(session?.user ?? null ? session!.user.id : null));
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [shopId]);

  const rate = useCallback(async (value: number): Promise<{ ok?: true; needsAuth?: true; error?: string }> => {
    if (!userId) return { needsAuth: true };
    const clamped = Math.max(1, Math.min(5, Math.round(value)));
    const prev = userRating;
    setUserRating(clamped);
    const { error } = await supabase
      .from("ratings")
      .upsert(
        { user_id: userId, shop_id: shopId, rating: clamped },
        { onConflict: "shop_id,user_id" },
      );
    if (error) { setUserRating(prev); return { error: error.message }; }
    return { ok: true };
  }, [userId, shopId, userRating]);

  return { userRating, rate, loading, needsAuth: !userId };
}
