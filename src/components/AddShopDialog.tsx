import { ModalCloseButton } from "@/components/ModalCloseButton";
import { useEffect, useMemo, useState } from "react";
import { SECTORS, findSector, TWENTY_FOUR_SEVEN_SECTORS } from "@/lib/directory-data";
import { analyzeCategoryMatch, validatePhone } from "@/lib/shop-validation";
import { createShop, uploadShopImage } from "@/lib/shops";
import { compressImage } from "@/lib/image-compress";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { notifyAdminNewShop } from "@/lib/shops.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  initialSectorId?: string;
  initialSubsectionId?: string;
  onCreated?: () => void;
}

export function AddShopDialog({
  open,
  onClose,
  initialSectorId,
  initialSubsectionId,
  onCreated,
}: Props) {
  const navigate = useNavigate();
  const [sectorId, setSectorId] = useState(initialSectorId ?? SECTORS[0].id);
  const [subId, setSubId] = useState(initialSubsectionId ?? SECTORS[0].subsections[0].id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [is247, setIs247] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mapUrl, setMapUrl] = useState<string>("");
  const [openTime, setOpenTime] = useState<string>("08:00");
  const [closeTime, setCloseTime] = useState<string>("22:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const notifyAdmin = useServerFn(notifyAdminNewShop);

  const sector = useMemo(() => findSector(sectorId), [sectorId]);
  const show247 = TWENTY_FOUR_SEVEN_SECTORS.has(sectorId);

  // Live smart category analysis (name + description + specialties vs chosen sector)
  const categoryCheck = useMemo(() => {
    const pending = specialtyInput.trim();
    const all = pending ? [...specialties, pending] : specialties;
    if (!name.trim() && !description.trim() && all.length === 0) return null;
    return analyzeCategoryMatch(sectorId, subId, name, description, all);
  }, [sectorId, subId, name, description, specialties, specialtyInput]);

  useEffect(() => {
    if (initialSectorId) setSectorId(initialSectorId);
    if (initialSubsectionId) setSubId(initialSubsectionId);
  }, [initialSectorId, initialSubsectionId, open]);

  useEffect(() => {
    if (sector && !sector.subsections.find((s) => s.id === subId)) {
      setSubId(sector.subsections[0].id);
    }
  }, [sector, subId]);

  if (!open) return null;

  const addSpecialty = (raw: string) => {
    const parts = raw
      .split(/[,،]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setSpecialties((prev) => {
      const next = [...prev];
      for (const p of parts) if (!next.includes(p) && next.length < 8) next.push(p);
      return next;
    });
    setSpecialtyInput("");
  };

  const removeSpecialty = (t: string) => setSpecialties((prev) => prev.filter((x) => x !== t));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) return setError(phoneCheck.reason!);
    if (!name.trim() || !description.trim()) return setError("يرجى تعبئة الاسم والوصف.");
    if (!imageUrl)
      return setError("صورة المحل إجبارية لإتمام التسجيل — يرجى إرفاق صورة اللوحة أو واجهة المحل.");

    // Commit any pending typed specialty before requiring at least one
    const finalSpecialties = [...specialties];
    const pending = specialtyInput.trim();
    if (pending) {
      for (const p of pending
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (!finalSpecialties.includes(p)) finalSpecialties.push(p);
      }
    }
    if (finalSpecialties.length === 0) {
      return setError("يرجى إضافة تخصص واحد على الأقل (مثلاً: صيانة، بيع، تفصيل).");
    }

    const cat = analyzeCategoryMatch(sectorId, subId, name, description, finalSpecialties);
    if (cat.status !== "ok") return setError("⚠️ عدم تطابق التصنيف: " + cat.message);

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNeedsAuth(true);
        setSubmitting(false);
        return;
      }
      const shopId = await createShop(
        {
          sector_id: sectorId,
          subsection_id: subId,
          name: name.trim(),
          description: description.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          address: address.trim(),
          bank_name: bankName.trim(),
          bank_account_holder: bankHolder.trim(),
          bank_account_number: bankAccount.trim(),
          specialties: finalSpecialties,
          is_24_7: show247 ? is247 : false,
          image_url: imageUrl,
          map_url: mapUrl,
          opening_hours: show247 && is247 ? null : { open: openTime, close: closeTime },
        },
        user.id,
      );
      if (shopId) {
        await notifyAdmin({ data: { shopId } }).catch((err) =>
          console.error("[ShopRequest] Failed to notify administrators.", err),
        );
      }
      setSuccess(true);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain shadow-elegant relative z-[1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-hero text-primary-foreground p-4 flex items-center justify-between">
          <h2 className="font-black text-lg">+ أضف محلك</h2>
          <ModalCloseButton onClose={onClose} />
        </div>

        {success ? (
          <div className="p-6 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h3 className="font-bold text-lg">تم إرسال طلبك</h3>
            <p className="text-sm text-muted-foreground">
              سيتم مراجعة محلك من قبل إدارة الدليل قبل النشر. شكراً لمساهمتك.
            </p>
            <button
              onClick={onClose}
              className="bg-primary text-primary-foreground rounded-xl px-6 py-2 font-bold"
            >
              إغلاق
            </button>
          </div>
        ) : needsAuth ? (
          <div className="p-6 text-center space-y-4">
            <div className="text-5xl">🔐</div>
            <h3 className="font-bold">يلزم تسجيل الدخول</h3>
            <p className="text-sm text-muted-foreground">
              يجب إنشاء حساب أو تسجيل الدخول لإضافة محلك.
            </p>
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="bg-gold-gradient text-gold-foreground rounded-xl px-6 py-2 font-bold"
            >
              تسجيل الدخول / إنشاء حساب
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-6">
              يمكنك إضافة أكثر من محل، ويُمنع تكرار الاسم ورقم التواصل في القسم والنشاط نفسيهما.
              يمكنك تعديل بيانات محلاتك وأرقام التواصل من «إدارة محلاتي»؛ اعتماد المحل أو تغيير
              حالته والاطلاع على سجل التدقيق الإداري صلاحيات للمشرفين فقط.
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">القطاع</label>
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              >
                {SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                القسم الفرعي
              </label>
              <select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              >
                {sector?.subsections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                اسم المحل *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              />
            </div>

            {/* Specialties (tags) — appears as soon as a sector is chosen */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                تخصص النشاط *{" "}
                <span className="font-normal opacity-70">
                  (اكتب التخصص ثم Enter — مثلاً: صيانة، بيع، تفصيل)
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {specialties.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 bg-gold/15 text-foreground border border-gold/40 rounded-full px-2 py-0.5 text-xs font-bold"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeSpecialty(t)}
                      className="text-emergency hover:opacity-70"
                      aria-label="حذف"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === "،") {
                    e.preventDefault();
                    addSpecialty(specialtyInput);
                  }
                }}
                onBlur={() => specialtyInput.trim() && addSpecialty(specialtyInput)}
                placeholder="اكتب التخصص واضغط Enter"
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                وصف المحل / الخدمة *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={500}
                rows={3}
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              />
            </div>

            {show247 && (
              <label className="flex items-center justify-between bg-secondary/50 border border-border rounded-xl p-3 cursor-pointer">
                <span className="text-sm font-bold">🕒 خدمة 24 ساعة</span>
                <input
                  type="checkbox"
                  checked={is247}
                  onChange={(e) => setIs247(e.target.checked)}
                  className="w-5 h-5 accent-emergency"
                />
              </label>
            )}

            {!(show247 && is247) && (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  ساعات العمل
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] text-muted-foreground mb-1">الفتح</span>
                    <input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      dir="ltr"
                      className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground mb-1">الإغلاق</span>
                    <input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      dir="ltr"
                      className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  رقم الهاتف *
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">واتساب</label>
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  dir="ltr"
                  className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">العنوان</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={200}
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              />
            </div>

            {/* Shop image — uploaded to Supabase Storage (shops-images bucket) */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                صورة المحل *{" "}
                <span className="font-normal opacity-70">
                  (إجبارية — صورة اللوحة أو واجهة المحل)
                </span>
              </label>
              {imageUrl && (
                <div className="mb-2 relative">
                  <img
                    src={imageUrl}
                    alt="معاينة"
                    loading="lazy"
                    className="w-full h-32 object-cover rounded-xl border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-1 left-1 bg-emergency text-emergency-foreground rounded-full w-7 h-7 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    setError("الملف المرفق ليس صورة صالحة.");
                    e.target.value = "";
                    return;
                  }
                  if (file.size > 12 * 1024 * 1024) {
                    setError("حجم الصورة كبير جداً — يرجى اختيار صورة أصغر من 12MB.");
                    e.target.value = "";
                    return;
                  }
                  setError(null);
                  setSubmitting(true);
                  setUploadingImage(true);
                  try {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) {
                      setNeedsAuth(true);
                      return;
                    }
                    const optimized = await compressImage(file);
                    const url = await uploadShopImage(optimized, user.id);
                    setImageUrl(url);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "تعذّر رفع الصورة");
                  } finally {
                    setSubmitting(false);
                    setUploadingImage(false);
                    e.target.value = "";
                  }
                }}
                className="w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-gold-gradient file:text-gold-foreground file:px-3 file:py-1.5 file:font-bold disabled:opacity-50"
              />
              {uploadingImage && (
                <p className="text-[11px] text-muted-foreground mt-1">جارٍ ضغط ورفع الصورة…</p>
              )}
              <p className="text-[11px] text-emergency font-bold mt-1">
                تنبيه: يجب أن تطابق الصورة واجهة المحل أو لافتته ونشاطه الفعلي، وسيتم رفض أي طلب
                بصورة غير مطابقة.
              </p>
              {!imageUrl && !uploadingImage && (
                <p className="text-[11px] text-emergency font-bold mt-1">
                  ⚠️ صورة المحل إجبارية لإتمام التسجيل.
                </p>
              )}
            </div>

            {/* Google Maps link */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                رابط الموقع على خرائط جوجل <span className="font-normal opacity-70">(اختياري)</span>
              </label>
              <input
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                dir="ltr"
                className="w-full bg-background border border-border rounded-xl p-2 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                انسخ رابط الموقع من تطبيق خرائط جوجل وألصقه هنا.
              </p>
            </div>

            <details className="bg-secondary/30 border border-border rounded-xl p-3">
              <summary className="cursor-pointer text-sm font-bold flex items-center gap-2">
                💳 بيانات الحساب البنكي{" "}
                <span className="text-[10px] font-normal text-muted-foreground">(اختياري)</span>
              </summary>
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    اسم البنك
                  </label>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    maxLength={80}
                    className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    اسم صاحب الحساب
                  </label>
                  <input
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    maxLength={120}
                    className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    رقم الحساب / الآيبان
                  </label>
                  <input
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    dir="ltr"
                    maxLength={64}
                    className="w-full bg-background border border-border rounded-xl p-2 text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  🔒 هذه البيانات اختيارية، تُعرض للزبائن لتسهيل التحويل.
                </p>
              </div>
            </details>

            {/* Smart category validation — live alert */}
            {categoryCheck && categoryCheck.status !== "ok" && (
              <div
                className={
                  "text-sm rounded-xl p-3 space-y-2 border " +
                  (categoryCheck.status === "mismatch"
                    ? "bg-emergency/10 border-emergency/30 text-emergency"
                    : "bg-gold/10 border-gold/40 text-foreground")
                }
              >
                <p className="font-bold">
                  {categoryCheck.status === "mismatch"
                    ? "⚠️ عدم تطابق التصنيف"
                    : "ℹ️ تحقق من القسم"}
                </p>
                <p className="text-xs leading-relaxed">{categoryCheck.message}</p>
                {categoryCheck.suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setSectorId(categoryCheck.suggestion!.sectorId);
                      setSubId(categoryCheck.suggestion!.subsectionId);
                    }}
                    className="bg-gold-gradient text-gold-foreground rounded-lg px-3 py-1.5 text-xs font-bold"
                  >
                    انقل إلى «{categoryCheck.suggestion.sectorTitle} ›{" "}
                    {categoryCheck.suggestion.subsectionTitle}»
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="bg-emergency/10 border border-emergency/30 text-emergency text-sm rounded-xl p-3">
                {error}
              </div>
            )}

            <div className="bg-secondary/50 border border-border rounded-xl p-3 text-xs text-muted-foreground">
              ℹ️ جميع الإضافات تُراجع من قبل الإدارة قبل النشر.
            </div>

            <button
              type="submit"
              disabled={submitting || !imageUrl || categoryCheck?.status === "mismatch"}
              aria-disabled={submitting || !imageUrl || categoryCheck?.status === "mismatch"}
              title={!imageUrl ? "صورة المحل إجبارية لإتمام التسجيل" : undefined}
              className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-3 font-bold shadow-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "جارٍ الإرسال..."
                : categoryCheck?.status === "mismatch"
                  ? "اختر القسم المناسب لنشاطك"
                  : !imageUrl
                    ? "أرفق صورة المحل أولاً"
                    : "إرسال للمراجعة"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
