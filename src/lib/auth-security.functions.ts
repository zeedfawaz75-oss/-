import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("00967")) phone = phone.slice(5);
  else if (phone.startsWith("967")) phone = phone.slice(3);
  if (phone.startsWith("0")) phone = phone.slice(1);
  return phone;
}

export function isStrongPassword(password: string): boolean {
  if (password.length < 12 || password.length > 72) return false;
  let classes = 0;
  if (/\p{Ll}/u.test(password)) classes++;
  if (/\p{Lu}/u.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^\p{L}\p{N}\s]/u.test(password)) classes++;
  return classes >= 3;
}

const phoneSchema = z.object({ phone: z.string().min(8).max(25) });

export const checkAuthRateLimit = createServerFn({ method: "POST" })
  .validator((d: unknown) => phoneSchema.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 8) {
      return { allowed: false as const, retryAfterSeconds: 60 };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { error: cleanupError } = await supabaseAdmin
      .from("auth_attempts")
      .delete()
      .lt("created_at", cutoff);
    if (cleanupError) {
      console.error("[Auth] Failed to clean expired attempts:", cleanupError.code);
      throw new Error("تعذّر التحقق من محاولات الدخول بسبب مشكلة في قاعدة البيانات.");
    }

    const { count, error } = await supabaseAdmin
      .from("auth_attempts")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .eq("outcome", "failure");
    if (error) {
      console.error("[Auth] Failed to count login attempts:", error.code);
      throw new Error("تعذّر التحقق من محاولات الدخول بسبب مشكلة في قاعدة البيانات.");
    }
    if (count === null) {
      console.error("[Auth] Login attempt count was not returned.");
      throw new Error("تعذّر التحقق من محاولات الدخول بسبب مشكلة في قاعدة البيانات.");
    }

    if (count >= 10) {
      return { allowed: false as const, retryAfterSeconds: 15 * 60 };
    }
    return { allowed: true as const, retryAfterSeconds: 0 };
  });

export const recordAuthAttempt = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(8).max(25),
        success: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("auth_attempts").insert({
      phone,
      outcome: data.success ? "success" : "failure",
    });
    if (error) {
      console.error("[Auth] Failed to record login attempt:", error.code);
      throw new Error("تعذّر تسجيل محاولة الدخول بسبب مشكلة في قاعدة البيانات.");
    }
    return { ok: true as const };
  });
