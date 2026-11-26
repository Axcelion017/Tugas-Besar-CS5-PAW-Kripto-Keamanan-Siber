import { revalidatePath } from "next/cache";

/**
 * Helper tunggal `safeRevalidate` untuk seluruh Server Actions & Feature Modules.
 * Mengabaikan error Next.js static generation store jika dipanggil di luar request context
 * (misalnya saat pengujian integrasi Vitest atau skrip CLI).
 */
export function safeRevalidate(paths: string | string[]): void {
  const list = Array.isArray(paths) ? paths : [paths];
  for (const path of list) {
    try {
      revalidatePath(path);
    } catch {
      // Diabaikan secara aman di luar request context Next.js
    }
  }
}
