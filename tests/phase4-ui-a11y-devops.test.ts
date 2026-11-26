import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, acc);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Fase 4 Quality Gates — WCAG 2.1 AA, Progressive Disclosure, Print Isolation & DevOps Hygiene", () => {
  const root = process.cwd();

  test("1. app/globals.css bebas konflik OS Dark Mode (WCAG 1.4.3), mendukung reduced-motion (WCAG 2.3.3), & mengisolasi cetak A4", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf-8");
    expect(css).not.toContain("prefers-color-scheme: dark");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("@media print");
    expect(css).toContain("#jagamedis-print-portal");
  });

  test("2. Seluruh kode aplikasi (app/, features/, components/) bebas 100% dari dialog pemblokir window.alert() dan window.confirm()", () => {
    const files = [
      ...walkSourceFiles(path.join(root, "app")),
      ...walkSourceFiles(path.join(root, "features")),
      ...walkSourceFiles(path.join(root, "components")),
    ];

    const offenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      if (/\b(?:window\.)?(?:alert|confirm)\s*\(/.test(content)) {
        offenders.push(path.relative(root, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  test("3. Komponen Modal.tsx, ToastBanner.tsx, LogoutModal.tsx, layout.tsx, error.tsx, & PrintableMedicalResume.tsx mematuhi standar WCAG 2.1 AA", () => {
    const modalSrc = fs.readFileSync(path.join(root, "components", "ui", "Modal.tsx"), "utf-8");
    expect(modalSrc).toContain('role="dialog"');
    expect(modalSrc).toContain('aria-modal="true"');
    expect(modalSrc).toContain("Escape");

    const toastSrc = fs.readFileSync(path.join(root, "components", "ui", "ToastBanner.tsx"), "utf-8");
    expect(toastSrc).toContain('role={isError ? "alert" : "status"}');
    expect(toastSrc).toContain("aria-live");

    const layoutSrc = fs.readFileSync(path.join(root, "app", "(dashboard)", "layout.tsx"), "utf-8");
    expect(layoutSrc).toContain('href="#main-content"');
    expect(layoutSrc).toContain('id="main-content"');
    expect(layoutSrc).toContain("lg:sticky lg:top-0");

    const errorSrc = fs.readFileSync(path.join(root, "app", "(dashboard)", "error.tsx"), "utf-8");
    expect(errorSrc).toContain("error.digest");
    expect(errorSrc).not.toContain('typeof window !== "undefined" ? getUserSession()');

    const profilSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "pasien", "profil", "page.tsx"),
      "utf-8"
    );
    expect(profilSrc).toContain('className="sr-only"');

    const rmePasienSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "pasien", "rekam-medis", "page.tsx"),
      "utf-8"
    );
    expect(rmePasienSrc).toContain("Rekam Medis Terlindungi");
    expect(rmePasienSrc).toContain("<details");

    const printSrc = fs.readFileSync(
      path.join(root, "components", "clinical", "PrintableMedicalResume.tsx"),
      "utf-8"
    );
    expect(printSrc).toContain("createPortal");
    expect(printSrc).toContain('id="jagamedis-print-portal"');
    expect(printSrc).not.toContain("ACTION BAR BAWAH");
  });

  test("4. DevOps Hardening (F4.3): Dockerfile memakai node:24-alpine + USER node + HEALTHCHECK & docker-compose.yml bebas password hardcode", () => {
    const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("FROM node:24-alpine AS builder");
    expect(dockerfile).toContain("FROM node:24-alpine AS runner");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("COPY features ./features");
    expect(dockerfile).toContain("proxy.ts");
    expect(dockerfile).toContain("HEALTHCHECK");

    const compose = fs.readFileSync(path.join(root, "docker-compose.yml"), "utf-8");
    expect(compose).not.toContain("ResilioHealth2026SecurePass!");
    expect(compose).toContain("${POSTGRES_PASSWORD");
    expect(compose).toContain("cap_drop:");
    expect(compose).toContain("no-new-privileges:true");

    expect(fs.existsSync(path.join(root, ".env.example"))).toBe(true);
  });
});
