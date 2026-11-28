import { useEffect, useState } from "react";
import { useBanners } from "@/hooks/useBanners";
import { SUPPORT_WHATSAPP } from "@/lib/support";

interface Ad {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  gradient: string;
  href?: string;
}

const ADS: Ad[] = [
  {
    id: "ad-1",
    title: "أعلن معنا في دليل مأرب",
    subtitle: "وصول مباشر لآلاف الزوار يومياً — مساحات إعلانية مميزة.",
    cta: "احجز مساحتك",
    image:
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=720&q=55",
    gradient: "linear-gradient(120deg, rgba(15,52,96,0.85), rgba(201,168,76,0.75))",
    href: `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("مرحباً، أرغب بالإعلان في دليل مأرب")}`,
  },
  {
    id: "ad-2",
    title: "خدمة توصيل سريعة داخل مأرب",
    subtitle: "اطلب من مطاعم ومحلات المحافظة ووصلها إلى بابك خلال دقائق.",
    cta: "تصفّح المطاعم",
    image:
      "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=720&q=55",
    gradient: "linear-gradient(120deg, rgba(22,33,62,0.85), rgba(15,52,96,0.75))",
  },
  {
    id: "ad-3",
    title: "محلك في الواجهة",
    subtitle: "سجّل محلك مجاناً وظهور مميّز في الأقسام الأكثر بحثاً.",
    cta: "اعرف المزيد",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=720&q=55",
    gradient: "linear-gradient(120deg, rgba(201,168,76,0.85), rgba(15,52,96,0.75))",
  },
];

export function AdsSlider() {
  const [i, setI] = useState(0);
  const { banners } = useBanners();

  const items: Ad[] = banners.length
    ? banners.map((b, idx) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle ?? "",
        cta: b.cta_label ?? "اعرف المزيد",
        image: b.image_url,
        gradient: ADS[idx % ADS.length].gradient,
        href: b.target_url ?? undefined,
      }))
    : ADS;

  useEffect(() => {
    setI(0);
  }, [banners.length]);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);

  const ad = items[i % items.length];
  if (!ad) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold">📢 إعلانات</h2>
        <span className="text-[10px] font-black bg-gold/20 text-gold rounded-full px-2 py-0.5 border border-gold/40">
          مموّل
        </span>
        <div className="flex-1 h-px bg-gold-gradient opacity-40" />
      </div>

      <a
        href={ad.href ?? "#"}
        target={ad.href ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="relative block h-40 sm:h-48 rounded-2xl overflow-hidden shadow-elegant group"
      >
        <img
          src={ad.image}
          alt={ad.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div aria-hidden className="absolute inset-0" style={{ background: ad.gradient }} />
        <div className="relative h-full flex flex-col justify-end p-5 text-white">
          <h3
            className="text-lg sm:text-xl font-black mb-1 drop-shadow"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
          >
            {ad.title}
          </h3>
          <p className="text-xs sm:text-sm text-white/90 mb-3 line-clamp-2 max-w-lg">
            {ad.subtitle}
          </p>
          <span className="self-start inline-flex items-center gap-1.5 bg-white text-foreground rounded-full px-3.5 py-1.5 text-xs font-black shadow-md">
            {ad.cta} <span>←</span>
          </span>
        </div>

        {/* Dots */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {items.map((a, idx) => (
            <button
              key={a.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setI(idx);
              }}
              aria-label={`إعلان ${idx + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === i ? "bg-white w-6" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </a>
    </section>
  );
}
