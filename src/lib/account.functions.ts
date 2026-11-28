import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSupabasePublicConfig } from "@/integrations/supabase/public-env";
import {
  isValidYemeniPhone,
  normalizePhone,
  phoneFromSyntheticEmail,
  phoneToEmail,
} from "@/lib/phone-auth";
import { z } from "zod";

const changePhoneSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  phone: z.string().trim().min(7).max(32),
});

export const changeAccountPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const data = changePhoneSchema.parse(input);
    const phone = normalizePhone(data.phone);
    if (!isValidYemeniPhone(phone)) {
      throw new Error("أدخل رقم جوال يمني صحيحًا يبدأ بـ 7 ويتكون من 9 أرقام.");
    }
    return { currentPassword: data.currentPassword, phone };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    const user = userResult.user;
    if (userError || !user) throw new Error("تعذّر التحقق من الحساب. حاول مرة أخرى.");

    const { url, publishableKey } = getSupabasePublicConfig();
    if (!url || !publishableKey) {
      throw new Error("تعذّر الاتصال بخدمة الحسابات. حاول مرة أخرى.");
    }

    const authClient = createClient(url, publishableKey, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const credentials = user.email
      ? { email: user.email, password: data.currentPassword }
      : user.phone
        ? { phone: user.phone, password: data.currentPassword }
        : null;
    if (!credentials) throw new Error("تعذّر التحقق من كلمة المرور لهذا الحساب.");

    const { data: verified, error: passwordError } =
      await authClient.auth.signInWithPassword(credentials);
    if (passwordError || verified.user?.id !== context.userId) {
      throw new Error("كلمة المرور الحالية غير صحيحة.");
    }

    const targetEmail = phoneToEmail(data.phone);
    const syntheticLoginPhone = phoneFromSyntheticEmail(user.email);
    if (!syntheticLoginPhone && user.phone) {
      throw new Error(
        "هذا الحساب يستخدم تسجيل الدخول المباشر برقم الهاتف، ويتطلب تغيير الرقم تحققًا برسالة SMS غير مفعّل حاليًا.",
      );
    }
    const targetIsCurrentPhone =
      normalizePhone(String((user.user_metadata as { phone?: unknown } | null)?.phone ?? "")) ===
        data.phone || syntheticLoginPhone === data.phone;
    if (targetIsCurrentPhone) return { phone: data.phone };

    for (let page = 1; ; page++) {
      const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listError) throw new Error("تعذّر التحقق من توفر رقم الجوال. حاول مرة أخرى.");

      for (const candidate of usersPage.users) {
        if (candidate.id === context.userId) continue;
        const metadata = candidate.user_metadata as { phone?: unknown } | null;
        const candidatePhones = [
          normalizePhone(String(metadata?.phone ?? "")),
          normalizePhone(String(candidate.phone ?? "")),
          phoneFromSyntheticEmail(candidate.email) ?? "",
        ];
        if (candidatePhones.includes(data.phone)) {
          throw new Error("رقم الجوال مستخدم بالفعل في حساب آخر.");
        }
      }

      if (usersPage.users.length < 200) break;
    }

    const attributes: {
      user_metadata: Record<string, unknown>;
      email?: string;
      email_confirm?: boolean;
    } = {
      user_metadata: {
        ...user.user_metadata,
        phone: data.phone,
      },
    };
    if (syntheticLoginPhone) {
      attributes.email = targetEmail;
      attributes.email_confirm = true;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      attributes,
    );
    if (updateError) {
      if (/already|exists|duplicate|email_exists/i.test(updateError.message)) {
        throw new Error("رقم الجوال مستخدم بالفعل في حساب آخر.");
      }
      console.error("[Account] Failed to update account phone:", updateError.code);
      throw new Error("تعذّر تحديث رقم الجوال. حاول مرة أخرى.");
    }

    return { phone: data.phone };
  });
