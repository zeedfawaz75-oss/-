/** WhatsApp delivery helpers — same mechanism used by the password-reset flow. */

/** Normalize a Yemeni number to international wa.me form (967XXXXXXXXX). */
export function toWaNumber(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  let p = rawPhone.replace(/[^\d]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("967")) return p;
  if (p.startsWith("0")) p = p.slice(1);
  if (p.length < 8) return null;
  return `967${p}`;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const n = toWaNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Open WhatsApp with a ready message for the given phone. Returns false if the number is invalid. */
export function sendWaNotification(
  phone: string | null | undefined,
  title: string,
  body?: string,
): boolean {
  const text = `دليل مأرب الشامل\n\n${title}${body ? `\n${body}` : ""}`;
  const link = waLink(phone, text);
  if (!link) return false;
  if (typeof window !== "undefined") window.open(link, "_blank", "noopener");
  return true;
}
