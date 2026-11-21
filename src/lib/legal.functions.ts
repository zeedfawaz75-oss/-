import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugSchema = z.object({ slug: z.enum(["terms", "privacy"]) });
const updateSchema = z.object({
  slug: z.enum(["terms", "privacy"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("تعذّر التحقق من صلاحيات الإدارة");
  if (!data) throw new Error("هذه العملية للمسؤولين فقط");
}

export const getLegalPage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabasePublic = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: row, error } = await supabasePublic
      .from("app_legal_pages")
      .select("title, content, updated_at")
      .eq("slug", data.slug)
      .single();
    if (error) throw new Error(error.message);
    return row as { title: string; content: string; updated_at: string };
  });

export const updateLegalPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_legal_pages")
      .update({ title: data.title, content: data.content })
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
