import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("تعذّر التحقق من صلاحيات الإدارة");
  if (!data) throw new Error("هذه الصفحة للمسؤولين فقط");
}

async function recordSecurityAction(input: {
  actor_user_id: string;
  target_user_id: string;
  action: string;
  details: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("admin_security_audit").insert(input);
  if (error) {
    console.error("[Admin] Failed to save security audit entry:", error.code);
    throw new Error("تم تنفيذ الإجراء لكن تعذّر حفظه في سجل الأمان.");
  }
}

const roleSchema = z.enum(["admin", "moderator", "owner", "user"]);

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: {
      id: string;
      label: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      created_at: string;
      banned: boolean;
      roles: string[];
    }[] = [];

    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const list = data.users ?? [];
      for (const u of list) {
        const banned = Boolean(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (u as any).banned_until && new Date((u as any).banned_until).getTime() > Date.now(),
        );
        users.push({
          id: u.id,
          label: (u.phone || u.email?.split("@")[0] || "مستخدم") as string,
          fullName: ((u.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() || "—",
          email: u.email ?? null,
          phone:
            u.phone ||
            ((u.user_metadata ?? {}) as { phone?: string }).phone ||
            (u.email?.includes("@marib-dir.com") ? (u.email.split("@")[0] ?? null) : null) ||
            null,
          created_at: u.created_at ?? "",
          banned,
          roles: [],
        });
      }
      if (list.length < 200) break;
    }

    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const byUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role as string]);
    }
    for (const u of users) u.roles = byUser.get(u.id) ?? [];

    users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return users;
  });

/** Replace a user's roles with a single role (or clear them when role is null). */
export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema.nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("لا يمكنك إزالة صلاحية المسؤول عن حسابك");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.role) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ user_id: data.userId, role: data.role as any });
      if (error) throw new Error(error.message);
    }
    await recordSecurityAction({
      actor_user_id: context.userId,
      target_user_id: data.userId,
      action: "admin_role_change",
      details: data.role ? `تم تعيين صلاحية: ${data.role}` : "تم إزالة صلاحيات المستخدم",
    });
    return { ok: true };
  });

export const adminSetUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك حظر حسابك الخاص");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) throw new Error(error.message);
    await recordSecurityAction({
      actor_user_id: context.userId,
      target_user_id: data.userId,
      action: data.banned ? "admin_account_ban" : "admin_account_unban",
      details: data.banned ? "تم حظر الحساب من قبل مسؤول" : "تم رفع حظر الحساب من قبل مسؤول",
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      type: "security",
      title: data.banned ? "تم حظر حسابك ⛔" : "تم رفع الحظر عن حسابك ✅",
      body: data.banned
        ? "قام مسؤول بحظر الحساب. تواصل مع الإدارة للمراجعة."
        : "تمت إعادة تفعيل الحساب بواسطة الإدارة.",
    });
    return { ok: true };
  });

/** Admin-only: set a new password for any user. */
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(12).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    await recordSecurityAction({
      actor_user_id: context.userId,
      target_user_id: data.userId,
      action: "admin_password_change",
      details: "تم تغيير كلمة مرور المستخدم بواسطة مسؤول.",
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      type: "security",
      title: "تم تغيير كلمة مرور حسابك 🔐",
      body: "قام مسؤول بتغيير كلمة المرور. إذا لم تطلب ذلك، تواصل فورًا مع الإدارة وصعّب كلمة مرورك.",
    });

    return { ok: true };
  });

/** Broadcast a notification to every registered user. */
export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(2).max(120),
        body: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids: string[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const list = res.users ?? [];
      ids.push(...list.map((u) => u.id));
      if (list.length < 200) break;
    }
    if (ids.length === 0) return { sent: 0 };

    const rows = ids.map((id) => ({
      user_id: id,
      type: "broadcast",
      title: data.title,
      body: data.body?.trim() || null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    return { sent: rows.length };
  });

/** Live counters for the dashboard overview. */
export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const countOf = async (status?: string) => {
      let q = supabaseAdmin.from("shops").select("*", { count: "exact", head: true });
      if (status) q = q.eq("status", status);
      const { count } = await q;
      return count ?? 0;
    };

    const [approved, pending, rejected, totalShops] = await Promise.all([
      countOf("approved"),
      countOf("pending"),
      countOf("rejected"),
      countOf(),
    ]);

    const { count: reviews } = await supabaseAdmin
      .from("ratings")
      .select("*", { count: "exact", head: true });
    const { count: categories } = await supabaseAdmin
      .from("categories")
      .select("*", { count: "exact", head: true });

    let totalUsers = 0;
    let newUsers7d = 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const list = data.users ?? [];
      totalUsers += list.length;
      for (const u of list) {
        if (new Date(u.created_at ?? "").getTime() >= weekAgo) newUsers7d++;
      }
      if (list.length < 200) break;
    }

    return {
      approved,
      pending,
      rejected,
      totalShops,
      reviews: reviews ?? 0,
      categories: categories ?? 0,
      totalUsers,
      newUsers7d,
    };
  });
