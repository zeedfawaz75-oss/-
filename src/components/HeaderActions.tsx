import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Hand, User as UserIcon } from "lucide-react";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { HelpModal } from "@/components/HelpModal";
import { ShopThumb } from "@/components/ShopThumb";

import { useServerFn } from "@tanstack/react-start";
import { useNotifications } from "@/hooks/useNotifications";
import { useDbNotifications, notifIcon } from "@/hooks/useDbNotifications";
import { useAdmin } from "@/hooks/useAdmin";
import { useFavorites } from "@/hooks/useFavorites";
import { useDarkMode } from "@/hooks/useLocalState";
import { adminPendingCount } from "@/lib/shops.functions";
import { fetchApprovedShops, readCachedApprovedShops, type Shop } from "@/lib/shops";
import { supabase } from "@/integrations/supabase/client";
import { sendWaNotification } from "@/lib/wa-notify";
import type { User } from "@supabase/supabase-js";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

/** Shared glass pill style for every header control. */
const ICON_BTN =
  "relative w-10 h-10 grid place-items-center rounded-full bg-white/12 backdrop-blur-md border border-white/20 text-[17px] leading-none shadow-sm hover:bg-white/22 active:scale-95 transition-smooth";

function Badge({ count, tone = "emergency" }: { count: number; tone?: "emergency" | "gold" }) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute -top-1 -left-1 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-black grid place-items-center ring-2 ring-black/10 shadow ${
        tone === "gold" ? "bg-gold text-gold-foreground" : "bg-emergency text-emergency-foreground"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function HeaderActions() {
  const local = useNotifications();
  const db = useDbNotifications();
  const items = [
    ...db.items.map((n) => ({
      id: n.id,
      text: n.body ? `${n.title} — ${n.body}` : n.title,
      icon: notifIcon(n.type),
      ts: new Date(n.created_at).getTime(),
      read: n.is_read,
    })),
    ...local.items,
  ].sort((a, b) => b.ts - a.ts);
  const unread = local.unread + db.unread;
  const markAllRead = () => {
    local.markAllRead();
    db.markAllRead();
  };
  const clear = () => {
    local.clear();
    db.clear();
  };

  const [open, setOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loginConfirmOpen, setLoginConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAdmin();
  const { favs } = useFavorites();
  const favCount = Object.keys(favs).length;
  const { dark, toggle: toggleDark } = useDarkMode();
  const [user, setUser] = useState<User | null>(null);
  const userPhone =
    (user?.user_metadata?.phone as string | undefined) ??
    user?.phone ??
    (user?.email ? user.email.split("@")[0] : null);
  const [shops, setShops] = useState<Shop[]>(() => readCachedApprovedShops() ?? []);
  const [pendingCount, setPendingCount] = useState(0);
  const pendingFn = useServerFn(adminPendingCount);

  const favoriteShops = useMemo(() => shops.filter((s) => favs[s.id]), [shops, favs]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchApprovedShops()
      .then(setShops)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await pendingFn({ data: undefined });
        if (!cancelled) setPendingCount(res.count);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAdmin, pendingFn]);

  useEffect(() => {
    if (!open && !favOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFavOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, favOpen]);

  const toggleBell = () => {
    setFavOpen(false);
    setOpen((v) => {
      const next = !v;
      if (next && unread > 0) setTimeout(markAllRead, 600);
      return next;
    });
  };

  return (
    <div ref={barRef} className="flex items-center justify-between gap-2 w-full">
      {/* Primary cluster — interaction icons */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={toggleBell}
            aria-label="الإشعارات"
            title="الإشعارات"
            className={ICON_BTN}
          >
            🔔
            <Badge count={unread} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-[99998] bg-black/20" onClick={() => setOpen(false)} />
              <div className="absolute top-12 right-0 w-72 max-w-[85vw] bg-card text-foreground rounded-2xl shadow-elegant border border-border z-[99999] animate-fade-in-up">
                <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/50">
                  <span className="font-black text-sm">🔔 الإشعارات</span>
                  {items.length > 0 && (
                    <button
                      onClick={clear}
                      className="text-[11px] text-muted-foreground hover:text-emergency font-bold"
                    >
                      مسح الكل
                    </button>
                  )}
                </div>
                <div className="max-h-[75vh] overflow-y-auto overscroll-contain">
                  {items.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">
                      لا توجد إشعارات بعد.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {items.map((n) => (
                        <li
                          key={n.id}
                          className="p-3 flex gap-2.5 items-start hover:bg-secondary/40 transition-smooth"
                        >
                          <span className="text-lg leading-none mt-0.5">{n.icon ?? "🔔"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-snug">{n.text}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {timeAgo(n.ts)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => sendWaNotification(userPhone, n.text)}
                            title="إرسال هذا الإشعار إلى واتساب"
                            aria-label="إرسال إلى واتساب"
                            className="shrink-0 text-emerald-600 text-sm"
                          >
                            💬
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Favorites — compact dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setOpen(false);
              setFavOpen((v) => !v);
            }}
            aria-label="المفضلة"
            title="محلاتي المفضلة"
            aria-expanded={favOpen}
            className={ICON_BTN}
          >
            <span className="text-emergency text-lg leading-none">❤</span>
            <Badge count={favCount} />
          </button>

          {favOpen && (
            <>
              <div
                className="fixed inset-0 z-[99998] bg-black/20"
                onClick={() => setFavOpen(false)}
              />
              <div className="absolute top-12 right-0 w-72 max-w-[85vw] bg-card text-foreground rounded-2xl shadow-elegant border border-border z-[99999] animate-fade-in-up">
                <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/50">
                  <span className="font-black text-sm">❤ محلاتي المفضلة</span>
                  <span className="text-[11px] text-muted-foreground font-bold">
                    {favoriteShops.length}
                  </span>
                </div>
                <div className="max-h-[75vh] overflow-y-auto overscroll-contain">
                  {favoriteShops.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">
                      لا توجد محلات في مفضلتك بعد — اضغط ♡ على أي محل ليظهر هنا.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {favoriteShops.map((s) => (
                        <li key={s.id}>
                          <Link
                            to="/shop/$id"
                            params={{ id: s.id }}
                            onClick={() => setFavOpen(false)}
                            className="flex items-center gap-2.5 p-3 hover:bg-secondary/40 transition-smooth"
                          >
                            <ShopThumb
                              url={s.image_url}
                              name={s.name}
                              className="w-9 h-9 shrink-0 rounded-xl block"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-bold text-foreground truncate">
                                {s.name}
                              </span>
                              {s.address && (
                                <span className="block text-[10px] text-muted-foreground truncate">
                                  📍 {s.address}
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground text-xs">←</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Help */}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="التعليمات والمساعدة"
          title="كيف يعمل الدليل؟"
          className={ICON_BTN}
        >
          <Hand size={20} />
        </button>

        {/* Admin — visible only for admins */}
        {isAdmin && (
          <Link
            to="/admin"
            aria-label="لوحة الإدارة — طلبات قيد المراجعة"
            title="لوحة الإدارة"
            className="relative w-10 h-10 grid place-items-center rounded-full bg-gold-gradient text-gold-foreground text-[17px] leading-none shadow-gold hover:opacity-90 active:scale-95 transition-smooth"
          >
            🛡️
            <Badge count={pendingCount} />
          </Link>
        )}
      </div>

      {/* System cluster — theme + account, visually separated */}
      <div className="flex items-center gap-2 pr-2 sm:pr-3 mr-1 border-r border-white/20">
        <button
          onClick={toggleDark}
          aria-label="تبديل الوضع الليلي"
          title={dark ? "الوضع النهاري" : "الوضع الليلي"}
          className={ICON_BTN}
        >
          {dark ? "☀️" : "🌙"}
        </button>
        {user ? (
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            className={`${ICON_BTN} bg-gold-gradient text-gold-foreground border-gold/30 hover:opacity-90`}
          >
            <UserIcon size={20} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLoginConfirmOpen(true)}
            aria-label="تسجيل الدخول"
            title="تسجيل الدخول"
            className={`${ICON_BTN} !bg-muted text-foreground border-white/10 hover:!bg-muted/80`}
          >
            <UserIcon size={20} />
          </button>
        )}
      </div>

      {/* Help modal */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Login confirmation dialog */}
      {loginConfirmOpen && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
          onClick={() => setLoginConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card text-foreground rounded-2xl shadow-elegant overflow-hidden animate-fade-in-up max-h-[92dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="bg-hero text-primary-foreground p-4 text-center relative">
              <div className="absolute top-2 left-2">
                <ModalCloseButton onClose={() => setLoginConfirmOpen(false)} />
              </div>
              <div className="text-3xl mb-1">👋</div>
              <h3 className="font-black">تسجيل الدخول</h3>
            </div>
            <p className="p-5 text-sm text-center leading-relaxed">
              هل ترغب في تسجيل الدخول للاستفادة من مميزات التطبيق؟
            </p>
            <div className="p-4 pt-0 flex gap-3">
              <button
                onClick={() => setLoginConfirmOpen(false)}
                className="flex-1 bg-muted text-foreground rounded-xl py-2.5 font-bold hover:bg-muted/80 transition-smooth"
              >
                إلغاء
              </button>
              <Link
                to="/auth"
                onClick={() => setLoginConfirmOpen(false)}
                className="flex-1 bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold text-center hover:opacity-90 transition-smooth"
              >
                موافق
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirmation dialog */}
      {logoutConfirmOpen && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card text-foreground rounded-2xl shadow-elegant overflow-hidden animate-fade-in-up max-h-[92dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="bg-hero text-primary-foreground p-4 text-center relative">
              <div className="absolute top-2 left-2">
                <ModalCloseButton onClose={() => setLogoutConfirmOpen(false)} />
              </div>
              <div className="text-3xl mb-1">🚪</div>
              <h3 className="font-black">تسجيل الخروج</h3>
            </div>
            <p className="p-5 text-sm text-center leading-relaxed">
              هل أنت متأكد أنك تريد تسجيل الخروج؟
            </p>
            <div className="p-4 pt-0 flex gap-3">
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 bg-muted text-foreground rounded-xl py-2.5 font-bold hover:bg-muted/80 transition-smooth"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  supabase.auth.signOut();
                }}
                className="flex-1 bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold text-center hover:opacity-90 transition-smooth"
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
