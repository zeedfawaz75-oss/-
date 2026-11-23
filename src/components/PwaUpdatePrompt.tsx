import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { activatePwaUpdate, PWA_UPDATE_EVENT } from "@/lib/pwa";

export function PwaUpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const show = () => setAvailable(true);
    window.addEventListener(PWA_UPDATE_EVENT, show);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, show);
  }, []);

  if (!available) return null;

  const update = async () => {
    setUpdating(true);
    const activated = await activatePwaUpdate();
    if (!activated) window.location.reload();
  };

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[190] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-gold/40 bg-card p-3 text-card-foreground shadow-elegant animate-fade-in-up"
      role="alert"
      aria-live="assertive"
      dir="rtl"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-gradient text-gold-foreground">
        <RefreshCw className={`h-5 w-5 ${updating ? "animate-spin" : ""}`} aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm font-bold">يوجد تحديث جديد، اضغط هنا للتحديث</p>
      <button
        type="button"
        onClick={update}
        disabled={updating}
        className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {updating ? "جارٍ التحديث…" : "تحديث الآن"}
      </button>
    </div>
  );
}
