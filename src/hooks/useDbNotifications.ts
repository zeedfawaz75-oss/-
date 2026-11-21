import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbNotif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  shop_id: string | null;
  is_read: boolean;
  created_at: string;
}

const ICONS: Record<string, string> = {
  shop_pending: "🛎️",
  shop_approved: "✅",
  shop_rejected: "⛔",
};

export function notifIcon(type: string) {
  return ICONS[type] ?? "🔔";
}

/** Server-side notifications for the signed-in user (RLS scoped). */
export function useDbNotifications() {
  const [items, setItems] = useState<DbNotif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    setUserId(uid);
    if (!uid) { setItems([]); return; }
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, shop_id, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as DbNotif[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { clearInterval(t); sub.subscription.unsubscribe(); };
  }, [load]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  }, [userId]);

  const clear = useCallback(async () => {
    if (!userId) return;
    setItems([]);
    await supabase.from("notifications").delete().eq("user_id", userId);
  }, [userId]);

  const unread = items.filter((i) => !i.is_read).length;
  return { items, unread, markAllRead, clear, reload: load };
}