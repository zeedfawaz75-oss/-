import { SECTORS, findSector, findSubsection } from "./directory-data";

// Normalize Arabic: remove diacritics, unify alef/ya/ta-marbuta, strip non-letters
export function normalizeArabic(s: string): string {
  return (s || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF\w\s]/g, " ")
    .toLowerCase()
    .trim();
}

export function fuzzyIncludes(haystack: string, needle: string): boolean {
  const h = normalizeArabic(haystack);
  const n = normalizeArabic(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  // token match: any token in needle present in haystack
  const tokens = n.split(/\s+/).filter((t) => t.length >= 2);
  return tokens.some((t) => h.includes(t));
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/** Count how many of a keyword list appear in the normalized text. */
function scoreKeywords(text: string, keywords: string[] | undefined): number {
  if (!keywords?.length) return 0;
  let hits = 0;
  for (const kw of keywords) {
    const k = normalizeArabic(kw);
    if (k.length >= 2 && text.includes(k)) hits++;
  }
  return hits;
}

export interface CategorySuggestion {
  sectorId: string;
  subsectionId: string;
  sectorTitle: string;
  subsectionTitle: string;
}

export interface CategoryAnalysis {
  /** ok = matches, mismatch = clearly belongs elsewhere, unclear = no signal at all */
  status: "ok" | "mismatch" | "unclear";
  message?: string;
  suggestion?: CategorySuggestion;
}

/**
 * Smart category check: scores the shop name + activity + specialties against
 * the keyword sets of every sector/subsection, then compares the chosen
 * category with the best match found elsewhere.
 */
export function analyzeCategoryMatch(
  sectorId: string,
  subsectionId: string,
  name: string,
  description: string,
  specialties: string[] = [],
): CategoryAnalysis {
  const sector = findSector(sectorId);
  const sub = findSubsection(sectorId, subsectionId);
  if (!sector || !sub) {
    return { status: "mismatch", message: "القسم المحدد غير صحيح — يرجى اختيار القطاع والقسم الفرعي." };
  }

  const text = normalizeArabic([name, description, ...specialties].join(" "));
  if (text.replace(/\s+/g, "").length < 3) {
    return { status: "unclear", message: "يرجى كتابة اسم المحل ووصف نشاطه أولاً." };
  }

  const chosenScore = scoreKeywords(text, sector.keywords) + scoreKeywords(text, sub.keywords) * 2;

  // Best matching category anywhere in the directory
  let best: { score: number; s: CategorySuggestion } | null = null;
  for (const s of SECTORS) {
    const sectorHits = scoreKeywords(text, s.keywords);
    for (const ss of s.subsections) {
      const score = sectorHits + scoreKeywords(text, ss.keywords) * 2;
      if (score > 0 && (!best || score > best.score)) {
        best = {
          score,
          s: {
            sectorId: s.id,
            subsectionId: ss.id,
            sectorTitle: s.title,
            subsectionTitle: ss.title,
          },
        };
      }
    }
  }

  if (chosenScore > 0) {
    // Chosen category has real signal → accept (even if another scores higher).
    return { status: "ok" };
  }

  if (best) {
    return {
      status: "mismatch",
      message:
        `نشاط المحل لا يتطابق مع «${sector.title} › ${sub.title}». ` +
        `يبدو أن القسم الأنسب هو «${best.s.sectorTitle} › ${best.s.subsectionTitle}». ` +
        `يرجى اختيار القسم الصحيح قبل الإرسال.`,
      suggestion: best.s,
    };
  }

  return {
    status: "unclear",
    message:
      `لم نتمكن من ربط وصف المحل بالقسم «${sub.title}». ` +
      `يرجى توضيح النشاط بكلمات دقيقة (مثال: ${(sub.keywords ?? sector.keywords).slice(0, 4).join("، ")}) أو اختيار القسم المناسب.`,
  };
}

export function validateCategoryMatch(
  sectorId: string,
  subsectionId: string,
  name: string,
  description: string,
  specialties: string[] = [],
): ValidationResult {
  const res = analyzeCategoryMatch(sectorId, subsectionId, name, description, specialties);
  if (res.status === "ok") return { ok: true };
  return { ok: false, reason: res.message };
}


export function validatePhone(phone: string): ValidationResult {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return { ok: false, reason: "رقم الهاتف غير صحيح." };
  }
  return { ok: true };
}
