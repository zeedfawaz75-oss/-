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
  .inputValidator((d: unknown) => phoneSchema.parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 8) return { allowed: false as const, retryAfterSeconds: 60 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    await db.from("auth_attempts").delete().lt("created_at", cutoff);
    const { count } = await db
      .from("auth_attempts")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone);

    const attempts = count ?? 0;
    if (attempts >= 10) return { allowed: false as const, retryAfterSeconds: 15 * 60 };
    return { allowed: true as const, retryAfterSeconds: 0 };
  });

export const recordAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    phone: z.string().min(8).max(25),
    success: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    await db.from("auth_attempts").insert({
      phone,
      outcome: data.success ? "success" : "failure",
    });
    return { ok: true as const };
  });
