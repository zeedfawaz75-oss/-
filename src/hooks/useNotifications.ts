import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface NotifItem {
  id: string;
  text: string;
  icon?: string;
  ts: number;
  read?: boolean;
}

const KEY = "marib:notifications";
const MAX = 30;

function read(): NotifItem[] {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as NotifItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: NotifItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("marib:notif-change"));
  } catch {
    /* ignore */
  }
}

// Global helper — toast + persist
export function notify(text: string, icon = "🔔") {
  toast.success(text);
  const items = read();
  const next = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      icon,
      ts: Date.now(),
      read: false,
    },
    ...items,
  ].slice(0, MAX);
  write(next);
}

export function useNotifications() {
  const [items, setItems] = useState<NotifItem[]>(() => read());

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener("marib:notif-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("marib:notif-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = useCallback(() => {
    write(read().map((i) => ({ ...i, read: true })));
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  return { items, unread, markAllRead, clear };
}
