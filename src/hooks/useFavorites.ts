import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Supabase-backed favorites. Requires an authenticated user.
 * Keeps the same API surface as the legacy local hook: { favs, isFav, toggle, loading, needsAuth }.
 */
export function useFavorites() {
  const [favs, setFavs] = useState<Record<string, true>>({});
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setFavs({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("favorites").select("shop_id").eq("user_id", uid);
    const next: Record<string, true> = {};
    (data ?? []).forEach((r) => {
      next[r.shop_id as string] = true;
    });
    setFavs(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      load(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      load(u?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const isFav = useCallback((id: string) => !!favs[id], [favs]);

  const toggle = useCallback(
    async (id: string) => {
      if (!user) return { needsAuth: true as const };
      const wasFav = !!favs[id];
      // optimistic
      setFavs((prev) => {
        const next = { ...prev };
        if (wasFav) delete next[id];
        else next[id] = true;
        return next;
      });
      if (wasFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("shop_id", id);
        if (error) {
          // rollback
          setFavs((prev) => ({ ...prev, [id]: true }));
          return { error: error.message };
        }
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, shop_id: id });
        if (error) {
          setFavs((prev) => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
          return { error: error.message };
        }
      }
      return { ok: true as const };
    },
    [user, favs],
  );

  return { favs, isFav, toggle, loading, needsAuth: !user };
}
