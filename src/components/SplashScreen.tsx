import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "marib:splash:seen";
const MIN_MS = 1400;

export function SplashScreen() {
  // Visible on the very first paint (server + client) so the home page can never
  // flash behind it. It only fades out after auth state is resolved.
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    // Repeat navigation within the same session → dismiss instantly, no flash.
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch { /* ignore */ }
    if (seen) {
      setShow(false);
      return;
    }

    const finish = () => {
      if (cancelled) return;
      const wait = Math.max(0, MIN_MS - (Date.now() - start));
      setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        setTimeout(() => {
          if (cancelled) return;
          try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
          setShow(false);
        }, 350);
      }, wait);
    };

    // Pre-authentication check: resolve the session BEFORE revealing the UI.
    const guard = setTimeout(finish, 4000); // never hang on a slow network
    supabase.auth
      .getSession()
      .then(finish)
      .catch(finish)
      .finally(() => clearTimeout(guard));

    return () => { cancelled = true; clearTimeout(guard); };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between p-8 text-center transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(201,168,76,0.18), transparent 55%), radial-gradient(circle at 85% 100%, rgba(232,213,170,0.22), transparent 55%), linear-gradient(160deg,#064e3b 0%,#0d7a5f 45%,#c9a84c 100%)",
      }}
    >
      {/* Subtle Yemeni arabesque overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 22px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 22px)",
        }}
      />

      <div className="relative pt-8 text-[#f5e7c4] text-xs tracking-widest opacity-80">
        دليل مأرب الخدمي الشامل
      </div>

      <div className="relative flex flex-col items-center gap-5">
        <img
          src="/logo-gold.png"
          alt="دليل مأرب"
          className="w-36 h-36 object-contain drop-shadow-2xl"
        />
        <h1
          className="text-2xl sm:text-3xl font-black drop-shadow"
          style={{ color: "#f7e3a8", fontFamily: "'Aref Ruqaa','Amiri',serif" }}
        >
          مرحباً بك في دليل مأرب الخدمي
        </h1>
        <p className="text-sm leading-relaxed max-w-md" style={{ color: "#fdf3d7" }}>
          دليل مأرب الخدمي الشامل: بوابتك الرقمية للوصول إلى كافة الخدمات والمحلات
          في محافظة مأرب بسهولة، سرعة، وأمان.
        </p>
        <div className="h-0.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg,transparent,#f7e3a8,transparent)" }} />
        <div className="flex gap-1.5 mt-1">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#f7e3a8" }} />
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#f7e3a8", animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#f7e3a8", animationDelay: "300ms" }} />
        </div>
      </div>

      <div
        className="relative text-[11px] leading-relaxed tracking-wide whitespace-nowrap"
        style={{ color: "#f5e7c4", opacity: 0.9 }}
      >
        © 2026 دليل مأرب الخدمي الشامل — جميع الحقوق محفوظة
      </div>
    </div>
  );
}
