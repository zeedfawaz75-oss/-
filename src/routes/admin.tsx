import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminApproveShop,
  adminDeleteShop,
  adminListShops,
  adminRejectShop,
  adminStats,
} from "@/lib/shops.functions";
import { adminOverview } from "@/lib/admin.functions";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { BannersManager } from "@/components/admin/BannersManager";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";
import { findSector, findSubsection } from "@/lib/directory-data";
import { ShopThumb } from "@/components/ShopThumb";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";
import { sendWaNotification } from "@/lib/wa-notify";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "لوحة الإدارة — دليل مأرب" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

interface ShopRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  sector_id: string;
  subsection_id: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
  image_url?: string | null;
}

type Tab = "overview" | "shops" | "categories" | "users" | "banners" | "broadcast";

const MODERATION_REASONS = [
  "صورة المحل غير مطابقة للنشاط",
  "بيانات التواصل أو العنوان غير مكتملة",
  "طلب مكرر",
] as const;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "نظرة عامة", icon: "📊" },
  { id: "shops", label: "المحلات", icon: "🏪" },
  { id: "categories", label: "الأقسام", icon: "🗂" },
  { id: "users", label: "المستخدمون", icon: "👥" },
  { id: "banners", label: "الإعلانات", icon: "📢" },
  { id: "broadcast", label: "إشعار عام", icon: "📣" },
];

