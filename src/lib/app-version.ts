const UI_VERSION = "2.0";
const VERSION_KEY = "marib:ui-version";

// UI-only keys from previous releases. Account sessions, favorites, ratings,
// theme choice, and user data are intentionally preserved.
const LEGACY_UI_KEYS = [
  "marib_install_dismissed",
  "marib:pwa-installed",
  "marib:pwa-update-requested",
  "marib:announce:last",
];

export function migrateUiVersion() {
  if (typeof window === "undefined") return;

  try {
    if (window.localStorage.getItem(VERSION_KEY) === UI_VERSION) return;
    for (const key of LEGACY_UI_KEYS) window.localStorage.removeItem(key);
    window.localStorage.setItem(VERSION_KEY, UI_VERSION);
    window.sessionStorage.removeItem("marib:pwa-update-requested");
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}
