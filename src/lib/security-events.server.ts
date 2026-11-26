import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SecurityEventType =
  | "auth_missing_credentials"
  | "auth_invalid_credentials"
  | "auth_missing_subject"
  | "admin_role_denied"
  | "client_login_failure_reported";

type SecurityEventSource = "server" | "client_reported_unverified";

const ALERT_WINDOW_MINUTES = 10;
const ALERT_THRESHOLDS: Record<SecurityEventType, number> = {
  auth_missing_credentials: 5,
  auth_invalid_credentials: 5,
  auth_missing_subject: 5,
  admin_role_denied: 5,
  client_login_failure_reported: 8,
};

function runtimeEnv(): Record<string, string | undefined> {
  return (
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

async function getSourceHash(): Promise<string | null> {
  const ip = getRequest()?.headers.get("cf-connecting-ip")?.trim();
  if (!ip) return null;

  const secret = runtimeEnv().SECURITY_EVENT_HASH_SECRET ?? runtimeEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sendSecurityAlert(
  eventType: SecurityEventType,
  source: SecurityEventSource,
  sourceHash: string | null,
  count: number,
): Promise<void> {
  const env = runtimeEnv();
  const webhookUrl = env.SECURITY_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  let url: URL;
  try {
    url = new URL(webhookUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Webhook URL must use HTTPS and cannot contain credentials.");
    }
  } catch {
    console.error("[SecurityAlerts] Configured webhook URL is invalid; alert was not sent.");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const headers = new Headers({ "content-type": "application/json" });
    if (env.SECURITY_ALERT_WEBHOOK_SECRET) {
      headers.set("authorization", `Bearer ${env.SECURITY_ALERT_WEBHOOK_SECRET}`);
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      redirect: "error",
      signal: controller.signal,
      body: JSON.stringify({
        event_type: eventType,
        source,
        source_hash: sourceHash,
        count,
        threshold: ALERT_THRESHOLDS[eventType],
        window_minutes: ALERT_WINDOW_MINUTES,
        occurred_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      console.error(`[SecurityAlerts] Webhook delivery failed with HTTP ${response.status}.`);
    }
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
    console.error(`[SecurityAlerts] Webhook delivery failed (${reason}).`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function recordSecurityEvent(input: {
  eventType: SecurityEventType;
  source?: SecurityEventSource;
  actorUserId?: string;
}): Promise<void> {
  const source = input.source ?? "server";
  let sourceHash: string | null = null;
  try {
    sourceHash = await getSourceHash();
  } catch {
    console.error("[SecurityEvents] Unable to pseudonymize the request source.");
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("record_security_event", {
      p_event_type: input.eventType,
      p_source: source,
      p_actor_user_id: input.actorUserId ?? null,
      p_source_hash: sourceHash,
    });
    if (error) {
      console.error("[SecurityEvents] Failed to persist event:", error.code);
      return;
    }

    const result = data?.[0];
    if (!result) {
      console.error("[SecurityEvents] Event recorder returned no result.");
      return;
    }
    if (!result.recorded) {
      if (result.recent_count === 21) {
        console.warn("[SecurityEvents] Per-source event rate limit reached.");
      }
      return;
    }
    if (result.recent_count === ALERT_THRESHOLDS[input.eventType]) {
      await sendSecurityAlert(input.eventType, source, sourceHash, result.recent_count);
    }
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[SecurityEvents] Failed to record or evaluate event:", code);
  }
}