function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin, userId, loading: adminLoading } = useAdmin();
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<{
    approved: number;
    pending: number;
    rejected: number;
    totalShops: number;
    reviews: number;
    categories: number;
    totalUsers: number;
    newUsers7d: number;
  } | null>(null);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [confirmDelete, setConfirmDelete] = useState<ShopRow | null>(null);
  const [rejectShop, setRejectShop] = useState<ShopRow | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [stats, setStats] = useState<{
    pending: number;
    totalUsers: number;
    newUsers7d: number;
    recentUsers: { id: string; label: string; created_at: string }[];
  } | null>(null);

  const listFn = useServerFn(adminListShops);
  const approveFn = useServerFn(adminApproveShop);
  const rejectFn = useServerFn(adminRejectShop);
  const deleteFn = useServerFn(adminDeleteShop);
  const statsFn = useServerFn(adminStats);
  const overviewFn = useServerFn(adminOverview);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listFn({ data: undefined });
      setShops(rows as ShopRow[]);
      try {
        setStats(await statsFn({ data: undefined }));
      } catch {
        /* stats are optional */
      }
      try {
        setOverview(await overviewFn({ data: undefined }));
      } catch {
        /* overview is optional */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const act = async (id: string, kind: "approve" | "reject" | "delete", reason = "") => {
    try {
      const shop = shops.find((r) => r.id === id);
      const result =
        kind === "approve"
          ? await approveFn({ data: { shopId: id } })
          : kind === "reject"
            ? await rejectFn({ data: { shopId: id, reason } })
            : await deleteFn({ data: { shopId: id, reason } });
      if (!result.ok) throw new Error("تعذّر تأكيد حفظ حالة المحل.");
      const title =
        kind === "approve"
          ? "تم اعتماد المحل ونشره ✓"
          : kind === "reject"
            ? "تم رفض المحل ✗"
            : "تم حذف المحل 🗑";
      toast.success(title);
      if (shop) {
        const msg =
          kind === "approve"
            ? `تم اعتماد محلك «${shop.name}» ونشره في دليل مأرب 🎉`
            : kind === "reject"
              ? `نعتذر، تم رفض طلب المحل «${shop.name}» بسبب: ${reason}`
              : `تم حذف المحل «${shop.name}» بسبب: ${reason}`;
        toast.success("إشعار جاهز للإرسال عبر واتساب", {
          action: {
            label: "إرسال 💬",
            onClick: () => {
              if (!sendWaNotification(shop.phone ?? shop.whatsapp, msg))
                toastFail("لا يوجد رقم واتساب لصاحب المحل");
            },
          },
        });
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ";
      setError(msg);
      toastFail(msg);
    }
  };

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      total: shops.length,
      shops,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marib-directory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير نسخة احتياطية من بيانات المحلات");
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        جارِ التحقق من الصلاحيات...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-elegant p-6 space-y-4 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="font-black text-xl">لوحة الإدارة</h1>
          <p className="text-sm text-muted-foreground">يجب تسجيل الدخول أولاً بحساب مسؤول.</p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold"
          >
            تسجيل الدخول
          </button>
          <Link to="/" className="block text-xs text-muted-foreground">
            ← الرجوع
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-elegant p-6 space-y-4 text-center">
          <div className="text-4xl">⛔</div>
          <h1 className="font-black text-xl">صلاحية مرفوضة</h1>
          <p className="text-sm text-muted-foreground">
            هذه الصفحة للمسؤولين فقط. تواصل مع الإدارة لمنحك صلاحية المسؤول.
          </p>
          <Link
            to="/"
            className="block bg-primary text-primary-foreground rounded-xl py-2.5 font-bold"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const counts = {
    pending: shops.filter((s) => s.status === "pending").length,
    approved: shops.filter((s) => s.status === "approved").length,
    rejected: shops.filter((s) => s.status === "rejected").length,
    all: shops.length,
  };
  const visible = filter === "all" ? shops : shops.filter((s) => s.status === filter);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-hero text-primary-foreground p-4 shadow-elegant">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-black text-xl">لوحة الإدارة</h1>
            <p className="text-xs opacity-85">إدارة طلبات المحلات</p>
          </div>
          <Link to="/" className="text-sm bg-card text-foreground rounded-xl px-3 py-1.5 font-bold">
            ← الرئيسية
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6">
        <nav className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-smooth ${tab === t.id ? "bg-primary text-primary-foreground shadow-soft" : "bg-card border border-border text-foreground"}`}
            >
              <span className="ml-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <>
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {[
                { label: "محلات معتمدة", value: overview?.approved ?? counts.approved, icon: "✅" },
                {
                  label: "قيد المراجعة",
                  value: overview?.pending ?? stats?.pending ?? counts.pending,
                  icon: "🛎️",
                },
                {
                  label: "إجمالي المستخدمين",
                  value: overview?.totalUsers ?? stats?.totalUsers ?? 0,
                  icon: "👥",
                },
                {
                  label: "مستخدمون جدد (7 أيام)",
                  value: overview?.newUsers7d ?? stats?.newUsers7d ?? 0,
                  icon: "🆕",
                },
                { label: "إجمالي المحلات", value: overview?.totalShops ?? counts.all, icon: "🏪" },
                { label: "طلبات مرفوضة", value: overview?.rejected ?? counts.rejected, icon: "⛔" },
                { label: "التعليقات والتقييمات", value: overview?.reviews ?? 0, icon: "⭐" },
                { label: "الأقسام والتصنيفات", value: overview?.categories ?? 0, icon: "🗂" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="bg-card border border-border rounded-2xl p-3 text-center shadow-soft"
                >
                  <div className="text-xl">{c.icon}</div>
                  <div className="font-black text-lg">{c.value}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{c.label}</div>
                </div>
              ))}
            </section>

            {stats && stats.recentUsers.length > 0 && (
              <details className="mb-5 bg-card border border-border rounded-2xl p-3">
                <summary className="text-sm font-bold cursor-pointer">
                  آخر المستخدمين المسجّلين
                </summary>
                <ul className="mt-2 divide-y divide-border">
                  {stats.recentUsers.map((u) => (
                    <li key={u.id} className="py-1.5 flex items-center justify-between text-xs">
                      <span className="font-bold" dir="ltr">
                        {u.label}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("ar")}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {tab === "shops" && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["pending", "approved", "rejected", "all"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-smooth ${filter === k ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}
                >
                  {k === "pending"
                    ? "قيد المراجعة"
                    : k === "approved"
                      ? "معتمد"
                      : k === "rejected"
                        ? "مرفوض"
                        : "الكل"}{" "}
                  ({counts[k]})
                </button>
              ))}
              <button
                onClick={load}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl text-sm font-bold bg-secondary text-secondary-foreground border border-border disabled:opacity-50"
              >
                {loading ? "..." : "↻ تحديث"}
              </button>
              <button
                onClick={exportData}
                disabled={shops.length === 0}
                className="px-3 py-1.5 rounded-xl text-sm font-bold bg-gold-gradient text-gold-foreground disabled:opacity-50"
              >
                ⬇ تصدير البيانات
              </button>
            </div>

            {error && (
              <p className="text-sm text-emergency bg-emergency/10 border border-emergency/30 rounded-xl p-3 mb-3">
                {error}
              </p>
            )}

            {visible.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">لا توجد طلبات.</p>
            ) : (
              <div className="grid gap-3">
                {visible.map((shop) => {
                  const sector = findSector(shop.sector_id);
                  const sub = findSubsection(shop.sector_id, shop.subsection_id);
                  return (
                    <article
                      key={shop.id}
                      className="bg-card border border-border rounded-2xl p-4 shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0 flex items-start gap-3">
                          <ShopThumb
                            url={shop.image_url}
                            name={shop.name}
                            linkable={!!shop.image_url}
                            className="shrink-0 w-16 h-16 rounded-xl border border-border block"
                          />
                          <div className="min-w-0">
                            <h3 className="font-bold">{shop.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {sector?.icon} {sector?.title} ← {sub?.title}
                            </p>
                            {!shop.image_url && (
                              <span className="text-[11px] text-emergency">
                                لا توجد صورة مرفوعة
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${shop.status === "pending" ? "bg-gold/20 text-gold" : shop.status === "approved" ? "bg-primary/15 text-primary" : "bg-emergency/15 text-emergency"}`}
                        >
                          {shop.status === "pending"
                            ? "قيد المراجعة"
                            : shop.status === "approved"
                              ? "معتمد"
                              : "مرفوض"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{shop.description}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        📞 {shop.phone}
                        {shop.whatsapp ? ` · 💬 ${shop.whatsapp}` : ""}
                      </p>
                      {shop.address && (
                        <p className="text-xs text-muted-foreground">📍 {shop.address}</p>
                      )}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {shop.status !== "approved" && (
                          <button
                            onClick={() => act(shop.id, "approve")}
                            className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold"
                          >
                            ✓ اعتماد
                          </button>
                        )}
                        {shop.status !== "rejected" && (
                          <button
                            onClick={() => {
                              setRejectShop(shop);
                              setModerationReason("");
                            }}
                            className="bg-secondary text-secondary-foreground border border-border rounded-lg px-3 py-1.5 text-xs font-bold"
                          >
                            ✗ رفض
                          </button>
                        )}
                        {shop.status === "pending" && (
                          <button
                            onClick={() =>
                              sendWaNotification(
                                shop.whatsapp ?? shop.phone,
                                `مرحباً، بخصوص طلب المحل «${shop.name}» في دليل مأرب، نود التواصل معكم لمراجعة طلبكم.`,
                              )
                                ? toast.success("تم تجهيز رسالة واتساب")
                                : toastFail("لا يوجد رقم واتساب لصاحب المحل")
                            }
                            className="bg-[#25D366] text-white rounded-lg px-3 py-1.5 text-xs font-bold"
                          >
                            💬 تواصل واتساب
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setModerationReason("");
                            setConfirmDelete(shop);
                          }}
                          className="bg-emergency text-emergency-foreground rounded-lg px-3 py-1.5 text-xs font-bold"
                        >
                          🗑 حذف
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "categories" && <CategoriesManager />}
        {tab === "users" && <UsersManager />}
        {tab === "banners" && <BannersManager />}
        {tab === "broadcast" && <BroadcastPanel />}
      </main>

      {rejectShop && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setRejectShop(null)}
        >
          <div
            className="w-full max-w-md bg-card text-foreground rounded-2xl shadow-elegant overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="bg-emergency text-emergency-foreground p-4 text-center">
              <h3 className="font-black">سبب رفض المحل</h3>
              <p className="text-xs opacity-90 mt-1">«{rejectShop.name}»</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {MODERATION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setModerationReason(reason)}
                    className="text-xs rounded-full border border-border bg-secondary px-3 py-1.5 font-bold"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                minLength={3}
                maxLength={500}
                rows={4}
                placeholder="اكتب سبب الرفض بوضوح..."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (moderationReason.trim().length < 3) {
                      toastFail("اكتب سبب الرفض أولاً");
                      return;
                    }
                    const shop = rejectShop;
                    setRejectShop(null);
                    await act(shop.id, "reject", moderationReason.trim());
                    setModerationReason("");
                  }}
                  className="flex-1 bg-emergency text-emergency-foreground rounded-xl py-2.5 font-bold text-sm"
                >
                  تأكيد الرفض
                </button>
                <button
                  onClick={() => setRejectShop(null)}
                  className="flex-1 bg-secondary border border-border rounded-xl py-2.5 font-bold text-sm"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-card text-foreground rounded-2xl shadow-elegant overflow-hidden animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="bg-emergency text-emergency-foreground p-4 text-center">
              <div className="text-3xl mb-1">⚠️</div>
              <h3 className="font-black">تأكيد الحذف النهائي</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-foreground">
                هل أنت متأكد من حذف <span className="font-bold">«{confirmDelete.name}»</span>{" "}
                نهائياً؟
              </p>
              <div className="flex flex-wrap gap-2">
                {MODERATION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setModerationReason(reason)}
                    className="text-xs rounded-full border border-border bg-secondary px-3 py-1.5 font-bold"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                minLength={3}
                maxLength={500}
                rows={4}
                placeholder="اكتب سبب الحذف بوضوح..."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (moderationReason.trim().length < 3) {
                      toastFail("اكتب سبب الحذف أولاً");
                      return;
                    }
                    const id = confirmDelete.id;
                    setConfirmDelete(null);
                    await act(id, "delete", moderationReason.trim());
                    setModerationReason("");
                  }}
                  className="flex-1 bg-emergency text-emergency-foreground rounded-xl py-2.5 font-bold text-sm"
                >
                  🗑 نعم، احذف
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 bg-secondary border border-border rounded-xl py-2.5 font-bold text-sm"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
