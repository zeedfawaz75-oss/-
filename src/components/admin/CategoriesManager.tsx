import { ModalCloseButton } from "@/components/ModalCloseButton";
import { useState } from "react";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, subRowId, type CategoryRow } from "@/hooks/useCategories";

interface FormState {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  description: string;
  keywords: string;
  sort_order: number;
  is_hidden: boolean;
  isNew: boolean;
}

const emptyForm = (parent: string | null): FormState => ({
  id: "",
  parent_id: parent,
  title: "",
  icon: "📌",
  description: "",
  keywords: "",
  sort_order: 0,
  is_hidden: false,
  isNew: true,
});

const slugify = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9\u0621-\u064A]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export function CategoriesManager() {
  const { rows, loading, reload } = useCategories();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const parents = rows.filter((r) => !r.parent_id);
  const childrenOf = (id: string) => rows.filter((r) => r.parent_id === id);

  const startEdit = (row: CategoryRow) =>
    setForm({
      id: row.id,
      parent_id: row.parent_id,
      title: row.title,
      icon: row.icon ?? "",
      description: row.description ?? "",
      keywords: (row.keywords ?? []).join("، "),
      sort_order: row.sort_order,
      is_hidden: row.is_hidden,
      isNew: false,
    });

  const save = async () => {
    if (!form) return;
    if (form.title.trim().length < 2) { toast.error("العنوان قصير جداً"); return; }
    setSaving(true);
    const keywords = form.keywords.split(/[،,\n]/).map((k) => k.trim()).filter(Boolean);
    const payload = {
      parent_id: form.parent_id,
      title: form.title.trim(),
      icon: form.parent_id ? null : form.icon.trim() || "📌",
      description: form.description.trim() || null,
      keywords,
      sort_order: Number(form.sort_order) || 0,
      is_hidden: form.is_hidden,
    };
    try {
      if (form.isNew) {
        const slug = slugify(form.id || form.title) || `cat-${Date.now()}`;
        const id = form.parent_id ? subRowId(form.parent_id, slug) : slug;
        const { error } = await supabase.from("categories").insert({ id, ...payload });
        if (error) throw new Error(error.message);
        toast.success("تمت إضافة القسم ✓");
      } else {
        const { error } = await supabase.from("categories").update(payload).eq("id", form.id);
        if (error) throw new Error(error.message);
        toast.success("تم حفظ التعديلات ✓");
      }
      setForm(null);
      await reload();
    } catch (e) {
      toastFail(e, "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: CategoryRow) => {
    if (!confirm(`حذف «${row.title}»${row.parent_id ? "" : " وجميع أقسامه الفرعية"}؟`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", row.id);
    if (error) { toastFail(error); return; }
    toast.success("تم الحذف 🗑");
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          التعديلات تظهر مباشرة في الصفحة الرئيسية للتطبيق.
        </p>
        <button
          onClick={() => setForm(emptyForm(null))}
          className="bg-primary text-primary-foreground rounded-xl px-3 py-1.5 text-sm font-bold"
        >
          + قطاع جديد
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جارِ التحميل...</p>}

      <div className="grid gap-3">
        {parents.map((p) => (
          <details key={p.id} className="bg-card border border-border rounded-2xl p-3 shadow-soft">
            <summary className="flex items-center gap-2 cursor-pointer font-bold">
              <span className="text-lg">{p.icon}</span>
              <span className="flex-1">{p.title}</span>
              {p.is_hidden && (
                <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">مخفي</span>
              )}
              <span className="text-xs text-muted-foreground">{childrenOf(p.id).length} قسم</span>
            </summary>

            <div className="flex gap-2 flex-wrap mt-3">
              <button onClick={() => startEdit(p)} className="text-xs font-bold bg-secondary border border-border rounded-lg px-2.5 py-1">✏️ تعديل</button>
              <button onClick={() => setForm(emptyForm(p.id))} className="text-xs font-bold bg-secondary border border-border rounded-lg px-2.5 py-1">+ قسم فرعي</button>
              <button onClick={() => remove(p)} className="text-xs font-bold bg-emergency text-emergency-foreground rounded-lg px-2.5 py-1">🗑 حذف</button>
            </div>

            <ul className="mt-3 divide-y divide-border">
              {childrenOf(p.id).map((c) => (
                <li key={c.id} className="py-2 flex items-center gap-2">
                  <span className="flex-1 text-sm">{c.title}</span>
                  <button onClick={() => startEdit(c)} className="text-xs bg-secondary border border-border rounded-lg px-2 py-0.5 font-bold">✏️</button>
                  <button onClick={() => remove(c)} className="text-xs bg-emergency text-emergency-foreground rounded-lg px-2 py-0.5 font-bold">🗑</button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain" onClick={() => setForm(null)}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card text-foreground rounded-2xl shadow-elegant p-5 space-y-3 max-h-[92dvh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black">
                {form.isNew ? (form.parent_id ? "قسم فرعي جديد" : "قطاع جديد") : "تعديل القسم"}
              </h3>
              <ModalCloseButton onClose={() => setForm(null)} />
            </div>
            <label className="block text-xs font-bold">العنوان
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal" />
            </label>
            {!form.parent_id && (
              <label className="block text-xs font-bold">الأيقونة (إيموجي)
                <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal" />
              </label>
            )}
            {form.parent_id && (
              <label className="block text-xs font-bold">الوصف
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal" />
              </label>
            )}
            <label className="block text-xs font-bold">كلمات البحث (افصلها بفاصلة)
              <textarea value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} rows={2} className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal" />
            </label>
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold flex-1">الترتيب
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal" />
              </label>
              {!form.parent_id && (
                <label className="text-xs font-bold flex items-center gap-2 mt-4">
                  <input type="checkbox" checked={form.is_hidden} onChange={(e) => setForm({ ...form, is_hidden: e.target.checked })} />
                  إخفاء من الرئيسية
                </label>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button disabled={saving} onClick={save} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 font-bold text-sm disabled:opacity-50">
                {saving ? "..." : "حفظ"}
              </button>
              <button onClick={() => setForm(null)} className="flex-1 bg-secondary border border-border rounded-xl py-2.5 font-bold text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}