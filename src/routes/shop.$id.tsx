import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchShopById,
  fetchShopBankDetails,
  isShopOpenNow,
  type Shop,
  type ShopBankDetails,
} from "@/lib/shops";
import { BOOKING_SECTORS, findSector, findSubsection } from "@/lib/directory-data";
import { BookingDialog } from "@/components/BookingDialog";
import { useFavorites } from "@/hooks/useFavorites";
import { useShopRating } from "@/hooks/useShopRating";
import { useStorageImage } from "@/hooks/useStorageImage";
import { ShopReviews } from "@/components/ShopReviews";
import { smartShare, shopUrl } from "@/lib/share";
import { toast } from "sonner";
import { notify } from "@/hooks/useNotifications";

export const Route = createFileRoute("/shop/$id")({
  head: () => ({
    meta: [
      { title: "ملف المحل — دليل مأرب" },
      { name: "description", content: "تفاصيل المحل والخدمات في محافظة مأرب." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [popHeart, setPopHeart] = useState(false);
  const [bank, setBank] = useState<ShopBankDetails | null>(null);
  const [imgOpen, setImgOpen] = useState(false);
  const imageSrc = useStorageImage(shop?.image_url);

  useEffect(() => {
    let cancelled = false;
    fetchShopBankDetails(id).then((d) => {
      if (!cancelled) setBank(d);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { isFav, toggle: toggleFav, needsAuth } = useFavorites();
  const { userRating, rate } = useShopRating(id);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchShopById(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) setNotFound(true);
        else setShop(data);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  if (notFound || !shop) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <div className="text-5xl mb-3">😕</div>
          <h1 className="text-lg font-black mb-2">المحل غير موجود</h1>
          <Link to="/" className="text-primary underline">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const fav = isFav(shop.id);
  const open = isShopOpenNow(shop);
  const isFeatured = (shop.rating ?? 0) >= 4.5;
  const hasPhone = !!shop.phone?.trim();
  const hasWa = !!(shop.whatsapp?.trim() || shop.phone?.trim());
  const waNumber = (shop.whatsapp || shop.phone || "").replace(/\D/g, "");
  const showBooking = BOOKING_SECTORS.has(shop.sector_id) && hasWa;
  const displayRating = userRating > 0 ? userRating : Math.round(shop.rating);
  const sector = findSector(shop.sector_id);
  const sub = findSubsection(shop.sector_id, shop.subsection_id);

  const mapHref =
    shop.map_url?.trim() ||
    (shop.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address + " مأرب")}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + " مأرب اليمن")}`);

  const shareText =
    `🏪 ${shop.name}\n${shop.description}\n📞 ${shop.phone}` +
    (shop.whatsapp ? `\n💬 ${shop.whatsapp}` : "") +
    (shop.address ? `\n📍 ${shop.address}` : "") +
    `\n\nمن دليل مأرب التجاري الخدمي الشامل`;

  const handleToggleFav = async () => {
    setPopHeart(true);
    setTimeout(() => setPopHeart(false), 300);
    const res = await toggleFav(shop.id);
    if (res && "needsAuth" in res && res.needsAuth)
      return toast.error("سجّل الدخول لإضافة المحل إلى المفضلة");
    notify(
      fav ? `أُزيل «${shop.name}» من المفضلة` : `أُضيف «${shop.name}» للمفضلة`,
      fav ? "💔" : "❤️",
    );
  };

  const handleShare = async () => {
    const res = await smartShare({ title: shop.name, text: shareText, url: shopUrl(shop.id) });
    if (res === "clipboard") toast.success("تم نسخ رابط المحل — الصقه في أي تطبيق للمشاركة");
  };

  const handleMessage = () => {
    if (!hasWa) return toast.error("لا يوجد رقم واتساب لهذا المحل");
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(`مرحباً، أنا مهتم بخدمات ${shop.name}.`)}`;
    window.open(url, "_blank", "noopener");
  };

  const handleRate = async (n: number) => {
    const res = await rate(n);
    if (res.needsAuth) return toast.error("سجّل الدخول لتقييم المحل");
    if (res.error) return toast.error(res.error);
    notify(`تم حفظ تقييمك: ${n} نجوم`, "⭐");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero image with heart top-left */}
      <div className="relative h-64 sm:h-80 bg-secondary overflow-hidden">
        {imgOpen && imageSrc && (
          <div
            className="fixed inset-0 z-[120] bg-black/90 grid place-items-center p-4"
            onClick={() => setImgOpen(false)}
            role="dialog"
            aria-label="معاينة الصورة"
          >
            <img
              src={imageSrc}
              alt={shop.name}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-elegant"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setImgOpen(false)}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/95 on-light grid place-items-center text-lg font-black"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        )}
        {imageSrc ? (
          <button
            type="button"
            onClick={() => setImgOpen(true)}
            className="block w-full h-full"
            aria-label="معاينة صورة المحل"
          >
            <img src={imageSrc} alt={shop.name} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

        {/* Back */}
        <button
          onClick={() => navigate({ to: "/" })}
          className="absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-full bg-white/90 backdrop-blur shadow-md on-light text-lg"
          aria-label="رجوع"
        >
          ›
        </button>

        {/* Heart top-left with pop animation */}
        <button
          onClick={handleToggleFav}
          aria-label={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          title={needsAuth ? "سجّل الدخول لحفظ المفضلة" : ""}
          className={`absolute top-3 left-3 w-11 h-11 grid place-items-center rounded-full backdrop-blur-sm shadow-lg transition-all duration-200 ${
            fav ? "bg-emergency text-white" : "bg-white/95 text-emergency"
          } ${popHeart ? "scale-125" : "scale-100"}`}
        >
          <span className="text-xl leading-none">{fav ? "❤" : "♡"}</span>
        </button>

        {/* Badges */}
        <div className="absolute bottom-3 right-3 flex gap-1.5 flex-wrap justify-end">
          <span
            className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full backdrop-blur-sm shadow ${
              open ? "bg-primary text-primary-foreground" : "bg-black/70 text-white"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${open ? "bg-white animate-pulse" : "bg-white/60"}`}
            />
            {open ? "مفتوح الآن" : "مغلق"}
          </span>
          {isFeatured && (
            <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-gold-gradient text-gold-foreground shadow">
              ⭐ مميّز
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 relative">
        <div className="bg-card rounded-2xl shadow-elegant border border-border p-5">
          <div className="flex items-start gap-3">
            {imageSrc && (
              <button
                type="button"
                onClick={() => setImgOpen(true)}
                className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border shadow-soft relative group"
                aria-label="تكبير صورة المحل"
                title="اضغط لتكبير الصورة"
              >
                <img
                  src={imageSrc}
                  alt={`صورة ${shop.name}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/40 text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍
                </span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black text-foreground leading-tight">{shop.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sector?.icon} {sector?.title} {sub ? `— ${sub.title}` : ""}
              </p>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-0.5" aria-label="تقييم">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleRate(n)}
                  className={`text-xl leading-none transition-transform hover:scale-110 ${
                    n <= displayRating ? "text-gold" : "text-muted-foreground/40"
                  }`}
                  aria-label={`تقييم ${n}`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="text-sm font-bold text-muted-foreground">
              {shop.rating.toFixed(1)} • {shop.visits} زيارة
            </span>
          </div>

          {shop.address && (
            <p className="mt-3 text-sm text-foreground flex items-center gap-1.5">
              <span>📍</span>
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {shop.address}
              </a>
            </p>
          )}
          {shop.opening_hours?.open && shop.opening_hours?.close && !shop.is_24_7 && (
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              🕒 {shop.opening_hours.open} — {shop.opening_hours.close}
            </p>
          )}

          {shop.description && (
            <p className="mt-4 text-sm text-foreground leading-relaxed whitespace-pre-line">
              {shop.description}
            </p>
          )}

          {shop.specialties?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {shop.specialties.map((t) => (
                <span
                  key={t}
                  className="text-xs font-bold bg-gold/15 text-foreground border border-gold/40 rounded-full px-3 py-1"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action rows — Rasina layout */}
        <div className="mt-4 space-y-2.5">
          {/* Row 1: WhatsApp (Green) + Call (Black) */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={hasWa ? `https://wa.me/${waNumber}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 font-black text-sm text-white transition-smooth ${
                hasWa ? "bg-[#25D366] hover:opacity-90" : "bg-muted cursor-not-allowed opacity-60"
              }`}
              aria-disabled={!hasWa}
            >
              💬 واتساب
            </a>
            <a
              href={hasPhone ? `tel:${shop.phone}` : undefined}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 font-black text-sm text-white transition-smooth ${
                hasPhone
                  ? "bg-foreground hover:opacity-90"
                  : "bg-muted cursor-not-allowed opacity-60"
              }`}
              style={hasPhone ? { color: "hsl(var(--background))" } : undefined}
              aria-disabled={!hasPhone}
            >
              📞 اتصال
            </a>
          </div>

          {/* Row 2: Share + Message (light) */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-xl py-3 font-black text-sm bg-secondary border border-border text-foreground hover:bg-accent transition-smooth"
            >
              ↗ مشاركة
            </button>
            <button
              onClick={handleMessage}
              className="inline-flex items-center justify-center gap-2 rounded-xl py-3 font-black text-sm bg-secondary border border-border text-foreground hover:bg-accent transition-smooth"
            >
              ✉️ رسالة
            </button>
          </div>

          {/* Row 3: Rate (Gold) */}
          <button
            onClick={() => handleRate(userRating >= 5 ? 5 : (userRating || 4) + 1)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-black text-sm bg-gold-gradient text-gold-foreground shadow-gold hover:opacity-95 transition-smooth"
          >
            ⭐ قيّم المحل
          </button>

          {/* Primary: Book Service — full-width orange gradient */}
          {showBooking && (
            <button
              onClick={() => setBookingOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-4 font-black text-base text-white shadow-elegant hover:opacity-95 transition-smooth"
              style={{ background: "linear-gradient(135deg,#ff8a00 0%,#e94e1b 100%)" }}
            >
              🗓️ احجز الخدمة الآن
            </button>
          )}
        </div>

        {/* Bank details */}
        {bank && (bank.bank_name || bank.bank_account_number) && (
          <div className="mt-4 bg-card rounded-2xl border border-gold/40 p-4 text-sm">
            <div className="font-black text-foreground mb-2">💳 بيانات الحساب البنكي</div>
            {bank.bank_name && (
              <div>
                <span className="text-muted-foreground">البنك: </span>
                <span className="font-bold">{bank.bank_name}</span>
              </div>
            )}
            {bank.bank_account_holder && (
              <div>
                <span className="text-muted-foreground">صاحب الحساب: </span>
                <span className="font-bold">{bank.bank_account_holder}</span>
              </div>
            )}
            {bank.bank_account_number && (
              <div
                dir="ltr"
                className="mt-2 font-mono bg-background border border-border rounded-lg p-2 text-center break-all"
              >
                {bank.bank_account_number}
              </div>
            )}
          </div>
        )}

        {/* Reviews & comments */}
        <ShopReviews shopId={shop.id} shopName={shop.name} />
      </div>

      <BookingDialog shop={shop} open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
}
