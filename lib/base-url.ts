/**
 * Best-effort absolute base URL for this deployment, used when an email
 * needs a real HTTP(S) URL (e.g. a logo image — data: URIs are blocked by
 * Outlook and unreliable elsewhere, so images must be linked, not inlined).
 * Returns null if nothing is configured, in which case callers should
 * degrade gracefully (e.g. skip the image).
 */
export function getBaseUrl(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}
