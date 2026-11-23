import { ModalCloseButton } from "@/components/ModalCloseButton";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { toastFail } from "@/lib/toast-ar";
import { supabase } from "@/integrations/supabase/client";
import { useAllBanners, type BannerRow } from "@/hooks/useBanners";

interface FormState {
  id: string | null;
  title: string;
  subtitle: string;
  image_url: string;
  cta_label: string;
  target_url: string;
  sort_order: number;
  is_active: boolean;
}

const empty: FormState = {
  id: null,
  title: "",
  subtitle: "",
  image_url: "",
  cta_label: "",
  target_url: "",
  sort_order: 0,
  is_active: true,
};

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function BannersManager() {
  const { banners, loading, reload } = useAllBanners();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const edit = (b: BannerRow) =>
    setForm({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      image_url: b.image_url,
      cta_label: b.cta_label ?? "",
      target_url: b.target_url ?? "",
      sort_order: b.sort_order,
      is_active: b.is_active,
    });

  const upload = async (file: File) => {
    if (!form) return;
    setUploading(true);
    try {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^\w.-]/g, "")}`;
      const { error } = await supabase.storage
        .from("banners")
        .upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      const { data, error: sErr } = await supabase.storage
        .from("banners")
        .createSignedUrl(path, TEN_YEARS);
      if (sErr || !data) throw new Error(sErr?.message ?? "تعذّر إنشاء رابط الصورة");
      setForm((f) => (f ? { ...f, image_url: data.signedUrl } : f));
      toast.success("تم رفع الصورة ✓");
    } catch (e) {
      toastFail(e, "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form) return;
    if (form.title.trim().length < 2) {
      toast.error("اكتب عنوان الإعلان");
      return;
    }
    if (!form.image_url.trim()) {
      toast.error("أضف صورة الإعلان");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      image_url: form.image_url.trim(),
      cta_label: form.cta_label.trim() || null,
      target_url: form.target_url.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    try {
      const { error } = form.id
        ? await supabase.from("banners").update(payload).eq("id", form.id)
        : await supabase.from("banners").insert(payload);
      if (error) throw new Error(error.message);
      toast.success(form.id ? "تم حفظ الإعلان ✓" : "تمت إضافة الإعلان ✓");
      setForm(null);
      await reload();
    } catch (e) {
      toastFail(e, "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: BannerRow) => {
    const { error } = await supabase
      .from("banners")
      .update({ is_active: !b.is_active })
      .eq("id", b.id);
    if (error) {
      toastFail(error);
      return;
    }
    await reload();
  };

  const remove = async (b: BannerRow) => {
    if (!confirm(`حذف الإعلان «${b.title}»؟`)) return;
    const { error } = await supabase.from("banners").delete().eq("id", b.id);
    if (error) {
      toastFail(error);
      return;
    }
    toast.success("تم حذف الإعلان 🗑");
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          تظهر الإعلانات المفعّلة في خانة الإعلانات بالصفحة الرئيسية.
        </p>
        <button
          onClick={() => setForm({ ...empty })}
          className="bg-primary text-primary-foreground rounded-xl px-3 py-1.5 text-sm font-bold"
        >
          + إعلان جديد
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">جارِ التحميل...</p>
      ) : banners.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">لا توجد إعلانات بعد.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {banners.map((b) => (
            <article
              key={b.id}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-soft"
            >
              <img
                src={b.image_url}
                alt={b.title}
                loading="lazy"
                className="w-full h-28 object-cover"
              />
              <div className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <h4 className="font-bold text-sm flex-1">{b.title}</h4>
                  <span
                    className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${b.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {b.is_active ? "مفعّل" : "متوقف"}
                  </span>
                </div>
                {b.subtitle && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{b.subtitle}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => edit(b)}
                    className="text-xs font-bold bg-secondary border border-border rounded-lg px-2.5 py-1"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => toggleActive(b)}
                    className="text-xs font-bold bg-secondary border border-border rounded-lg px-2.5 py-1"
                  >
                    {b.is_active ? "⏸ إيقاف" : "▶ تفعيل"}
                  </button>
                  <button
                    onClick={() => remove(b)}
                    className="text-xs font-bold bg-emergency text-emergency-foreground rounded-lg px-2.5 py-1"
                  >
                    🗑 حذف
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {form && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
          onClick={() => setForm(null)}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card text-foreground rounded-2xl shadow-elegant p-5 space-y-3 max-h-[92dvh] overflow-y-auto overscroll-contain"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black">{form.id ? "تعديل الإعلان" : "إعلان جديد"}</h3>
              <ModalCloseButton onClose={() => setForm(null)} />
            </div>

            {form.image_url && (
              <img
                src={form.image_url}
                alt="معاينة"
                className="w-full h-28 object-cover rounded-xl"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex-1 bg-secondary border border-border rounded-xl py-2 text-sm font-bold disabled:opacity-50"
              >
                {uploading ? "جارِ الرفع..." : "🖼 رفع صورة"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </div>
            <label className="block text-xs font-bold">
              أو رابط الصورة
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                dir="ltr"
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold">
              عنوان الإعلان
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold">
              وصف مختصر
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold">
              نص الزر
              <input
                value={form.cta_label}
                onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                placeholder="اعرف المزيد"
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold">
              الرابط المستهدف
              <input
                value={form.target_url}
                onChange={(e) => setForm({ ...form, target_url: e.target.value })}
                dir="ltr"
                placeholder="https://..."
                className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
              />
            </label>
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold flex-1">
                الترتيب
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-bold flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                مفعّل
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                disabled={saving}
                onClick={save}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
              >
                {saving ? "..." : "حفظ"}
              </button>
              <button
                onClick={() => setForm(null)}
                className="flex-1 bg-secondary border border-border rounded-xl py-2.5 font-bold text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
