import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { supabase } from "@/integrations/supabase/client";
import { changeAccountPhone } from "@/lib/account.functions";
import { isValidYemeniPhone, normalizePhone, phoneFromSyntheticEmail } from "@/lib/phone-auth";

interface Props {
  user: User;
  onClose: () => void;
  onManageShops: () => void;
  onLogout: () => void;
  onPhoneUpdated: (phone: string, user?: User | null) => void;
}

function getAccountPhone(user: User): string {
  const metadataPhone = user.user_metadata?.phone;
  if (typeof metadataPhone === "string" && metadataPhone) return metadataPhone;
  return phoneFromSyntheticEmail(user.email) ?? user.phone ?? "";
}

export function AccountSettingsDialog({
  user,
  onClose,
  onManageShops,
  onLogout,
  onPhoneUpdated,
}: Props) {
  const [phone, setPhone] = useState(getAccountPhone(user));
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const changePhone = useServerFn(changeAccountPhone);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedPhone = normalizePhone(phone);
    if (!isValidYemeniPhone(normalizedPhone)) {
      setError("أدخل رقم جوال يمني صحيحًا يبدأ بـ 7 ويتكون من 9 أرقام.");
      return;
    }
    if (!currentPassword) {
      setError("أدخل كلمة المرور الحالية لتأكيد التغيير.");
      return;
    }

    setSaving(true);
    try {
      const result = await changePhone({
        data: { currentPassword, phone: normalizedPhone },
      });
      setCurrentPassword("");
      let refreshedUser: User | null = null;
      let refreshFailed = false;
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        refreshedUser = data.session?.user ?? null;
        refreshFailed = !!refreshError;
      } catch {
        refreshFailed = true;
      }
      onPhoneUpdated(result.phone, refreshedUser);
      setNotice(
        refreshFailed
          ? "تم تحديث رقم الجوال، لكن تعذّر تحديث الجلسة الحالية. قد تحتاج إلى تسجيل الدخول مجددًا."
          : "تم تحديث رقم جوالك في حسابك بنجاح.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "تعذّر تحديث رقم الجوال. تحقق من بياناتك وحاول مرة أخرى.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-2xl bg-card text-foreground shadow-elegant"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <header className="flex items-center justify-between bg-hero p-4 text-primary-foreground">
          <h2 id="account-settings-title" className="font-black text-lg">
            إعدادات الحساب
          </h2>
          <ModalCloseButton onClose={onClose} />
        </header>

        <div className="space-y-4 p-4">
          <p className="text-xs leading-6 text-muted-foreground">
            تغيير رقم الحساب لا يغيّر أرقام التواصل المنشورة في محلاتك؛ يمكنك تعديلها من «إدارة
            محلاتي».
          </p>

          <form onSubmit={submit} className="space-y-3">
            <h3 className="font-bold">تغيير رقم الجوال</h3>
            <label className="block text-xs font-bold">
              رقم الجوال الجديد
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm"
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              أدخل الرقم المحلي مثل 7XXXXXXXX أو بصيغة +967 أو 00967.
            </p>
            <label className="block text-xs font-bold">
              كلمة المرور الحالية للتأكيد
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm"
              />
            </label>

            {error && (
              <p
                className="rounded-xl border border-emergency/30 bg-emergency/10 p-3 text-sm text-emergency"
                role="alert"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"
                role="status"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "جارٍ التحقق والحفظ..." : "تحديث رقم الجوال"}
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onManageShops}
              className="rounded-xl border border-border bg-secondary py-2.5 text-sm font-bold"
            >
              إدارة محلاتي
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-border py-2.5 text-sm font-bold text-emergency"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
