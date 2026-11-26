// lib/auth/demoConfig.ts
// Feature flag aman untuk tombol 4-Role Quick Demo (OWASP ASVS V2 & Secure Deployment)

export function isDemoLoginEnabled(): boolean {
  const explicit = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;
  if (explicit === "false") return false;
  if (explicit === "true") return true;
  return process.env.NODE_ENV !== "production";
}
