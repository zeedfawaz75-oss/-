# Fresh Supabase setup

This setup intentionally does not import old users, roles, shops, or backups.
The current REST API check returned HTTP 404 for the app tables, which means the
tables are not currently available through the API; it does not prove that the
database contains zero rows in every schema.

## Target project

The local project is configured for Supabase project `yyvjupgezwzdjhsrzxtb` in `.env` and `config.toml`.

## Steps

1. Confirm in the Supabase dashboard that `yyvjupgezwzdjhsrzxtb` is the intended project.
2. Keep its URL, publishable key, and server secret key together in `.env`. Never commit `.env` or expose the server secret key in browser code.
3. In Supabase SQL Editor for the `yyvjupgezwzdjhsrzxtb` project, paste and run
    `supabase/fresh-install.sql` once. It combines the schema changes, policies,
    functions, triggers, and Storage buckets from the migrations. It excludes
    old-record deletion/copy steps and seed rows, so the application tables
    start empty. The terms/privacy pages will also be empty until you add their
    content in the admin interface.
4. Create a new account through the app's signup flow.
5. In SQL Editor, replace the email placeholder in `supabase/grant-admin.sql` with that new account's email and run it.
6. Sign in as the new account and verify that the admin dashboard opens.

Do not run `db reset`, drop schemas, or import the old backup unless you explicitly decide to restore old data later.
