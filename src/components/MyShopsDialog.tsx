import { useEffect, useState } from "react";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { SECTORS } from "@/lib/directory-data";
import { fetchMyShops, updateOwnShop, type Shop } from "@/lib/shops";
import { validatePhone } from "@/lib/shop-validation";

interface Props {
  userId: string;
  onClose: () => void;
}

interface ShopEditForm {
  id: string;
  sector_id: string;
  subsection_id: string;
  name: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
}

const SHOP_STATUS: Record<Shop["status"], string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

function toEditForm(shop: Shop): ShopEditForm {
  return {
    id: shop.id,
    sector_id: shop.sector_id,
    subsection_id: shop.subsection_id,
    name: shop.name,
    description: shop.description,
    phone: shop.phone,
    whatsapp: shop.whatsapp ?? "",
    address: shop.address ?? "",
  };
}

export function MyShopsDialog({ userId, onClose }: Props) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShopEditForm | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyShops(userId)
      .then((rows) => {
        if (active) setShops(rows);
      })
      .catch(() => {
        if (active) setError("تعذّر تحميل محلاتك. تحقق من اتصالك ثم حاول مرة أخرى.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const saveShop = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    setNotice(null);

    if (editing.name.trim().length < 2) {
      setError("اسم المحل قصير جداً.");
      return;
    }
    if (!validatePhone(editing.phone).ok) {
      setError("رقم تواصل المحل غير صحيح.");
      return;
    }
    if (editing.whatsapp && !validatePhone(editing.whatsapp).ok) {
      setError("رقم واتساب غير صحيح.");
      return;
    }

    setSaving(true);
    try {
      await updateOwnShop(editing.id, {
        sector_id: editing.sector_id,
        subsection_id: editing.subsection_id,
        name: editing.name.trim(),
        description: editing.description.trim(),
        phone: editing.phone,
        whatsapp: editing.whatsapp.trim() || null,
        address: editing.address.trim() || null,
      });
      setNotice("تم حفظ بيانات المحل. تبقى حالة الاعتماد من صلاحية الإدارة فقط.");
      setEditing(null);
      try {
        setShops(await fetchMyShops(userId));
      } catch {
        setError("تم حفظ التعديل، لكن تعذّر تحديث القائمة. أعد فتح إدارة المحلات للمراجعة.");
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "تعذّر حفظ بيانات المحل. حاول مرة أخرى.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedSector = editing
    ? (SECTORS.find((sector) => sector.id === editing.sector_id) ?? SECTORS[0])
    : null;

  return (
    <div
      className="fixed inset-0 z-[135] grid place-items-center bg-black/50 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-shops-title"
        className="w-full max-w-xl max-h-[92dvh] overflow-y-auto overscroll-contain rounded-2xl bg-card text-foreground shadow-elegant"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between bg-hero p-4 text-primary-foreground">
          <h2 id="my-shops-title" className="font-black text-lg">
            إدارة محلاتي
          </h2>
          <ModalCloseButton onClose={onClose} />
        </header>

        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-6">
            يمكنك إضافة أكثر من محل، مع منع تكرار الاسم ورقم التواصل في القسم والنشاط نفسيهما،
            وتعديل بيانات محلاتك وأرقام التواصل. اعتماد المحل أو تغيير حالته والاطلاع على سجل
            التدقيق الإداري من صلاحيات المشرفين فقط.
          </div>

          {error && (
            <p
              className="rounded-xl border border-emergency/30 bg-emergency/10 p-3 text-sm text-emergency"
              role="alert"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"
              role="status"
            >
              {notice}
            </p>
          )}

          {editing ? (
            <form onSubmit={saveShop} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">تعديل بيانات «{editing.name}»</h3>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-xs font-bold text-muted-foreground"
                >
                  رجوع للمحلات
                </button>
              </div>

              <label className="block text-xs font-bold">
                القطاع
                <select
                  value={editing.sector_id}
                  onChange={(event) => {
                    const sector = SECTORS.find((item) => item.id === event.target.value);
                    setEditing((current) =>
                      current
                        ? {
                            ...current,
                            sector_id: event.target.value,
                            subsection_id: sector?.subsections[0]?.id ?? "",
                          }
                        : current,
                    );
                  }}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                >
                  {SECTORS.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.icon} {sector.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold">
                القسم الفرعي
                <select
                  value={editing.subsection_id}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, subsection_id: event.target.value } : current,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                >
                  {selectedSector?.subsections.map((subsection) => (
                    <option key={subsection.id} value={subsection.id}>
                      {subsection.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold">
                اسم المحل
                <input
                  value={editing.name}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  maxLength={100}
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                />
              </label>

              <label className="block text-xs font-bold">
                الوصف
                <textarea
                  value={editing.description}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold">
                  رقم التواصل
                  <input
                    value={editing.phone}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, phone: event.target.value } : current,
                      )
                    }
                    inputMode="tel"
                    dir="ltr"
                    required
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold">
                  واتساب
                  <input
                    value={editing.whatsapp}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, whatsapp: event.target.value } : current,
                      )
                    }
                    inputMode="tel"
                    dir="ltr"
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold">
                العنوان
                <input
                  value={editing.address}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, address: event.target.value } : current,
                    )
                  }
                  maxLength={200}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            </form>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground" role="status">
              جارٍ تحميل محلاتك...
            </p>
          ) : shops.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد محلات مسجلة على هذا الحساب حتى الآن.
            </p>
          ) : (
            <div className="space-y-2">
              {shops.map((shop) => (
                <article
                  key={shop.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <h3 className="font-bold">{shop.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SHOP_STATUS[shop.status]} · {shop.phone}
                    </p>
                    {shop.status === "rejected" && shop.rejection_reason && (
                      <p className="mt-1 text-xs text-emergency">
                        سبب الرفض: {shop.rejection_reason}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setEditing(toEditForm(shop));
                    }}
                    className="shrink-0 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-bold"
                  >
                    تعديل البيانات
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
