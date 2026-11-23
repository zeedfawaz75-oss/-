import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLegalPage, updateLegalPage } from "@/lib/legal.functions";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";

type Tab = "terms" | "privacy";

interface PageState {
  title: string;
  content: string;
}

const LABELS: Record<Tab, { title: string; desc: string }> = {
  terms: {
    title: "الشروط والأحكام",
    desc: "النص القانوني الذي يظهر لتبويب الشروط داخل نافذة المساعدة.",
  },
  privacy: {
    title: "سياسة الخصوصية",
    desc: "النص القانوني الذي يظهر لتبويب الخصوصية داخل نافذة المساعدة.",
  },
};

export function LegalManager() {
  const [tab, setTab] = useState<Tab>("terms");
  const [pages, setPages] = useState<Record<Tab, PageState>>({
    terms: { title: LABELS.terms.title, content: "" },
    privacy: { title: LABELS.privacy.title, content: "" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const getFn = useServerFn(getLegalPage);
  const updateFn = useServerFn(updateLegalPage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        getFn({ data: { slug: "terms" } }),
        getFn({ data: { slug: "privacy" } }),
      ]);
      setPages({
        terms: { title: t.title, content: t.content },
        privacy: { title: p.title, content: p.content },
      });
    } catch (err) {
      toastFail(err instanceof Error ? err.message : "تعذر تحميل الصفحات القانونية");
    } finally {
      setLoading(false);
    }
  }, [getFn]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({ data: { slug: tab, title: pages[tab].title, content: pages[tab].content } });
      toast.success("تم حفظ التغييرات ✓");
    } catch (err) {
      toastFail(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const current = pages[tab];

  return (
    <section className="space-y-4">
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        {(Object.keys(LABELS) as Tab[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-smooth ${
              tab === k
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-card border border-border text-foreground"
            }`}
          >
            {LABELS[k].title}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
        <p className="text-xs text-muted-foreground mb-3">{LABELS[tab].desc}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">جارِ التحميل…</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">العنوان</label>
              <input
                type="text"
                value={current.title}
                onChange={(e) =>
                  setPages((prev) => ({ ...prev, [tab]: { ...prev[tab], title: e.target.value } }))
                }
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">المحتوى</label>
              <textarea
                value={current.content}
                onChange={(e) =>
                  setPages((prev) => ({
                    ...prev,
                    [tab]: { ...prev[tab], content: e.target.value },
                  }))
                }
                rows={16}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                dir="rtl"
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={load}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-secondary text-secondary-foreground border border-border disabled:opacity-50 hover:bg-secondary/80 transition-smooth"
              >
                ↻ إعادة التحميل
              </button>
              <button
                onClick={save}
                disabled={saving || current.title.trim() === "" || current.content.trim() === ""}
                className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 active:scale-95 transition-smooth"
              >
                {saving ? "جارِ الحفظ…" : "حفظ التغييرات ✓"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-secondary/40 border border-border rounded-xl p-3 text-xs text-muted-foreground">
        💡 <span className="font-bold text-foreground">نصيحة:</span> استخدم سطرًا فارغًا بين
        الفقرات، واكتب «• » (نقطة متبوعة بمسافة) قبل كل عنصر في القوائم النقطية، و«1. » قبل العناصر
        المرقّمة.
      </div>
    </section>
  );
}
