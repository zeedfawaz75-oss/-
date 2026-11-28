import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { type Sector } from "@/lib/directory-data";
import { useCategories } from "@/hooks/useCategories";
import {
  fetchApprovedShops,
  fetchShopsBySubsection,
  readCachedApprovedShops,
  type Shop,
} from "@/lib/shops";
import { fuzzyIncludes } from "@/lib/shop-validation";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@/components/SplashScreen";
import { HeaderActions } from "@/components/HeaderActions";
import { InstallButton } from "@/components/InstallButton";
import type { User } from "@supabase/supabase-js";

const ShopCard = lazy(() =>
  import("@/components/ShopCard").then((module) => ({ default: module.ShopCard })),
);
const ShopGrid = lazy(() =>
  import("@/components/ShopGrid").then((module) => ({ default: module.ShopGrid })),
);
const AdsSlider = lazy(() =>
  import("@/components/AdsSlider").then((module) => ({ default: module.AdsSlider })),
);
const AddShopDialog = lazy(() =>
  import("@/components/AddShopDialog").then((module) => ({ default: module.AddShopDialog })),
);

function ShopCardPlaceholder() {
  return <div aria-hidden className="h-64 rounded-2xl border border-border bg-card shadow-soft" />;
}

function AdsPlaceholder() {
  return (
    <section aria-hidden="true" className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold">📢 إعلانات</h2>
        <span className="rounded-full border border-gold/40 bg-gold/20 px-2 py-0.5 text-[10px] font-black text-gold">
          مموّل
        </span>
        <div className="h-px flex-1 bg-gold-gradient opacity-40" />
      </div>
      <div className="h-40 rounded-2xl bg-secondary sm:h-48" />
    </section>
  );
}

function DeferredAdsSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <Suspense fallback={<AdsPlaceholder />}>
          <AdsSlider />
        </Suspense>
      ) : (
        <AdsPlaceholder />
      )}
    </div>
  );
}

// Quick services — horizontal scroll strip on the home screen
const QUICK_SERVICES: {
  id: string;
  label: string;
  icon: string;
  sectorId: string;
  subId?: string;
}[] = [
  {
    id: "qs-emergency",
    label: "الطوارئ",
    icon: "🚑",
    sectorId: "emergency-health",
    subId: "emergency",
  },
  {
    id: "qs-pharmacy",
    label: "صيدليات",
    icon: "💊",
    sectorId: "emergency-health",
    subId: "clinics-pharmacies",
  },
  {
    id: "qs-hospitals",
    label: "مستشفيات",
    icon: "🏥",
    sectorId: "emergency-health",
    subId: "hospitals",
  },
  {
    id: "qs-restaurants",
    label: "مطاعم",
    icon: "🍽️",
    sectorId: "food-services",
    subId: "main-meals",
  },
  {
    id: "qs-fastfood",
    label: "وجبات سريعة",
    icon: "🍔",
    sectorId: "food-services",
    subId: "fast-food",
  },
  { id: "qs-bakery", label: "مخابز", icon: "🥖", sectorId: "food-services", subId: "bakeries" },
  { id: "qs-mechanic", label: "ميكانيك", icon: "🔧", sectorId: "cars", subId: "mechanic-elec" },
  { id: "qs-transport", label: "نقل وسفر", icon: "✈️", sectorId: "transport-travel" },
  { id: "qs-water", label: "وايت ماء", icon: "🚰", sectorId: "misc", subId: "water" },
  { id: "qs-delivery", label: "توصيل طلبات", icon: "🛵", sectorId: "misc", subId: "delivery" },
  { id: "qs-gas", label: "غاز ووقود", icon: "⛽", sectorId: "misc", subId: "other" },
  { id: "qs-banks", label: "بنوك وصرافة", icon: "🏦", sectorId: "finance", subId: "exchange" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "دليل مأرب التجاري الخدمي الشامل" },
      {
        name: "description",
        content:
          "دليل مأرب التجاري الخدمي الشامل: المنصة الرقمية الأولى لربط المواطنين بكافة الخدمات والمحلات في محافظة مأرب.",
      },
      { property: "og:title", content: "دليل مأرب التجاري الخدمي الشامل" },
      {
        property: "og:description",
        content: "كل القطاعات والمحلات والخدمات في محافظة مأرب بمكان واحد.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://images.unsplash.com" },
    ],
  }),
  component: DirectoryPage,
});

