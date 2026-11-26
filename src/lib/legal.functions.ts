import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSupabasePublicConfig } from "@/integrations/supabase/public-env";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_LEGAL_PAGES } from "@/lib/legal-content";

const slugSchema = z.object({ slug: z.enum(["terms", "privacy"]) });
const updateSchema = z.object({
  slug: z.enum(["terms", "privacy"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("تعذّر التحقق من صلاحيات الإدارة");
  if (!data) {
    const { recordSecurityEvent } = await import("@/lib/security-events.server");
    await recordSecurityEvent({
      eventType: "admin_role_denied",
      actorUserId: context.userId,
    });
    throw new Error("هذه العملية للمسؤولين فقط");
  }
}

export const getLegalPage = createServerFn({ method: "POST" })
  .validator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { url, publishableKey } = getSupabasePublicConfig();
    if (!url || !publishableKey) {
      const missing = [
        ...(!url ? ["SUPABASE_URL"] : []),
        ...(!publishableKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
    }
    const supabasePublic = createClient(url, publishableKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await supabasePublic
      .from("app_legal_pages")
      .select("title, content, updated_at")
      .eq("slug", data.slug)
      .single();
    if (error?.code === "PGRST116") return DEFAULT_LEGAL_PAGES[data.slug];
    if (error) throw new Error(error.message);
    if (!row) throw new Error("تعذّر تحميل الصفحة القانونية.");
    return row as { title: string; content: string; updated_at: string };
  });

export const updateLegalPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_legal_pages")
      .upsert(
        { slug: data.slug, title: data.title, content: data.content },
        { onConflict: "slug" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
