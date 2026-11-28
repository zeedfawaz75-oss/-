import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ shopId: z.string().uuid() });
const moderationSchema = z.object({
  shopId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
const newShopSchema = z.object({ shopId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
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
    throw new Error("هذه الصفحة للمسؤولين فقط");
  }
}

function runtimeEnv(): Record<string, string | undefined> {
  return (
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

async function sendWhatsAppWebhook(payload: Record<string, unknown>): Promise<void> {
  const webhookUrl = runtimeEnv().WHATSAPP_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      console.error("[WhatsAppAlert] Webhook URL must use HTTPS and cannot contain credentials.");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "error",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error(`[WhatsAppAlert] Webhook delivery failed with HTTP ${response.status}.`);
      }
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
      console.error(`[WhatsAppAlert] Webhook delivery failed (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    console.error("[WhatsAppAlert] Configured webhook URL is invalid.");
  }
}

async function fetchShopForModeration(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  shopId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("shops")
    .select("id, owner_id, name, phone, whatsapp")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("المحل غير موجود.");
  return data;
}
export const adminApproveShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shop = await fetchShopForModeration(supabaseAdmin, data.shopId);
    const { data: approved, error } = await context.supabase
      .from("shops")
      .update({ status: "approved" })
      .eq("id", data.shopId)
      .select("id,name,status,owner_id,phone,whatsapp")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!approved || approved.status !== "approved") {
      throw new Error("تعذّر تأكيد اعتماد المحل في قاعدة البيانات.");
    }
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: approved.owner_id,
      type: "shop_approved",
      title: "تم اعتماد محلك 🎉",
      body: `حياكم الله، تم اعتماد محل ${approved.name} في دليل مأرب وأصبح ظاهرًا للباحثين والزوار. نسأل الله لكم التوفيق والبركة في رزقكم، ونتطلع لخدمتكم باستمرار.`,
      shop_id: approved.id,
    });
    if (notificationError) {
      console.error("[Admin] Failed to notify shop owner:", notificationError.code);
    }
    await sendWhatsAppWebhook({
      event: "shop_approved",
      shop_id: approved.id,
      shop_name: approved.name,
      phone: approved.whatsapp || approved.phone || shop.phone,
      message: `حياكم الله، تم اعتماد محل ${approved.name} في دليل مأرب وأصبح ظاهرًا للباحثين والزوار. نسأل الله لكم التوفيق والبركة في رزقكم، ونتطلع لخدمتكم باستمرار.`,
    });
    return { ok: true as const, shop: approved };
  });

export const adminRejectShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => moderationSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shop = await fetchShopForModeration(supabaseAdmin, data.shopId);
    const { data: rejected, error } = await context.supabase
      .from("shops")
      .update({ status: "rejected", rejection_reason: data.reason })
      .eq("id", data.shopId)
      .select("id,name,status,owner_id,phone,whatsapp,rejection_reason")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rejected || rejected.status !== "rejected") {
      throw new Error("تعذّر تأكيد رفض المحل في قاعدة البيانات.");
    }
    await sendWhatsAppWebhook({
      event: "shop_rejected",
      shop_id: rejected.id,
      shop_name: rejected.name,
      phone: rejected.whatsapp || rejected.phone,
      reason: data.reason,
      message: `حياكم الله، نعتذر عن اعتماد طلب محل ${rejected.name} في دليل مأرب حاليًا.\nالسبب: ${data.reason}\nنرجو منكم معالجة الملاحظة وإعادة إرسال الطلب أو التواصل معنا لنتمكن من اعتماده بكل سرور.`,
    });
    return { ok: true as const, shop: rejected };
  });

export const adminDeleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => moderationSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shop = await fetchShopForModeration(supabaseAdmin, data.shopId);
    const { error: auditError } = await supabaseAdmin.from("shop_moderation_audit").insert({
      shop_id: shop.id,
      owner_id: shop.owner_id,
      shop_name: shop.name,
      action: "deleted",
      reason: data.reason,
      moderated_by: context.userId,
    });
    if (auditError) throw new Error("تعذّر حفظ سبب حذف المحل.");
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: shop.owner_id,
      type: "shop_rejected",
      title: "تم حذف طلب المحل",
      body: `حياكم الله، نحيطكم علمًا بأنه تم حذف سجل ${shop.name} من دليل مأرب.\nالسبب: ${data.reason}\nلأي استفسار أو مراجعة بخصوص السجل، يسعدنا تواصلكم معنا في أي وقت.`,
      shop_id: null,
    });
    if (notificationError)
      console.error("[Admin] Failed to notify deleted shop owner:", notificationError.code);
    const { error } = await supabaseAdmin.from("shops").delete().eq("id", data.shopId);
    if (error) throw new Error(error.message);
    await sendWhatsAppWebhook({
      event: "shop_deleted",
      shop_id: shop.id,
      shop_name: shop.name,
      phone: shop.whatsapp || shop.phone,
      reason: data.reason,
      message: `حياكم الله، نحيطكم علمًا بأنه تم حذف سجل ${shop.name} من دليل مأرب.\nالسبب: ${data.reason}\nلأي استفسار أو مراجعة بخصوص السجل، يسعدنا تواصلكم معنا في أي وقت.`,
    });
    return { ok: true as const };
  });

/** Notify admins and optional WhatsApp webhook after a new shop request is created. */
export const notifyAdminNewShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => newShopSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shop = await fetchShopForModeration(supabaseAdmin, data.shopId);
    if (shop.owner_id !== context.userId) throw new Error("لا تملك هذا المحل.");
    await sendWhatsAppWebhook({
      event: "shop_pending",
      shop_id: shop.id,
      shop_name: shop.name,
      phone: shop.whatsapp || shop.phone,
      owner_id: shop.owner_id,
      message: `طلب محل جديد بانتظار الاعتماد: ${shop.name}`,
    });
    return { ok: true as const };
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
    const rows = data ?? [];
    const ownerIds = [...new Set(rows.map((row) => row.owner_id).filter(Boolean))];
    const ownerShopCounts = new Map<string, number>();
    const rejectedOwnerIds = new Set<string>();
    const deletedOwnerIds = new Set<string>();

    if (ownerIds.length) {
      const [{ data: ownerShops }, { data: rejectedShops }, { data: deletedAudit }] =
        await Promise.all([
          supabaseAdmin.from("shops").select("owner_id").in("owner_id", ownerIds),
          supabaseAdmin
            .from("shops")
            .select("owner_id")
            .in("owner_id", ownerIds)
            .eq("status", "rejected"),
          supabaseAdmin
            .from("shop_moderation_audit")
            .select("owner_id")
            .in("owner_id", ownerIds)
            .eq("action", "deleted"),
        ]);

      for (const row of ownerShops ?? []) {
        ownerShopCounts.set(row.owner_id, (ownerShopCounts.get(row.owner_id) ?? 0) + 1);
      }
      for (const row of rejectedShops ?? []) rejectedOwnerIds.add(row.owner_id);
      for (const row of deletedAudit ?? []) {
        if (row.owner_id) deletedOwnerIds.add(row.owner_id);
      }
    }

    return rows.map((row) => ({
      ...row,
      owner_shop_count: ownerShopCounts.get(row.owner_id) ?? 1,
      has_rejected_shop: rejectedOwnerIds.has(row.owner_id),
      has_deleted_shop: deletedOwnerIds.has(row.owner_id),
    }));
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
