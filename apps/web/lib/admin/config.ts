import "server-only";

/**
 * Administrative features are off unless every required secret is present.
 * Self-hosters who only want the analyzer set none of these.
 */
export type AdminConfig = {
  databaseUrl: string;
  authSecret: string;
  baseUrl: string;
  resendApiKey: string;
  emailFrom: string;
  /** Email that may claim the first superadmin role (once, if none exists). */
  bootstrapEmail: string;
};

export function adminConfig(): AdminConfig | null {
  const env = process.env;
  const databaseUrl = env.DATABASE_URL;
  const authSecret = env.BETTER_AUTH_SECRET;
  const resendApiKey = env.RESEND_API_KEY;
  const emailFrom = env.EMAIL_FROM;
  const bootstrapEmail = env.SUPERADMIN_EMAIL;
  // Previews run on their own URL; passkeys are bound to the exact origin.
  const previewUrl =
    env.VERCEL_ENV === "preview" && env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined;
  const baseUrl =
    env.BETTER_AUTH_URL ??
    previewUrl ??
    env.NEXT_PUBLIC_SITE_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  env.BETTER_AUTH_URL ??
    env.NEXT_PUBLIC_SITE_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  if (env.ADMIN_ENABLED === "false") return null;
  if (!databaseUrl || !authSecret || !resendApiKey || !emailFrom || !bootstrapEmail || !baseUrl)
    return null;
  if (authSecret.length < 32) return null;
  return {
    databaseUrl,
    authSecret,
    baseUrl: baseUrl.replace(/\/$/, ""),
    resendApiKey,
    emailFrom,
    bootstrapEmail: bootstrapEmail.trim().toLowerCase(),
  };
}

export const adminEnabled = () => adminConfig() !== null;
