import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور — دليل مأرب" },
      { name: "description", content: "أنشئ كلمة مرور جديدة لحسابك في دليل مأرب التجاري والخدمي." },
      { property: "og:title", content: "إعادة تعيين كلمة المرور — دليل مأرب" },
      { property: "og:description", content: "أنشئ كلمة مرور جديدة لحسابك في دليل مأرب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // رابط الاستعادة ينشئ جلسة مؤقتة عند فتحه
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (upErr) {
      setError("تعذّر تحديث كلمة المرور. قد يكون الرابط منتهي الصلاحية، أعد طلب رابط جديد.");
      return;
    }
    toast.success("تم تحديث كلمة المرور ✅");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-elegant overflow-hidden">
        <div className="bg-hero text-primary-foreground p-6 text-center">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-2xl font-black">تعيين كلمة مرور جديدة</h1>
        </div>

        {!ready ? (
          <div className="p-6 text-sm text-muted-foreground text-center space-y-3">
            <p>افتح هذه الصفحة من رابط إعادة التعيين المُرسل إلى بريدك الإلكتروني.</p>
            <Link to="/auth" className="block text-primary font-bold">← العودة لتسجيل الدخول</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">كلمة المرور الجديدة</label>
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
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">تأكيد كلمة المرور</label>
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                dir="ltr"
                className="w-full bg-background border border-border rounded-xl p-2.5 text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-emergency bg-emergency/10 border border-emergency/30 rounded-xl p-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-gradient text-gold-foreground rounded-xl py-3 font-bold shadow-gold disabled:opacity-50"
            >
              {loading ? "..." : "حفظ كلمة المرور"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}