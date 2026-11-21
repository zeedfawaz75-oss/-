import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ shopId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("تعذّر التحقق من صلاحيات الإدارة");
  if (!data) throw new Error("هذه الصفحة للمسؤولين فقط");
}

export const adminApproveShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Use the caller's RLS client: the shops_before_update trigger checks
    // has_role(auth.uid()), which is NULL under the service-role client and
    // silently reverts the status change.
    const { error } = await context.supabase
      .from("shops")
      .update({ status: "approved" })
      .eq("id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRejectShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("shops")
      .update({ status: "rejected" })
      .eq("id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shops").delete().eq("id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListShops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shops")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminPendingCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

/** Owner dashboard stats: pending shops + registered users (total / last 7 days). */
export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: pending } = await supabaseAdmin
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    let totalUsers = 0;
    let newUsers7d = 0;
    const recent: { id: string; label: string; created_at: string }[] = [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const users = data.users ?? [];
      totalUsers += users.length;
      for (const u of users) {
        const created = u.created_at ?? "";
        if (new Date(created).getTime() >= weekAgo) newUsers7d++;
        recent.push({
          id: u.id,
          label: (u.phone || u.email?.split("@")[0] || "مستخدم") as string,
          created_at: created,
        });
      }
      if (users.length < 200) break;
    }

    recent.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return {
      pending: pending ?? 0,
      totalUsers,
      newUsers7d,
      recentUsers: recent.slice(0, 8),
    };
  });
