/**
 * Client-side hint for whether the signed-in email is a platform owner. This
 * is only a UI convenience (redirect to /admin, show the console) — the real
 * authorization gate is server-side in every /api/admin route. Reads the
 * public allowlist NEXT_PUBLIC_PLATFORM_OWNER_EMAILS (comma-separated).
 */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
