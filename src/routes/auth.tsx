import { ModalCloseButton } from "@/components/ModalCloseButton";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  checkExistingIdentity,
  registerWithPhone,
  requestPasswordReset,
} from "@/lib/password-reset.functions";
import {
  checkAuthRateLimit,
  recordAuthAttempt,
  isStrongPassword,
} from "@/lib/auth-security.functions";
import { toast } from "sonner";
import { SUPPORT_WHATSAPP } from "@/lib/support";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول — دليل مأرب الشامل" }],
  }),
  component: AuthPage,
});

// رقم واتساب إدارة التطبيق (لطلبات استعادة كلمة المرور)
// Normalize a Yemeni phone number to its local 9-digit form.
function normalizePhone(rawPhone: string): string {
  let p = rawPhone.replace(/[^\d]/g, "");
  if (p.startsWith("00967")) p = p.slice(5);
  else if (p.startsWith("967")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

// Phone numbers are the real identity; a synthetic email is generated behind the
// scenes so Supabase email/password auth can store the credentials (no SMS gateway).
function phoneToEmail(rawPhone: string): string {
  return `${normalizePhone(rawPhone)}@marib-dir.com`;
}

// Accounts created before the domain change still live under the legacy identifier.
function legacyPhoneToEmail(rawPhone: string): string {
  return `m${normalizePhone(rawPhone)}@marib.local`;
}

function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user with this email already exists") ||
    m.includes("email already") ||
    m.includes("duplicate") ||
    m.includes("already exists")
  );
}

function humanizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "رقم الجوال أو كلمة المرور غير صحيحة.";
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_email_send_rate_limit")
  )
    return "هناك محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.";
  if (isAlreadyRegisteredError(m)) return "هذا الرقم مسجّل مسبقاً. الرجاء تسجيل الدخول.";
  if (m.includes("email not confirmed"))
    return "تعذّر تفعيل الحساب تلقائياً، الرجاء المحاولة مرة أخرى.";
  if (m.includes("password")) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
  if (m.includes("تعذّر") || m.includes("تعذر")) return message;
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout"))
    return "تعذّر الاتصال بخدمة تسجيل الدخول. تحقق من الاتصال وحاول مجددًا.";
  return "حدث خطأ، الرجاء المحاولة مرة أخرى.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPw, setShowPw] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetPhone, setResetPhone] = useState("");
  const [resetName, setResetName] = useState("");

  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const runResetRequest = useServerFn(requestPasswordReset);
  const runIdentityCheck = useServerFn(checkExistingIdentity);
  const runPhoneRegistration = useServerFn(registerWithPhone);
  const runAuthLimit = useServerFn(checkAuthRateLimit);
  const runAuthAttempt = useServerFn(recordAuthAttempt);

  const sendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMsg(null);
    setResetErr(null);
    const digits = resetPhone.replace(/\D/g, "");
    if (digits.length < 8) {
      setResetErr("الرجاء إدخال رقم الجوال المسجّل.");
      return;
    }
    if (resetName.trim().length < 2) {
      setResetErr("الرجاء إدخال الاسم الكامل المسجّل مع الرقم.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await runResetRequest({
        data: { phone: resetPhone, fullName: resetName.trim().slice(0, 100) },
      });
      void res;
      // نفس الرسالة دائماً حتى لا يكشف النظام وجود الحساب من عدمه
      setResetMsg(
        "✅ تم استلام طلبك — الحالة: قيد المراجعة لدى الإدارة.\nإذا تطابقت البيانات، يصل إشعار أمني إلى الإدارة وحسابك داخل التطبيق. التواصل عبر واتساب يدوي؛ استخدم الزر أدناه وسيتحقق المشرف قبل تعيين كلمة مرور جديدة.",
      );
      setResetName("");
    } catch {
      setResetErr("تعذّر إرسال الطلب حالياً، حاول لاحقاً.");
    } finally {
      setResetLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      setError("الرجاء إدخال رقم جوال صحيح");
      return;
    }
    if (mode === "signup" && fullName.trim().length < 2) {
      setError("الرجاء إدخال الاسم الكامل");
      return;
    }
    if (mode === "signup" && !isStrongPassword(password)) {
      setError("كلمة المرور يجب أن تكون 12 حرفًا على الأقل وتشمل حروفًا وأرقامًا ورمزًا.");
      return;
    }
    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      const limit = await runAuthLimit({ data: { phone: normalizedPhone } });
      if (!limit.allowed) {
        setError("تم تجاوز عدد المحاولات المسموح به. انتظر 15 دقيقة ثم حاول مجددًا.");
        return;
      }

      const identifier = phoneToEmail(normalizedPhone);
      const legacy = legacyPhoneToEmail(normalizedPhone);

      const trySignIn = async () => {
        const currentResult = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });
        if (!currentResult.error) return currentResult;
        return supabase.auth.signInWithPassword({ email: legacy, password });
      };

      if (mode === "signup") {
        const existing = await runIdentityCheck({
          data: { phone: normalizedPhone, fullName: fullName.trim() },
        });
        if (existing?.exists) {
          if (!existing.nameMatches) {
            await runAuthAttempt({ data: { phone: normalizedPhone, success: false } });
            setError("تعذّر إكمال إنشاء الحساب بالبيانات المدخلة. تحقق من بياناتك أو سجّل الدخول.");
            return;
          }
          const signInRes = await trySignIn();
          if (!signInRes.error) {
            await runAuthAttempt({ data: { phone: normalizedPhone, success: true } });
            toast.success("هذا الحساب موجود، تم تسجيل الدخول ✅");
            navigate({ to: "/" });
            return;
          }
          setError("تعذّر تسجيل الدخول بهذه البيانات. تحقق من كلمة المرور أو اطلب استعادة الحساب.");
          await runAuthAttempt({ data: { phone: normalizedPhone, success: false } });
          return;
        }

        const registration = await runPhoneRegistration({
          data: { phone: normalizedPhone, fullName: fullName.trim(), password },
        });
        if (!registration.created) {
          if (!registration.nameMatches) {
            await runAuthAttempt({ data: { phone: normalizedPhone, success: false } });
            setError("تعذّر إكمال إنشاء الحساب بالبيانات المدخلة. تحقق من بياناتك أو سجّل الدخول.");
            return;
          }
          const signInRes = await trySignIn();
          if (!signInRes.error) {
            await runAuthAttempt({ data: { phone: normalizedPhone, success: true } });
            toast.success("هذا الحساب موجود، تم تسجيل الدخول ✅");
            navigate({ to: "/" });
            return;
          }
          setError("تعذّر تسجيل الدخول بهذه البيانات. تحقق من كلمة المرور أو اطلب استعادة الحساب.");
          await runAuthAttempt({ data: { phone: normalizedPhone, success: false } });
          return;
        }

        const signInRes = await trySignIn();
        if (signInRes.error) {
          await runAuthAttempt({ data: { phone: normalizedPhone, success: false } });
          setInfo("تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول برقم جوالك.");
          setMode("signin");
        } else {
          await runAuthAttempt({ data: { phone: normalizedPhone, success: true } });
          toast.success("تم إنشاء الحساب وتسجيل الدخول ✅");
          navigate({ to: "/" });
        }
      } else {
        const { error: siErr } = await trySignIn();
        if (siErr) {
          await runAuthAttempt({ data: { phone: normalizedPhone, success: false } });
          throw siErr;
        }
        await runAuthAttempt({ data: { phone: normalizedPhone, success: true } });
        toast.success("تم تسجيل الدخول ✅");
        navigate({ to: "/" });
      }
    } catch (err) {
      setError(humanizeAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  const forgotWaLink = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `مرحباً إدارة دليل مأرب،\nنسيت كلمة المرور لحسابي. رقم الجوال: ${phone || "(يرجى ذكره)"}\nأرجو المساعدة في إعادة تعيينها.`,
  )}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-elegant overflow-hidden">
        <div className="bg-hero text-primary-foreground p-6 text-center">
          <div className="text-4xl mb-2">🕌</div>
          <h1 className="text-2xl font-black">دليل مأرب الشامل</h1>
          <p className="text-sm opacity-85 mt-1">
            {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                الاسم الكامل
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: محمد أحمد الشعيبي"
                className="w-full bg-background border border-border rounded-xl p-2.5 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              رقم الجوال (يمني)
            </label>
            <div className="flex gap-2" dir="ltr">
              <span className="bg-secondary border border-border rounded-xl px-3 grid place-items-center text-sm font-bold text-foreground">
                +967
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="7XXXXXXXX"
                inputMode="numeric"
                className="flex-1 bg-background border border-border rounded-xl p-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="w-full bg-background border border-border rounded-xl p-2.5 pl-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center text-base"
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="mt-2 text-xs text-primary font-bold hover:underline"
              >
                هل نسيت كلمة المرور؟
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-emergency bg-emergency/10 border border-emergency/30 rounded-xl p-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded-xl p-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-3 font-bold shadow-gold disabled:opacity-50"
          >
            {loading ? "..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-sm text-primary font-bold"
          >
            {mode === "signin" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب؟ تسجيل الدخول"}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="w-full bg-secondary border border-border text-foreground rounded-xl py-2.5 font-bold text-sm hover:bg-accent transition-smooth"
          >
            ⏭️ تخطي وتصفح الدليل
          </button>

          <Link to="/" className="block text-center text-xs text-muted-foreground">
            ← الرجوع للرئيسية
          </Link>
        </form>
      </div>

      {/* استعادة كلمة المرور — نافذة مخصّصة (بدون prompts) */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card text-foreground rounded-2xl shadow-elegant overflow-hidden animate-fade-in-up max-h-[92dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-hero text-primary-foreground p-4 text-center relative">
              <div className="absolute top-2 left-2">
                <ModalCloseButton onClose={() => setForgotOpen(false)} />
              </div>
              <div className="text-3xl mb-1">🔑</div>
              <h3 className="font-black">استعادة كلمة المرور</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <form onSubmit={sendResetLink} className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">
                  رقم الجوال المسجّل
                </label>
                <div className="flex gap-2" dir="ltr">
                  <span className="bg-secondary border border-border rounded-xl px-3 grid place-items-center text-sm font-bold text-foreground">
                    +967
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    placeholder="7XXXXXXXX"
                    className="flex-1 bg-background border border-border rounded-xl p-2.5 text-sm"
                  />
                </div>
                <label className="block text-xs font-bold text-muted-foreground">
                  الاسم الكامل المسجّل
                </label>
                <input
                  type="text"
                  value={resetName}
                  maxLength={100}
                  onChange={(e) => setResetName(e.target.value)}
                  placeholder="اكتب اسمك الكامل كما هو مسجّل"
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-2.5 font-bold shadow-gold disabled:opacity-50"
                >
                  {resetLoading ? "..." : "📨 إرسال طلب الاستعادة للإدارة"}
                </button>
              </form>
              {resetMsg && (
                <p className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-xl p-2 leading-relaxed whitespace-pre-line">
                  {resetMsg}
                </p>
              )}
              {resetErr && (
                <p className="text-xs text-emergency bg-emergency/10 border border-emergency/30 rounded-xl p-2 leading-relaxed">
                  {resetErr}
                </p>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                للأمان: لا يمكن تعيين كلمة مرور جديدة مباشرة من هنا. بعد تطابق رقم الجوال مع الاسم
                الكامل يُرسَل طلبك إلى الإدارة، ويتواصل معك المشرف عبر واتساب للتحقق من هويتك قبل
                تعيين كلمة المرور الجديدة.
              </p>
              <a
                href={forgotWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#25D366] text-white rounded-xl py-2.5 font-bold shadow-soft"
              >
                💬 فتح واتساب الإدارة
              </a>
              <button
                onClick={() => setForgotOpen(false)}
                className="block w-full text-center bg-secondary border border-border rounded-xl py-2 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
