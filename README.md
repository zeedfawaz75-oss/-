# Marib Directory Import

استيراد مشروع دليل مأرب التجاري والخدمي من مستودع GitHub".

**Live app**: https://worker.zeedfawaz75.workers.dev

## Production deployment

The production application is hosted on Cloudflare Workers. Changes pushed to
the GitHub `master` branch are deployed through the connected Cloudflare build.

### Security event alerts

Apply the SQL migration in `supabase/migrations/20261126050000_security_event_alerts.sql`
to the production Supabase project (for example, with `supabase db push` or the
Supabase SQL Editor). It creates a protected `security_events` table and a
service-role-only recording function. Public roles and the app's service-role
client cannot directly read or write these records. Historical `auth_attempts`
rows are retained but no longer accessible to app roles; the migration does not
delete user data.

The server records missing/invalid authentication and denied admin-role checks.
Browser login failures are labeled as unverified client reports; they contain no
phone, email, password, token, or request body and are not used to block sign-ins.
Events are grouped by a keyed HMAC of Cloudflare's `cf-connecting-ip` header;
the raw address is never stored. Each source/event pair is capped at 20 records
per minute. After 5 matching server events or 8 unverified login-failure reports
from the same source within 10 minutes, the server sends a minimal JSON alert if
configured. Set `SECURITY_ALERT_WEBHOOK_URL` in Cloudflare Worker secrets or
variables; optionally set `SECURITY_ALERT_WEBHOOK_SECRET` for the Bearer header
and `SECURITY_EVENT_HASH_SECRET` as the HMAC key (it falls back to the
server-only Supabase service-role key). The webhook is HTTPS-only, disallows
redirects, and has a 4-second timeout. Database logging continues if the webhook
is unset or unavailable.

To check the deployment, apply the migration, configure the optional Worker
variables, then exercise a protected server action without authentication and
with a valid non-admin session. Verify rows using the Supabase SQL Editor as an
administrator, for example:

```sql
SELECT event_type, source, source_hash, actor_user_id, created_at
FROM public.security_events
ORDER BY created_at DESC
LIMIT 20;
```

To check login alert delivery, use a test account and submit an incorrect
password eight times within ten minutes from the same network, then inspect the
configured webhook receiver. Do not use real passwords or contact details as
test data. Supabase Auth's own rate limits remain the authoritative control for
authentication requests; client-reported failures are telemetry, not proof.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
