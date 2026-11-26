import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export function isStrongPassword(password: string): boolean {
  if (password.length < 12 || password.length > 72) return false;
  let classes = 0;
  if (/\p{Ll}/u.test(password)) classes++;
  if (/\p{Lu}/u.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^\p{L}\p{N}\s]/u.test(password)) classes++;
  return classes >= 3;
}

export const reportUnverifiedLoginFailure = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({}).strict().parse(d))
  .handler(async () => {
    const { recordSecurityEvent } = await import("@/lib/security-events.server");
    await recordSecurityEvent({
      eventType: "client_login_failure_reported",
      source: "client_reported_unverified",
    });
    return { ok: true as const };
  });
