import { toast } from "sonner";

/**
 * Arabic-only user messaging.
 * Any raw system/Supabase error is translated to a clear Arabic sentence so the
 * user never sees English technical text.
 */

const RULES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "رقم الجوال أو كلمة المرور غير صحيحة"],
  [/already registered|already been registered|user already exists/i, "هذا الحساب مسجّل مسبقاً"],
  [/email not confirmed/i, "لم يتم تفعيل الحساب بعد"],
  [
    /password should be at least|password.*at least.*characters|weak password/i,
    "كلمة المرور قصيرة — استخدم 6 أحرف على الأقل",
  ],
  [/password/i, "هناك مشكلة في كلمة المرور، الرجاء المحاولة مرة أخرى"],
  [/rate limit|too many requests/i, "محاولات كثيرة، الرجاء الانتظار قليلاً ثم إعادة المحاولة"],
  [
    /jwt|unauthorized|401|not authenticated|auth session missing/i,
    "انتهت الجلسة، الرجاء تسجيل الدخول من جديد",
  ],
  [
    /permission denied|forbidden|403|row-level security|violates row-level/i,
    "لا تملك صلاحية لتنفيذ هذه العملية",
  ],
  [/duplicate key|already exists|unique constraint/i, "هذا العنصر موجود مسبقاً"],
  [/foreign key/i, "لا يمكن تنفيذ العملية لارتباط هذا العنصر ببيانات أخرى"],
  [/not found|404|no rows/i, "لم يتم العثور على البيانات المطلوبة"],
  [/payload too large|file size|exceeded the maximum/i, "حجم الملف كبير جداً"],
  [
    /network|fetch failed|failed to fetch|timeout|offline/i,
    "تعذّر الاتصال بالإنترنت، تحقّق من الشبكة وحاول مجدداً",
  ],
  [
    /invalid input|invalid value|violates check constraint|validation/i,
    "بيانات غير صحيحة، الرجاء مراجعة الحقول",
  ],
];

/** Convert any error (or English text) into a clear Arabic message. */
export function arabicError(err: unknown, fallback = "حدث خطأ، الرجاء المحاولة مرة أخرى"): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return fallback;
  // Already Arabic → show as-is
  if (/[\u0600-\u06FF]/.test(raw)) return raw;
  for (const [re, ar] of RULES) if (re.test(raw)) return ar;
  return fallback;
}

/** Green success toast. */
export function toastOk(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

/** Red error toast — always Arabic. */
export function toastFail(err: unknown, fallback?: string) {
  toast.error(arabicError(err, fallback ?? "حدث خطأ، الرجاء المحاولة مرة أخرى"));
}

/** Red warning-style toast (warnings and security notices share the red tone). */
export function toastWarn(message: string) {
  toast.error(message);
}
