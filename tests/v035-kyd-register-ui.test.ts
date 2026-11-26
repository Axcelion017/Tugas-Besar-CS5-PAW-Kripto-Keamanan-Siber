import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AccountStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { registerNakesServerAction } from "../features/auth/register-actions";

describe("Opsi 1 & UX Pasien — Registrasi Nakes e-KYD 100% PostgreSQL & Higiene UI", () => {
  const root = process.cwd();

  it("1. app/(auth)/register/nakes/page.tsx bebas dari localStorage dan MOCK_FASKES/MOCK_KYD_REQUESTS", () => {
    const src = fs.readFileSync(
      path.join(root, "app", "(auth)", "register", "nakes", "page.tsx"),
      "utf-8"
    );
    expect(src).not.toContain("MOCK_FASKES");
    expect(src).not.toContain("MOCK_KYD_REQUESTS");
    expect(src).not.toContain("getStorageData");
    expect(src).not.toContain("setStorageData");
    expect(src).toContain("registerNakesServerAction");
    expect(src).toContain("getFaskesListServerAction");
  });

  it("2. registerNakesServerAction menyimpan User (PENDING), Doctor (inactive), & KydSubmission secara atomik ke PostgreSQL", async () => {
    const uniq = `${Date.now().toString().slice(-6)}`;
    const username = `dr_uji_${uniq}`;
    const email = `dr_uji_${uniq}@jagamedis.test`;
    const strNumber = `STR-UJI-${uniq}`;
    const sipNumber = `SIP-UJI-${uniq}`;

    const existingFaskes = await prisma.faskes.findFirst({ select: { id: true, nama: true } });
    expect(existingFaskes).not.toBeNull();

    let createdUserId: string | undefined;
    try {
      const res = await registerNakesServerAction({
        username,
        email,
        password: "PasswordAman123!",
        nik: `3273011102${uniq}`,
        namaLengkap: "dr. Uji Kredensial, Sp.PD",
        strNumber,
        sipNumber,
        spesialisasi: "Spesialis Penyakit Dalam",
        faskesId: existingFaskes!.id,
        faskesNama: existingFaskes!.nama,
        dokumenStrFileName: "str-resmi.pdf",
        strDokumenUploaded: true,
      });

      expect(res.success).toBe(true);
      expect(res.userId).toBeTruthy();
      expect(res.kydId).toBeTruthy();
      createdUserId = res.userId;

      const [dbUser, dbDoctor, dbKyd] = await Promise.all([
        prisma.user.findUnique({ where: { id: res.userId! } }),
        prisma.doctor.findUnique({ where: { userId: res.userId! } }),
        prisma.kydSubmission.findUnique({ where: { id: res.kydId! } }),
      ]);

      expect(dbUser?.status).toBe(AccountStatus.PENDING);
      expect(dbUser?.passwordHash.startsWith("$2")).toBe(true);
      expect(dbDoctor?.isActive).toBe(false);
      expect(dbDoctor?.faskesId).toBe(existingFaskes!.id);
      expect(dbKyd?.status).toBe(AccountStatus.PENDING);
      expect(dbKyd?.strNumber).toBe(strNumber);

      // Duplikat STR wajib ditolak
      const dupRes = await registerNakesServerAction({
        username: `${username}_2`,
        email: `dup_${email}`,
        password: "PasswordAman123!",
        nik: `3273011103${uniq}`,
        namaLengkap: "dr. Duplikat STR",
        strNumber,
        sipNumber: `${sipNumber}-2`,
        spesialisasi: "Dokter Umum",
        faskesId: existingFaskes!.id,
        faskesNama: existingFaskes!.nama,
        dokumenStrFileName: "str-dup.pdf",
        strDokumenUploaded: true,
      });
      expect(dupRes.success).toBe(false);
    } finally {
      if (createdUserId) {
        await prisma.kydSubmission.deleteMany({ where: { userId: createdUserId } });
        await prisma.doctor.deleteMany({ where: { userId: createdUserId } });
        await prisma.user.deleteMany({ where: { id: createdUserId } });
      }
    }
  });

  it("3. Halaman Izin Akses, RME, dan Pencarian Faskes bebas emoji kasual dan menjaga kontrak Progressive Disclosure", () => {
    const rmeSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "pasien", "rekam-medis", "page.tsx"),
      "utf-8"
    );
    const consentSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "pasien", "consent", "page.tsx"),
      "utf-8"
    );
    const faskesSrc = fs.readFileSync(
      path.join(root, "app", "(dashboard)", "pasien", "faskes", "page.tsx"),
      "utf-8"
    );

    expect(rmeSrc).toContain("Rekam Medis Terlindungi");
    expect(rmeSrc).toContain("<details");
    expect(rmeSrc).not.toContain("⚠️");
    expect(consentSrc).toContain("ConfirmModal");
    expect(consentSrc).toContain("ToastBanner");
    expect(faskesSrc).toContain("Hanya Faskes Aktif");
  });
});
