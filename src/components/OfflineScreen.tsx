import { useEffect, useState } from "react";

/**
 * Full-screen offline notice with the golden brand emblem.
 * Cached pages keep working; this only shows when the network drops.
 */
export function OfflineScreen() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 p-8 text-center"
      style={{ background: "linear-gradient(160deg,#0b1220 0%,#0f2436 60%,#132b3f 100%)" }}
      role="alertdialog"
      aria-live="assertive"
    >
      <img
        src="/logo-gold.png"
        alt="دليل مأرب"
        className="w-40 h-40 object-contain drop-shadow-2xl animate-fade-in-up"
      />
      <h2 className="text-xl font-black" style={{ color: "#f7e3a8" }}>
        لا يتوفر اتصال بالإنترنت
      </h2>
      <p className="text-sm max-w-sm leading-relaxed" style={{ color: "#e6ecf5" }}>
        يمكنك تصفح المحلات التي زرتها سابقاً من الذاكرة المؤقتة، وسيتم تحديث البيانات تلقائياً فور
        عودة الاتصال.
      </p>
      <button
        onClick={() => setOffline(!navigator.onLine)}
        className="rounded-xl px-6 py-2 font-bold bg-gold-gradient text-gold-foreground"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
