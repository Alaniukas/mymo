// Admin access is gated by an email allowlist in the ADMIN_EMAILS env var
// (comma-separated). Kept as a pure function so it can be reused in the proxy,
// route handlers, and server layouts alike.
//
// Dev convenience: when ADMIN_EMAILS is unset and we're NOT in production, any
// authenticated user is treated as an admin so /admin works locally out of the
// box. In production an explicit allowlist is required (fail closed).

function adminEmailList(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowlist = adminEmailList();
  if (allowlist.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  return allowlist.includes(email.toLowerCase());
}