function DirectoryPage() {
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shops, setShops] = useState<Shop[]>(() => readCachedApprovedShops() ?? []);
  const [shopsLoadError, setShopsLoadError] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<{ sectorId?: string; subId?: string }>({});
  const { sectors: SECTORS_DB, visibleSectors: VISIBLE_SECTORS_DB } = useCategories();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (document.getElementById("marib-home-fonts")) return;
      const stylesheet = document.createElement("link");
      stylesheet.id = "marib-home-fonts";
      stylesheet.rel = "stylesheet";
      stylesheet.href =
        "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=Aref+Ruqaa:wght@700&display=swap";
      document.head.appendChild(stylesheet);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const activeSector = useMemo(
    () => SECTORS_DB.find((s) => s.id === activeSectorId) ?? null,
    [activeSectorId, SECTORS_DB],
  );

  // Load auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load shops
  const reloadShops = async () => {
    setShopsLoadError(false);
    try {
      const data = await fetchApprovedShops();
      setShops(data);
    } catch {
      setShopsLoadError(true);
    }
  };
  useEffect(() => {
    reloadShops();
  }, []);

  // Global search across sectors, subsections, keywords and descriptions
  const filteredSectors = useMemo(() => {
    const q = query.trim();
    if (!q) return VISIBLE_SECTORS_DB;
    return VISIBLE_SECTORS_DB.map((s) => {
      const sectorMatch =
        fuzzyIncludes(s.title, q) || (s.keywords ?? []).some((k) => fuzzyIncludes(k, q));
      const matchedSubs = s.subsections.filter(
        (sub) =>
          fuzzyIncludes(sub.title, q) ||
          (sub.description && fuzzyIncludes(sub.description, q)) ||
          (sub.keywords ?? []).some((k) => fuzzyIncludes(k, q)),
      );
      if (sectorMatch || matchedSubs.length > 0) {
        return { ...s, subsections: matchedSubs.length > 0 ? matchedSubs : s.subsections };
      }
      return null;
    }).filter(Boolean) as Sector[];
  }, [query, VISIBLE_SECTORS_DB]);

  // Global shop search — never scoped, matches names, activities, sectors and sections
  const searchedShops = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return shops.filter((s) => {
      const sector = SECTORS_DB.find((x) => x.id === s.sector_id);
      const sub = sector?.subsections.find((x) => x.id === s.subsection_id);
      const haystack = [
        s.name,
        s.description,
        s.address ?? "",
        ...(s.specialties ?? []),
        sector?.title ?? "",
        ...(sector?.keywords ?? []),
        sub?.title ?? "",
        sub?.description ?? "",
        ...(sub?.keywords ?? []),
      ].join(" ");
      return fuzzyIncludes(haystack, q);
    });
  }, [query, shops, SECTORS_DB]);

  const mostVisited = useMemo(
    () =>
      [...shops]
        .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0) || (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 6),
    [shops],
  );

  const [mounted, setMounted] = useState(false);
  const [mostVisitedOpen, setMostVisitedOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const scrollRef = useRef<HTMLElement | null>(null);

  const goHome = () => {
    setActiveSectorId(null);
    setActiveSubId(null);
    setQuery("");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpTo = (sectorId: string, subId?: string) => {
    setActiveSectorId(sectorId);
    setActiveSubId(subId ?? null);
    setQuery("");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAdd = (sectorId?: string, subId?: string) => {
    setAddPrefill({ sectorId, subId });
    setAddOpen(true);
  };

  return (
    <div className="min-h-screen">
      <SplashScreen />

      {/* Hero header + quick services — scroll naturally with the page */}
      <div>
        {/* Hero header with realistic Marib background image */}
        <header className="relative z-40 text-primary-foreground shadow-elegant">
          {/* Background image — Marib landscape (desert oasis / historic ruins) */}
          <img
            src="https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=960&h=540&q=55"
            srcSet="https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=640&h=360&q=55 640w, https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=960&h=540&q=55 960w, https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1280&h=720&q=55 1280w"
            sizes="100vw"
            alt="محافظة مأرب"
            className="absolute inset-0 w-full h-full object-cover"
            width={1280}
            height={720}
            loading="eager"
            fetchPriority="high"
          />
          {/* Brand-tinted overlay to keep contrast + preserve identity */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(15,52,96,0.88) 0%, rgba(22,33,62,0.82) 55%, rgba(15,52,96,0.9) 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-24"
            style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.35))" }}
          />

          <div className="relative max-w-6xl mx-auto px-4 py-4 sm:py-6">
            {/* Header action bar — unified glass toolbar */}
            <div className="mb-3">
              <HeaderActions />
            </div>

            <div className="mb-3 flex justify-center">
              <InstallButton />
            </div>

            <button
              onClick={goHome}
              className="block w-full text-center group transition-smooth"
              aria-label="العودة للرئيسية"
            >
              <div className="inline-flex items-center justify-center gap-3 mb-2">
                <span className="text-3xl sm:text-4xl">🕌</span>
                <h1 className="text-xl sm:text-3xl font-black tracking-tight">
                  دليل مأرب التجاري الخدمي الشامل
                </h1>
                <span className="text-3xl sm:text-4xl">🕌</span>
              </div>
              <div className="h-0.5 w-24 mx-auto bg-gold-gradient rounded-full mb-2" />
              <p className="text-sm sm:text-base text-primary-foreground/90 font-medium">
                بوابتك الأولى لاكتشاف محلات وخدمات المحافظة
              </p>
              <div className="mt-2 inline-flex items-center justify-center gap-2 text-xs sm:text-sm text-primary-foreground/85 bg-white/10 backdrop-blur rounded-full px-3 py-1 border border-white/15">
                <span aria-hidden>📍</span>
                <span className="font-bold">محافظة مأرب — اليمن</span>
                <span aria-hidden>🇾🇪</span>
              </div>
            </button>

            {/* Search */}
            <div className="mt-6 max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث عن أي شيء: محل، خدمة، قسم، أو نشاط..."
                  className="w-full rounded-2xl bg-card text-foreground placeholder:text-muted-foreground py-3 pr-12 pl-4 text-sm sm:text-base font-medium shadow-soft outline-none border border-border focus:ring-2 focus:ring-gold transition-smooth"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  🔍
                </span>
              </div>
              {query.trim() && (
                <p className="mt-2 text-xs text-primary-foreground/90 text-center">
                  🔎 بحث شامل في كل القطاعات والأقسام والمحلات
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Ads + quick services scroll normally with the page */}
        <div className="max-w-6xl mx-auto px-4 w-full">
          {!activeSector && !query.trim() && <DeferredAdsSlider />}

          {!query.trim() && !activeSector && (
            <section className="mt-4 mb-3 -mx-4 px-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base font-bold">⚡ خدمات سريعة</h2>
                <div className="flex-1 h-px bg-gold-gradient opacity-40" />
              </div>
              <div
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
                style={{ scrollbarWidth: "thin" }}
              >
                {QUICK_SERVICES.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => jumpTo(q.sectorId, q.subId)}
                    className="snap-start shrink-0 w-20 h-20 rounded-2xl bg-card border border-border shadow-soft hover:shadow-elegant transition-smooth flex flex-col items-center justify-center gap-1 p-2"
                  >
                    <span className="text-2xl">{q.icon}</span>
                    <span className="text-[10px] font-bold text-foreground text-center leading-tight">
                      {q.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <main
        ref={scrollRef}
        className="max-w-6xl w-full mx-auto px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]"
      >
        {shopsLoadError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            <p className="text-foreground">تعذّر تحديث قائمة المحلات. يمكنك المحاولة مجددًا.</p>
            <button
              type="button"
              onClick={() => void reloadShops()}
              className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Search results (shops) — visible when query active */}
        {query.trim() && searchedShops.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-3">
              نتائج المحلات <span className="text-gold">({searchedShops.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchedShops.map((s) => (
                <Suspense key={s.id} fallback={<ShopCardPlaceholder />}>
                  <ShopCard shop={s} />
                </Suspense>
              ))}
            </div>
          </section>
        )}

        {/* Friendly empty-state when nothing matches the query anywhere */}
        {query.trim() && searchedShops.length === 0 && filteredSectors.length === 0 && (
          <section className="mb-8 bg-card rounded-2xl p-8 text-center shadow-soft border border-border">
            <div className="text-4xl mb-2">🔎</div>
            <p className="text-foreground font-bold mb-1">عذراً، لم يتم العثور على نتائج.</p>
            <p className="text-sm text-muted-foreground">
              حاول البحث عن اسم القطاع أو القسم أو المحل.
            </p>
          </section>
        )}

        {!query.trim() && activeSector && activeSubId ? (
          <SubsectionShopsView
            sector={activeSector}
            subId={activeSubId}
            onBack={() => setActiveSubId(null)}
            onAdd={() => openAdd(activeSector.id, activeSubId)}
          />
        ) : !query.trim() && activeSector ? (
          <SubSectionsView
            sector={activeSector}
            onBack={goHome}
            onPick={(subId) => setActiveSubId(subId)}
            onAdd={(subId) => openAdd(activeSector.id, subId)}
          />
        ) : (
          <>
            {/* General services — big banner */}
            {!query.trim() && (
              <section className="mb-8">
                <button
                  onClick={() => jumpTo("misc")}
                  className="w-full text-right rounded-2xl overflow-hidden shadow-elegant relative p-6 sm:p-7"
                  style={{
                    background: "linear-gradient(135deg,#0f3460 0%,#16213e 50%,#c9a84c 110%)",
                  }}
                >
                  <span className="absolute -left-4 -bottom-6 text-[9rem] opacity-15 select-none">
                    💼
                  </span>
                  <div className="relative">
                    <span className="inline-block text-[10px] font-black bg-white/20 backdrop-blur text-white rounded-full px-2.5 py-1 border border-white/25 mb-3">
                      جديد
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight mb-2">
                      الخدمات العامة في مأرب
                    </h3>
                    <p className="text-sm text-white/90 leading-relaxed mb-4 max-w-xl">
                      توصيل طلبات، وايتات ماء، مغاسل قات وكل الخدمات اليومية في مكان واحد.
                    </p>
                    <span className="inline-flex items-center gap-2 bg-white on-light rounded-full px-4 py-2 text-sm font-black shadow-md">
                      تصفح الآن <span>←</span>
                    </span>
                  </div>
                </button>
              </section>
            )}

            <SectorsView
              sectors={filteredSectors}
              onSelect={(id) => {
                setActiveSectorId(id);
                setActiveSubId(null);
                setQuery("");
                scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              query={query}
            />

            {/* Most Visited — directly under the sectors grid on home */}
            {!query.trim() && (
              <section className="mt-10 mb-8 animate-fade-in-up">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setMostVisitedOpen((v) => !v)}
                    aria-expanded={mostVisitedOpen}
                    aria-controls="most-visited-panel"
                    className="inline-flex items-center gap-2 rounded-2xl bg-card border border-border shadow-soft px-4 py-2 text-lg sm:text-xl font-bold text-foreground hover:bg-accent transition-smooth"
                  >
                    <span>⭐ الأكثر زيارة</span>
                    {mounted && mostVisited.length > 0 && (
                      <span className="text-gold">({mostVisited.length})</span>
                    )}
                    <span
                      aria-hidden
                      className={`text-sm text-muted-foreground transition-transform duration-300 ${mostVisitedOpen ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>
                  <div className="flex-1 h-px bg-gold-gradient opacity-50" />
                </div>
                <div
                  id="most-visited-panel"
                  className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    mostVisitedOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    {mostVisitedOpen && (
                      <Suspense
                        fallback={
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                            <ShopCardPlaceholder />
                            <ShopCardPlaceholder />
                            <ShopCardPlaceholder />
                          </div>
                        }
                      >
                        <ShopGrid
                          shops={mounted ? mostVisited : []}
                          emptyLabel="لا توجد محلات معتمدة بعد — كن أول من يُسجل محله."
                        />
                      </Suspense>
                    )}
                    {mostVisitedOpen && (
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          onClick={() => setMostVisitedOpen(false)}
                          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-smooth"
                        >
                          إخفاء القائمة ▴
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-16 px-4 max-w-3xl mx-auto text-center space-y-4">
        <div className="h-px max-w-xs mx-auto bg-gold-gradient opacity-60" />
        <p className="text-sm text-foreground/80 leading-relaxed">
          <span className="font-bold text-primary">دليل مأرب التجاري الخدمي الشامل:</span> المنصة
          الرقمية الشاملة والأولى لربط المواطنين بكافة الخدمات والمحلات في محافظة مأرب التاريخية
          بسهولة، سرعة، وأمان.
        </p>
        <div className="inline-flex flex-col items-center gap-1 bg-card-gradient arabesque-border rounded-2xl px-5 py-3 shadow-soft">
          <span className="text-[10px] text-muted-foreground tracking-widest">تطوير وإشراف</span>
          <span
            className="text-xl text-primary"
            style={{ fontFamily: "'Aref Ruqaa','Amiri',serif", fontWeight: 700 }}
          >
            فواز المصرعي
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed tracking-wide">
          © 2026 دليل مأرب الخدمي الشامل — جميع الحقوق محفوظة
        </p>
      </footer>

      {/* Add-shop FAB removed from home per product decision — accessible via subsection views and admin. */}

      {addOpen && (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-[120] grid place-items-center bg-background/70 text-sm font-bold"
              role="status"
            >
              جارٍ تحميل نموذج إضافة المحل...
            </div>
          }
        >
          <AddShopDialog
            open={addOpen}
            onClose={() => setAddOpen(false)}
            initialSectorId={addPrefill.sectorId}
            initialSubsectionId={addPrefill.subId}
            onCreated={reloadShops}
          />
        </Suspense>
      )}
    </div>
  );
}

// High-quality topical photos from Unsplash (free hotlinking).
// Each background sets the mood for a sector; bold overlay keeps text readable.
const SECTOR_IMAGES: Record<string, string> = {
  electronics:
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=640&q=55",
  construction:
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=640&q=55",
  finance:
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=640&q=55",
  workshops:
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=640&q=55",
  "food-trade":
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=640&q=55",
  fashion:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=640&q=55",
  "emergency-health":
    "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=640&q=55",
  "education-training":
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=640&q=55",
  sports:
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=640&q=55",
  beauty:
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=640&q=55",
  cars: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=640&q=55",
  hospitality:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=640&q=55",
  "food-services":
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=640&q=55",
  // الحراج والأسواق الشعبية — سوق تقليدي مفتوح
  haraj:
    "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=640&q=55",
  // الزراعة والثروة الحيوانية — حقول ومحاصيل
  "agri-vet":
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=640&q=55",
  // النقل والسفر — طائرة/طريق
  "transport-travel":
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=640&q=55",
  // خدمات عامة ومتنوعة — عمّال خدمات
  misc: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=640&q=55",
};

function SectorsView({
  sectors,
  onSelect,
  query,
}: {
  sectors: Sector[];
  onSelect: (id: string) => void;
  query: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          القطاعات العامة <span className="text-gold mr-2">({sectors.length})</span>
        </h2>
        {query && <span className="text-xs text-muted-foreground">نتائج البحث عن: «{query}»</span>}
      </div>

      {sectors.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center shadow-soft">
          <p className="text-muted-foreground">لا توجد نتائج مطابقة لبحثك.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sectors.map((sector, i) => {
            const preview = sector.subsections
              .slice(0, 3)
              .map((s) => s.title.split("،")[0].split("(")[0].trim())
              .join(" • ");
            const image =
              SECTOR_IMAGES[sector.id] ??
              "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=640&q=55";
            return (
              <button
                key={sector.id}
                onClick={() => onSelect(sector.id)}
                className="group relative text-right rounded-2xl overflow-hidden shadow-elegant hover:shadow-2xl hover:-translate-y-0.5 transition-smooth animate-fade-in-up h-44 sm:h-52"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Background image */}
                <img
                  src={image}
                  alt={sector.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Dark overlay for readability */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.85) 100%)",
                  }}
                />

                {/* Top badge */}
                <span className="absolute top-3 left-3 text-[10px] font-black bg-white/95 on-light rounded-full px-2.5 py-1 shadow">
                  {sector.subsections.length} قسم
                </span>

                {/* Text content */}
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3
                    className="font-black text-xl sm:text-2xl leading-tight mb-1.5 drop-shadow-lg"
                    style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
                  >
                    {sector.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/90 font-medium line-clamp-1 mb-3">
                    {preview}
                  </p>
                  <span className="inline-flex items-center gap-1.5 bg-white/95 on-light rounded-full px-3 py-1.5 text-xs font-black shadow-md">
                    تصفح القطاع <span>←</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SubSectionsView({
  sector,
  onBack,
  onPick,
  onAdd,
}: {
  sector: Sector;
  onBack: () => void;
  onPick: (subId: string) => void;
  onAdd: (subId: string) => void;
}) {
  return (
    <section className="animate-scale-in">
      <div className="flex items-center justify-between mb-5 gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 bg-card border border-border text-primary font-bold rounded-xl px-4 py-2.5 shadow-soft hover:shadow-elegant hover:bg-accent transition-smooth"
        >
          <span>🔙</span>
          <span className="text-sm">عودة للقطاعات</span>
        </button>
        <span className="text-xs text-muted-foreground hidden sm:block">
          {sector.subsections.length} قسم تخصصي
        </span>
      </div>

      <div className="bg-hero text-primary-foreground rounded-2xl p-5 sm:p-6 shadow-elegant mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold-gradient grid place-items-center text-3xl shadow-gold">
            {sector.icon}
          </div>
          <div className="flex-1">
            <p className="text-xs text-primary-foreground/75 mb-1">القطاع المختار</p>
            <h2 className="text-base sm:text-xl font-black leading-snug">{sector.title}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sector.subsections.map((sub, i) => (
          <article
            key={sub.id}
            className="bg-card rounded-2xl p-5 shadow-soft hover:shadow-elegant hover:-translate-y-0.5 transition-smooth animate-fade-in-up border border-border"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-1 w-2 h-10 rounded-full bg-gold-gradient" />
              <div className="flex-1">
                <h3 className="font-bold text-foreground leading-snug">{sub.title}</h3>
                {sub.description && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {sub.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onPick(sub.id)}
                    className="text-xs bg-primary text-primary-foreground rounded-full px-3 py-1.5 font-bold"
                  >
                    عرض المحلات →
                  </button>
                  <button
                    onClick={() => onAdd(sub.id)}
                    className="text-xs bg-gold-gradient text-gold-foreground rounded-full px-3 py-1.5 font-bold"
                  >
                    + أضف محلك في هذا القسم
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SubsectionShopsView({
  sector,
  subId,
  onBack,
  onAdd,
}: {
  sector: Sector;
  subId: string;
  onBack: () => void;
  onAdd: () => void;
}) {
  const sub = sector.subsections.find((s) => s.id === subId);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchShopsBySubsection(sector.id, subId)
      .then((data) => {
        if (!cancelled) setShops(data);
      })
      .catch(() => {
        if (!cancelled) {
          setShops([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sector.id, subId, retryAttempt]);

  return (
    <section className="animate-scale-in">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 bg-card border border-border text-primary font-bold rounded-xl px-4 py-2.5 shadow-soft"
        >
          <span>🔙</span>
          <span className="text-sm">عودة للأقسام</span>
        </button>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 bg-gold-gradient text-gold-foreground font-bold rounded-xl px-4 py-2.5 shadow-gold"
        >
          + أضف محلك في هذا القسم
        </button>
      </div>

      <div className="bg-hero text-primary-foreground rounded-2xl p-5 shadow-elegant mb-6">
        <p className="text-xs opacity-75 mb-1">
          {sector.icon} {sector.title}
        </p>
        <h2 className="text-lg sm:text-xl font-black">{sub?.title}</h2>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
      ) : loadError ? (
        <div
          role="alert"
          className="bg-card rounded-2xl p-8 text-center shadow-soft border border-border"
        >
          <p className="text-foreground mb-4">تعذّر تحميل محلات هذا القسم.</p>
          <button
            type="button"
            onClick={() => setRetryAttempt((attempt) => attempt + 1)}
            className="bg-primary text-primary-foreground rounded-xl px-5 py-2 font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-soft border border-border">
          <p className="text-muted-foreground mb-4">لا توجد محلات معتمدة في هذا القسم حتى الآن.</p>
          <button
            onClick={onAdd}
            className="bg-gold-gradient text-gold-foreground rounded-xl px-5 py-2 font-bold"
          >
            + كن أول من يُسجل محلاً
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shops.map((s) => (
            <Suspense key={s.id} fallback={<ShopCardPlaceholder />}>
              <ShopCard shop={s} />
            </Suspense>
          ))}
        </div>
      )}
    </section>
  );
}
