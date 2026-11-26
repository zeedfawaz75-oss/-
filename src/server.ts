import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getSupabasePublicConfig } from "./integrations/supabase/public-env";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ServerEnvironment = {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function addSecurityHeaders(response: Response, request: Request, env: unknown): Response {
  const runtimeEnv = env && typeof env === "object" ? (env as ServerEnvironment) : {};
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    runtimeEnv.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL ||
    runtimeEnv.SUPABASE_URL ||
    getSupabasePublicConfig().url;
  const supabaseSources = ["https://*.supabase.co", "wss://*.supabase.co"];

  if (supabaseUrl) {
    try {
      const supabaseOrigin = new URL(supabaseUrl);
      if (supabaseOrigin.protocol === "https:" || supabaseOrigin.protocol === "http:") {
        supabaseSources.push(supabaseOrigin.origin);
        supabaseSources.push(
          `${supabaseOrigin.protocol === "https:" ? "wss:" : "ws:"}//${supabaseOrigin.host}`,
        );
      } else {
        console.error("[SecurityHeaders] Supabase URL must use HTTP or HTTPS.");
      }
    } catch (error) {
      console.error("[SecurityHeaders] Invalid Supabase URL.", error);
    }
  }

  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' ${supabaseSources.join(" ")}`,
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return addSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request, env);
    } catch (error) {
      console.error(error);
      return addSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        env,
      );
    }
  },
};
