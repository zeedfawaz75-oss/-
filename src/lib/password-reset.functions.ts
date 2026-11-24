import { createServerFn } from "@tanstack/react-start";

/** Normalize a Yemeni phone number to its local 9-digit form. */
function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("00967")) p = p.slice(5);
  else if (p.startsWith("967")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

/** Normalize an Arabic full name for comparison (diacritics, alef forms, spacing). */
function normalizeName(raw: string): string {
  return String(raw ?? "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type RequestInput = { phone: string; fullName: string };

export const checkExistingIdentity = createServerFn({ method: "POST" })
  .validator((input: RequestInput) => {
    const phone = normalizePhone(String(input?.phone ?? ""));
    const fullName = String(input?.fullName ?? "")
      .trim()
      .slice(0, 100);
    if (phone.length < 8) throw new Error("رقم جوال غير صحيح");
    if (fullName.length < 2) throw new Error("الرجاء إدخال الاسم الكامل");
    return { phone, fullName };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wantName = normalizeName(data.fullName);

    for (let page = 1; page <= 10; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error("تعذّر التحقق من رقم الجوال حالياً. حاول مرة أخرى.");
      if (!list?.users?.length) break;

      for (const u of list.users) {
        const meta = (u.user_metadata ?? {}) as { phone?: string; full_name?: string };
        const metaPhone = normalizePhone(String(meta.phone ?? ""));
        const uPhone = normalizePhone(String(u.phone ?? ""));
        if (metaPhone !== data.phone && uPhone !== data.phone) continue;

        const storedName = String(meta.full_name ?? "").trim();
        return {
          exists: true as const,
          nameMatches: !!storedName && normalizeName(storedName) === wantName,
          userId: u.id,
          fullName: storedName,
        };
      }

      if (list.users.length < 200) break;
    }

    return { exists: false as const, nameMatches: false, userId: null, fullName: "" };
  });

type RegisterInput = { phone: string; fullName: string; password: string };

/** Create a phone account without sending confirmation email to its synthetic address. */
export const registerWithPhone = createServerFn({ method: "POST" })
  .validator((input: RegisterInput) => {
    const phone = normalizePhone(String(input?.phone ?? ""));
    const fullName = String(input?.fullName ?? "")
      .trim()
      .slice(0, 100);
    const password = String(input?.password ?? "");
    if (!/^7\d{8}$/.test(phone)) throw new Error("الرجاء إدخال رقم جوال يمني صحيح.");
    if (fullName.length < 2) throw new Error("الرجاء إدخال الاسم الكامل.");
    if (!isStrongPassword(password))
      throw new Error("كلمة المرور يجب أن تكون 12 حرفًا وتشمل حروفًا وأرقامًا ورمزًا على الأقل.");
    return { phone, fullName, password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wantName = normalizeName(data.fullName);

    for (let page = 1; page <= 10; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error("تعذّر التحقق من رقم الجوال حالياً. حاول مرة أخرى.");
      if (!list?.users?.length) break;

      for (const user of list.users) {
        const meta = (user.user_metadata ?? {}) as { phone?: string; full_name?: string };
        const storedPhone = normalizePhone(String(meta.phone ?? user.phone ?? ""));
        const email = String(user.email ?? "").toLowerCase();
        const sameSyntheticPhone =
          email === `${data.phone}@marib-dir.com` || email === `m${data.phone}@marib.local`;
        if (storedPhone !== data.phone && !sameSyntheticPhone) continue;

        const storedName = String(meta.full_name ?? "").trim();
        return {
          created: false as const,
          nameMatches: !!storedName && normalizeName(storedName) === wantName,
        };
      }

      if (list.users.length < 200) break;
    }

    const email = `${data.phone}@marib-dir.com`;
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });

    if (error) {
      if (/already|exists|duplicate/i.test(error.message)) {
        return { created: false as const, nameMatches: false };
      }
      throw new Error("تعذّر إنشاء الحساب حالياً. تحقق من البيانات وحاول مجدداً.");
    }

    return { created: true as const, nameMatches: true };
  });

/**
 * Public password-recovery REQUEST.
 *
 * Security: this endpoint never changes any password. A caller who proves
 * knowledge of the registered phone + full name pair only triggers a reset
 * request that is logged to the admins' activity feed; an administrator then
 * verifies the user out-of-band (WhatsApp) and sets a new password via the
 * admin-only `adminSetUserPassword` server function. This removes the
 * unauthenticated account-takeover path entirely.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((input: RequestInput) => {
    const phone = normalizePhone(String(input?.phone ?? ""));
    const fullName = String(input?.fullName ?? "")
      .trim()
      .slice(0, 100);
    if (phone.length < 8) throw new Error("رقم جوال غير صحيح");
    if (fullName.length < 2) throw new Error("الرجاء إدخال الاسم الكامل");
    return { phone, fullName };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wantName = normalizeName(data.fullName);

    // Verify the phone + name pair matches a real account (identity check only).
    let phoneMatch = false;
    let target: { id: string; name: string } | null = null;

    for (let page = 1; page <= 10 && !target; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error || !list?.users?.length) break;

      for (const u of list.users) {
        const meta = (u.user_metadata ?? {}) as { phone?: string; full_name?: string };
        const metaPhone = normalizePhone(String(meta.phone ?? ""));
        const uPhone = normalizePhone(String(u.phone ?? ""));
        if (metaPhone !== data.phone && uPhone !== data.phone) continue;
        phoneMatch = true;

        const storedName = String(meta.full_name ?? "").trim();
        if (storedName && normalizeName(storedName) === wantName) {
          target = { id: u.id, name: storedName };
          break;
        }
      }
      if (list.users.length < 200) break;
    }

    // Generic response: never reveal whether the phone exists or the name matched.
    if (!target) {
      void phoneMatch;
      return { ok: true as const };
    }

    // Log the request for admins — no credential change happens here.
    const requestedAt = new Date().toISOString();
    const when = new Date(requestedAt).toLocaleString("ar-YE");
    const alertText = `🔐 طلب استعادة كلمة مرور\nالجوال: ${data.phone}\nالاسم: ${target.name}\nالوقت: ${when}`;

    try {
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const rows = (admins ?? []).map((a) => ({
        user_id: a.user_id,
        type: "security",
        title: "🔐 طلب استعادة كلمة مرور",
        body: `الجوال: ${data.phone} — الاسم: ${target!.name} — الوقت: ${when} — يُرجى التواصل مع المستخدم عبر واتساب للتحقق ثم تعيين كلمة مرور جديدة من لوحة الإدارة.`,
      }));
      if (rows.length) await supabaseAdmin.from("notifications").insert(rows);

      // Notify the requesting account in-app.
      await supabaseAdmin.from("notifications").insert({
        user_id: target.id,
        type: "security",
        title: "تم إرسال طلب استعادة كلمة المرور 🔐",
        body: "تلقى المشرفون طلب الاستعادة. سيتواصلون معك عبر واتساب للتحقق قبل تغيير كلمة المرور.",
      });
    } catch {
      // auditing must never block the request flow
    }

    void alertText;
    void requestedAt;
    return { ok: true as const };
  });

function isStrongPassword(password: string): boolean {
  if (password.length < 12 || password.length > 72) return false;
  let classes = 0;
  if (/\p{Ll}/u.test(password)) classes++;
  if (/\p{Lu}/u.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^\p{L}\p{N}\s]/u.test(password)) classes++;
  return classes >= 3;
}
