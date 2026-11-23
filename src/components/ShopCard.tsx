import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { type Shop, isShopOpenNow } from "@/lib/shops";
import { BOOKING_SECTORS } from "@/lib/directory-data";
import { BookingDialog } from "./BookingDialog";
import { useFavorites } from "@/hooks/useFavorites";
import { useShopRating } from "@/hooks/useShopRating";
import { useStorageImage } from "@/hooks/useStorageImage";
import { notify } from "@/hooks/useNotifications";
import { smartShare, shopUrl } from "@/lib/share";
import { toast } from "sonner";

export function ShopCard({ shop, compact = false }: { shop: Shop; compact?: boolean }) {
  const hasPhone = !!shop.phone?.trim();
  const hasWa = !!(shop.whatsapp?.trim() || shop.phone?.trim());
  const waNumber = (shop.whatsapp || shop.phone || "").replace(/\D/g, "");
  const open = isShopOpenNow(shop);
  const isFeatured = (shop.rating ?? 0) >= 4.5;

  const { isFav, toggle: toggleFav, needsAuth } = useFavorites();
  const { userRating, rate } = useShopRating(shop.id);
  const imageSrc = useStorageImage(shop.image_url);
  const displayRating = userRating > 0 ? userRating : Math.round(shop.rating);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [popHeart, setPopHeart] = useState(false);

  const fav = isFav(shop.id);
  const showBooking = BOOKING_SECTORS.has(shop.sector_id) && hasWa;

  const shareText =
    `🏪 ${shop.name}\n${shop.description}\n📞 ${shop.phone}` +
    (shop.whatsapp ? `\n💬 ${shop.whatsapp}` : "") +
    (shop.address ? `\n📍 ${shop.address}` : "") +
    `\n\nمن دليل مأرب التجاري الخدمي الشامل`;

  const mapHref =
    shop.map_url?.trim() ||
    (shop.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address + " مأرب")}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + " مأرب اليمن")}`);

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPopHeart(true);
    setTimeout(() => setPopHeart(false), 300);
    const res = await toggleFav(shop.id);
    if (res && "needsAuth" in res && res.needsAuth) {
      toast.error("سجّل الدخول لإضافة المحل إلى المفضلة");
      return;
    }
    notify(
      fav ? `أُزيل «${shop.name}» من المفضلة` : `أُضيف «${shop.name}» للمفضلة`,
      fav ? "💔" : "❤️",
    );
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await smartShare({ title: shop.name, text: shareText, url: shopUrl(shop.id) });
    if (res === "clipboard") toast.success("تم نسخ رابط المحل — الصقه في أي تطبيق للمشاركة");
  };

  const handleRate = async (e: React.MouseEvent, n: number) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await rate(n);
    if (res.needsAuth) return toast.error("سجّل الدخول لتقييم المحل");
    if (res.error) return toast.error(res.error);
    notify(`تم حفظ تقييمك لـ ${shop.name}: ${n} نجوم`, "⭐");
  };

  return (
    <article className="group bg-card rounded-2xl overflow-hidden shadow-soft hover:shadow-elegant transition-smooth border border-border flex flex-col">
      <div className="relative h-40 sm:h-44 bg-secondary overflow-hidden">
        <Link
          to="/shop/$id"
          params={{ id: shop.id }}
          className="block absolute inset-0"
          aria-label={`فتح ${shop.name}`}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={shop.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-muted" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
        </Link>

        {/* Heart — absolute top-left with pop animation */}
        <button
          onClick={handleToggleFav}
          aria-label={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          title={
            needsAuth ? "سجّل الدخول لحفظ المفضلة" : fav ? "إزالة من المفضلة" : "إضافة للمفضلة"
          }
          className={`absolute top-2 left-2 w-9 h-9 grid place-items-center rounded-full backdrop-blur-sm shadow-md transition-all duration-200 ${
            fav ? "bg-emergency text-white" : "bg-white/90 text-emergency hover:bg-white"
          } ${popHeart ? "scale-125" : "scale-100"}`}
        >
          <span className="text-lg leading-none">{fav ? "❤" : "♡"}</span>
        </button>

        {/* Badges — top-right */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm ${
              open ? "bg-primary/95 text-primary-foreground" : "bg-black/60 text-white"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${open ? "bg-white animate-pulse" : "bg-white/60"}`}
            />
            {open ? "مفتوح الآن" : "مغلق"}
          </span>
          {isFeatured && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-gold-gradient text-gold-foreground shadow-sm">
              ⭐ مميّز
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <Link to="/shop/$id" params={{ id: shop.id }} className="block">
          <h3 className="font-black text-foreground leading-snug line-clamp-1">{shop.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {shop.specialties?.[0] || "خدمات متنوعة"}
          </p>
        </Link>

        {shop.is_24_7 && (
          <span className="mt-2 self-start text-[10px] font-black px-2 py-0.5 rounded-full bg-emergency text-emergency-foreground">
            مفتوح 24 ساعة
          </span>
        )}

        {/* Rating stars */}
        <div className="flex items-center gap-1 mt-2" aria-label="تقييم">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={(e) => handleRate(e, n)}
              className={`text-sm leading-none transition-transform ${
                n <= displayRating ? "text-gold" : "text-muted-foreground/40"
              } hover:scale-110`}
              aria-label={`تقييم ${n}`}
            >
              ★
            </button>
          ))}
          <span className="text-[11px] text-muted-foreground ms-1">{shop.rating.toFixed(1)}</span>
        </div>

        {shop.address && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">📍 {shop.address}</p>
        )}

        {!compact && shop.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-2">
            {shop.description}
          </p>
        )}

        {/* 3-button actions row */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
          {hasWa && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center justify-center gap-1 bg-[#25D366] text-white rounded-xl py-2 text-xs font-black hover:opacity-90 transition-smooth"
              aria-label="واتساب"
            >
              💬 واتساب
            </a>
          )}
          {hasPhone && (
            <a
              href={`tel:${shop.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center justify-center gap-1 bg-foreground text-background rounded-xl py-2 text-xs font-black hover:opacity-90 transition-smooth"
              aria-label="اتصال"
            >
              📞 اتصال
            </a>
          )}
          <button
            onClick={handleShare}
            className="w-10 grid place-items-center bg-secondary border border-border text-foreground rounded-xl hover:bg-accent transition-smooth"
            aria-label="مشاركة"
            title="مشاركة"
          >
            ↗
          </button>
        </div>

        {showBooking && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setBookingOpen(true);
            }}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black text-white shadow-gold hover:opacity-95 transition-smooth"
            style={{ background: "linear-gradient(135deg,#ff8a00,#e94e1b)" }}
          >
            🗓️ احجز الخدمة
          </button>
        )}
      </div>

      <BookingDialog shop={shop} open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </article>
  );
}
