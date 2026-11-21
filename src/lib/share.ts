/**
 * Sharing helpers — always share the PUBLISHED (production) URL so links work
 * for everyone, never the preview/dev URL used inside the editor.
 */
export const APP_URL = "https://marib-guide-hub.lovable.app";

export const APP_PROMO =
  "دليل مأرب التجاري والخدمي 🇾🇪 — بوابتك الأولى لاكتشاف المحلات والخدمات في مأرب.";

export const APP_SHARE_TEXT = `${APP_PROMO}\nتفضل بزيارة التطبيق: ${APP_URL}`;

export const shopUrl = (id: string) => `${APP_URL}/shop/${id}`;

/** Native share → clipboard → WhatsApp fallback. Returns how it was shared. */
export async function smartShare(opts: { title?: string; text: string; url?: string }) {
  const full = opts.url ? `${opts.text}\n${opts.url}` : opts.text;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return "native" as const;
    } catch {
      return "cancelled" as const;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(full);
      return "clipboard" as const;
    } catch { /* fall through */ }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, "_blank", "noopener");
  return "whatsapp" as const;
}

export const shareApp = () =>
  smartShare({ title: "دليل مأرب التجاري والخدمي", text: `${APP_PROMO}\nتفضل بزيارة التطبيق:`, url: APP_URL });