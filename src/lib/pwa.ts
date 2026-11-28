// Guarded PWA service worker registration.
// - Never registers in dev, iframe previews, or with ?sw=off.
// - Uses the static /sw.js file in public/.
// - In any refused context, actively unregisters an existing /sw.js.

const APP_SW_PATH = "/sw.js";
export const PWA_UPDATE_EVENT = "marib:pwa-update-available";
const UPDATE_REQUESTED_KEY = "marib:pwa-update-requested";
const APP_CACHE_PATTERN =
  /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|^(html-pages|app-assets|images|supabase-data|supabase-images|gfonts-css|gfonts-files)$|^marib-/;

function isAppServiceWorker(registration: ServiceWorkerRegistration): boolean {
  const workers = [registration.active, registration.installing, registration.waiting];
  return workers.some((worker) => {
    if (!worker) return false;
    try {
      return new URL(worker.scriptURL).pathname === APP_SW_PATH;
    } catch {
      return false;
    }
  });
}

function waitForActivation(worker: ServiceWorker): Promise<void> {
  if (worker.state === "activated") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.removeEventListener("statechange", onStateChange);
      reject(new Error("انتهت مهلة تفعيل عامل التطبيق."));
    }, 10000);
    const onStateChange = () => {
      if (worker.state === "activated") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", onStateChange);
        resolve();
      } else if (worker.state === "redundant") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", onStateChange);
        reject(new Error("تعذّر تفعيل تحديث التطبيق."));
      }
    };
    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

export async function refreshAppAndClearCache(): Promise<void> {
  let updateError: unknown;
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      let registration = registrations.find(isAppServiceWorker);
      if (!registration) {
        registration = await navigator.serviceWorker.register(APP_SW_PATH, {
          scope: "/",
          updateViaCache: "none",
        });
      }

      await registration.update();
      const worker = registration.installing ?? registration.waiting;
      if (worker) {
        if (worker.state === "installed") {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
        await waitForActivation(worker);
      }
    } catch (error) {
      updateError = error;
    }
  } else {
    updateError = new Error("تحديث التطبيق غير مدعوم في هذا المتصفح.");
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => APP_CACHE_PATTERN.test(name))
        .map(async (name) => {
          if (!(await caches.delete(name))) {
            throw new Error(`تعذّر حذف ذاكرة التطبيق القديمة: ${name}`);
          }
        }),
    );
  }
  if (updateError) throw updateError;
}

function announceUpdate() {
  window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
}

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterApp() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (url.endsWith(APP_SW_PATH)) await r.unregister();
    }
  } catch {
    /* ignore */
  }
}

export async function activatePwaUpdate(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.waiting) return false;
  sessionStorage.setItem(UPDATE_REQUESTED_KEY, "1");
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export async function registerPwa(): Promise<(() => void) | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    await unregisterApp();
    return;
  }
  try {
    // Vite copies public/sw.js to the site root.
    const reg = await navigator.serviceWorker.register(APP_SW_PATH, {
      scope: "/",
      updateViaCache: "none",
    });
    if (reg.waiting) announceUpdate();

    const watchInstallingWorker = () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) announceUpdate();
      });
    };
    reg.addEventListener("updatefound", watchInstallingWorker);

    const checkForUpdate = () =>
      reg.update().catch(() => {
        /* offline */
      });
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    const onControllerChange = () => {
      if (sessionStorage.getItem(UPDATE_REQUESTED_KEY) !== "1") return;
      sessionStorage.removeItem(UPDATE_REQUESTED_KEY);
      window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    const timer = window.setInterval(checkForUpdate, 15 * 60 * 1000);

    await checkForUpdate();
    return () => {
      window.clearInterval(timer);
      reg.removeEventListener("updatefound", watchInstallingWorker);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }
}
