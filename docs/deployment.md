# Deployment

PandaPayLens runs on Vercel. The public analyzer needs no configuration. The admin area turns on only when every variable below is set; otherwise `/admin` returns 404.

All steps can be done in the Vercel and Neon dashboards (including from a phone). No local commands are required.

## 1. Vercel project

1. Import `ratomirjovanovic/PandaPayLens` in Vercel.
2. Root directory: `apps/web`. Framework: Next.js. Install and build commands: defaults.
3. Set `NEXT_PUBLIC_SITE_URL` to the production URL, for example `https://pandapaylens.dev`.

## 2. Neon database

Add Neon from the Vercel Marketplace (Storage tab) or connect an existing Neon project. Enable preview branches so every preview deployment gets its own isolated database branch.

Neon gives you an owner connection string. Create a second, restricted role for the application at runtime:

```sql
CREATE ROLE ppl_app LOGIN PASSWORD '<generate one>';
GRANT USAGE ON SCHEMA public TO ppl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ppl_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ppl_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ppl_app;
```

Run this in the Neon SQL editor after the first deployment has created the tables.

## 3. Environment variables

| Variable                 | Environments                           | Value                                                                                           |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_MIGRATION_URL` | Production, Preview                    | Neon owner connection string. Used only during the build to apply migrations.                   |
| `DATABASE_URL`           | Production, Preview                    | Connection string of the restricted `ppl_app` role (or the owner string until the role exists). |
| `BETTER_AUTH_SECRET`     | Production, Preview (different values) | At least 32 random characters.                                                                  |
| `BETTER_AUTH_URL`        | Production                             | The production URL. Previews use their own deployment URL automatically.                        |
| `RESEND_API_KEY`         | Production, Preview                    | Resend API key with send permission.                                                            |
| `EMAIL_FROM`             | Production, Preview                    | Verified sender, for example `PandaPayLens <admin@your-domain>`.                                |
| `SUPERADMIN_EMAIL`       | Production                             | Email of the first superadmin.                                                                  |

Never put production secrets in Preview or Development.

## 4. First sign-in

1. Open `/admin/login` and enter the `SUPERADMIN_EMAIL` address.
2. Click the link in the email (valid 10 minutes, single use).
3. Register a passkey (phone, security key or the device's built-in authenticator).
4. Verify with the passkey. You now have the superadmin role. This is logged as `bootstrap.superadmin`.

The bootstrap works only while no active superadmin exists. After that, the variable grants nothing; new administrators must be invited from `/admin/users`.

## Security model

- Identity: email magic link (Resend). Second factor: passkey (WebAuthn), required for every privileged request.
- Sessions: 12 hours, HTTP-only, `SameSite=Strict`, secure cookies. Sensitive actions (invitations, role changes, settings, approvals) need a passkey check from the last 10 minutes.
- An email link alone can enroll the first passkey of an invited account, but can never add or remove passkeys once one exists.
- Authorization is checked in the service layer for every operation, never in the browser.
- The audit log is append-only; a database trigger rejects updates and deletes.
- The admin database never receives imported payment data.

## Rollback

Use Vercel's "Instant Rollback" to restore the previous deployment. Migrations are additive; if a migration must be reverted, write a new migration rather than editing an applied one.
