import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side check of whether the current user has the `admin` role
 * in the user_roles table. Returns { isAdmin, loading, userId }.
 *
 * Uses the `has_role` security-definer RPC (RLS-safe).
 */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });
      if (cancelled) return;
      setIsAdmin(!error && !!data);
      setLoading(false);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, userId, loading };
}
