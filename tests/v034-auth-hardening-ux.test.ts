import { describe, test, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  checkRateLimit,
  clearAllRateLimits,
  UNIFORM_LOGIN_ERROR,
} from "../lib/auth/rateLimit";
import { isDemoLoginEnabled } from "../lib/auth/demoConfig";
import { POST as sessionPost } from "../app/api/auth/session/route";

describe("Tahap A (v0.3.4) Quality Gates — Auth Hardening, Rate Limit, Anti-Enumeration & UX Modularity", () => {
  const root = process.cwd();

  afterEach(() => {
    clearAllRateLimits();
  });

  test("1. Sliding-window rate limiter memblokir setelah batas percobaan (P-05 / OWASP ASVS V2.2.1)", () => {
    const key = "unit:rate-limit:test";
    for (let i = 0; i < 3; i++) {
      const res = checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 });
      expect(res.allowed).toBe(true);
    }

    const blocked = checkRateLimit(key, { maxAttempts: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  test("2. POST /api/auth/session menegakkan Anti-Account Enumeration (pesan seragam 401) & HTTP 429 saat brute force (P-05 & P-05b)", async () => {
    const unknownReq = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.99",
      },
      body: JSON.stringify({ identifier: "akun_tidak_terdaftar_xyz", password: "wrongpassword" }),
    });
    const unknownRes = await sessionPost(unknownReq);
    expect(unknownRes.status).toBe(401);
    const unknownJson = await unknownRes.json();

    const wrongPassReq = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.0.0.100",
      },
      body: JSON.stringify({ identifier: "budi", password: "wrongpassword" }),
    });
    const wrongPassRes = await sessionPost(wrongPassReq);
    expect(wrongPassRes.status).toBe(401);
    const wrongPassJson = await wrongPassRes.json();

    // Pesan gagal akun tidak ada & kata sandi salah wajib 100% identik (CWE-204 / ASVS V2.2.2)
    expect(unknownJson.message).toBe(UNIFORM_LOGIN_ERROR);
    expect(wrongPassJson.message).toBe(UNIFORM_LOGIN_ERROR);

    // Uji HTTP 429 pada percobaan ke-11 untuk IP + identifier yang sama
    for (let i = 0; i < 9; i++) {
      await sessionPost(
        new NextRequest("http://localhost:3000/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.0.0.100",
          },
          body: JSON.stringify({ identifier: "budi", password: "wrongpassword" }),
        })
      );
    }

    const rateLimitedRes = await sessionPost(
      new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.0.0.100",
        },
        body: JSON.stringify({ identifier: "budi", password: "wrongpassword" }),
      })
    );
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.headers.get("Retry-After")).toBeTruthy();
  });

  test("3. Gating Quick Demo (NEXT_PUBLIC_ENABLE_DEMO_LOGIN) & nol fallback klien DOC-01 / MOCK di halaman kritis (P-01 & P-03)", () => {
    const prevFlag = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;
    try {
      process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = "false";
      expect(isDemoLoginEnabled()).toBe(false);
      process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = "true";
      expect(isDemoLoginEnabled()).toBe(true);
    } finally {
      if (prevFlag === undefined) delete process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;
      else process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = prevFlag;
    }

    const landingSrc = fs.readFileSync(path.join(root, "app", "page.tsx"), "utf-8");
    expect(landingSrc).toContain("isDemoLoginEnabled");
    expect(landingSrc).not.toContain("loginUser(");

    const loginSrc = fs.readFileSync(path.join(root, "app", "(auth)", "login", "page.tsx"), "utf-8");
    expect(loginSrc).toContain("isDemoLoginEnabled");

    const lookupSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "nakes", "pasien-lookup", "page.tsx"),
      "utf-8"
    );
    expect(lookupSrc).not.toContain('|| "DOC-01"');
    expect(lookupSrc).not.toContain("MOCK_PATIENTS");
    expect(lookupSrc).toContain("getCachedPatients");

    const offlineSyncSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "nakes", "offline-sync", "page.tsx"),
      "utf-8"
    );
    expect(offlineSyncSrc).not.toContain('|| "DOC-01"');

    const rmeDetailSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "pasien", "rekam-medis", "[recordId]", "page.tsx"),
      "utf-8"
    );
    expect(rmeDetailSrc).not.toContain("MOCK_ENCRYPTED_RECORDS");
  });

  test("4. Navigasi RoleNav tanpa duplikasi /beranda, palet klinis teal, lencana outbox dokter, & 4 berkas domain medis <350 baris (P-02, P-03, P-04)", () => {
    const navSrc = fs.readFileSync(path.join(root, "components", "shared", "RoleNav.tsx"), "utf-8");
    expect(navSrc).not.toContain('label: "Beranda Terpadu"');
    expect(navSrc).toContain("bg-teal-700");
    expect(navSrc).toContain("pendingOutboxCount");
    expect(navSrc).toContain("OUTBOX_UPDATED_EVENT");

    const targetModules = [
      "features/medical-records/exam/ExamWorkspace.tsx",
      "features/medical-records/exam/useExamForm.ts",
      "features/medical-records/exam/ExamTabs4To5.tsx",
      "features/medical-records/exam/ExamTab4Plan.tsx",
      "features/medical-records/exam/ExamTab5MedicoLegal.tsx",
      "features/medical-records/exam-actions.ts",
      "features/medical-records/exam-support-actions.ts",
      "features/medical-records/patient-detail/PatientDetailWorkspace.tsx",
      "features/auth/session-actions.ts",
      "features/auth/register-actions.ts",
    ];

    for (const relPath of targetModules) {
      const lines = fs.readFileSync(path.join(root, relPath), "utf-8").split("\n").length;
      expect(lines, `${relPath} melebihi 350 baris (${lines})`).toBeLessThanOrEqual(350);
    }
  });
});
