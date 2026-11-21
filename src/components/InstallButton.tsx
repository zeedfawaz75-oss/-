import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "marib:pwa-installed";

/** Elegant gold install pill for the header — hides itself once installed. */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(INSTALLED_KEY) === "1") {
      setInstalled(true);
      return;
    }
    const ua = window.navigator.userAgent;
    setIos(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setReady(true);
    };
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
      setJustInstalled(true);
      setTimeout(() => setInstalled(true), 2500);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!ready && !ios && !justInstalled) return null;

  if (justInstalled) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-gold-gradient text-gold-foreground px-3.5 py-2 text-xs font-black shadow-gold animate-scale-in">
        <span aria-hidden>✓</span> تم تثبيت التطبيق
      </span>
    );
  }

  const onClick = async () => {
    if (ios) {
      alert("لتثبيت التطبيق على iPhone: اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية».");
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
      setJustInstalled(true);
      setTimeout(() => setInstalled(true), 2500);
    }
    setDeferred(null);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="تثبيت التطبيق"
      className="inline-flex items-center gap-2 rounded-full bg-gold-gradient text-gold-foreground px-3.5 py-2 text-xs sm:text-sm font-black shadow-gold hover:opacity-90 active:scale-95 transition-smooth"
    >
      <img src="/logo-gold.png" alt="" aria-hidden className="h-5 w-5 rounded-md object-contain" />
      <span>تثبيت التطبيق</span>
      <span aria-hidden>⤓</span>
    </button>
  );
}
