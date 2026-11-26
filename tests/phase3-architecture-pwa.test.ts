import { describe, test, expect, vi, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db/prisma";
import { registerSessionAsync, revokeSessionAsync } from "../lib/auth/sessionStore";
import { encryptMedicalRecordPayload } from "../features/medical-records/crypto-service";
import { parsePrescriptionDetail } from "../features/medical-records/prescription-parser";

let currentMockSessionToken: string | null = null;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "resilio_session_token" && currentMockSessionToken
        ? { value: currentMockSessionToken }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { GET as healthGet } from "../app/api/health/route";
import { POST as outboxSyncPost } from "../app/api/sync/outbox/route";
import { GET as attachmentsGet, POST as attachmentsPost } from "../app/api/attachments/route";

describe("Fase 3 Quality Gates — Modularisasi features/, REST API, PWA/IndexedDB & Sinkronisasi Jadwal", () => {
  const createdSessionTokens: string[] = [];

  async function loginAs(
    role: "pasien" | "nakes" | "admin",
    overrides: Partial<{ id: string; name: string; username: string; faskesId: string }> = {}
  ) {
    const defaults = {
      pasien: { id: "P-101", name: "Budi Santoso", username: "budi" },
      nakes: {
        id: "DOC-01",
        name: "dr. Andi Pratama, Sp.PD",
        username: "dr_andi",
        faskesId: "FAS-01",
      },
      admin: { id: "ADM-01", name: "Admin Regulator Kemenkes", username: "admin" },
    }[role];

    const token = `phase3-test-${role}-${crypto.randomUUID()}`;
    await registerSessionAsync(token, { ...defaults, ...overrides, role, status: "VERIFIED" }, 3600);
    createdSessionTokens.push(token);
    currentMockSessionToken = token;
    return token;
  }

  afterAll(async () => {
    currentMockSessionToken = null;
    for (const token of createdSessionTokens) {
      await revokeSessionAsync(token).catch(() => {});
    }
  });

  test("1. GET /api/health mengembalikan 200 OK dengan status database connected", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.database).toBe("connected");
    expect(typeof json.latencyMs).toBe("number");
  });

  test("2. POST /api/sync/outbox menolak tanpa sesi (401), menolak HMAC tamper (422), & menyimpan berkas offline valid ke PostgreSQL (201)", async () => {
    // 2a. Tanpa sesi -> 401
    currentMockSessionToken = null;
    const unauthReq = new NextRequest("http://localhost:3000/api/sync/outbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    const unauthRes = await outboxSyncPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2b. Login sebagai Dokter DPJP
    await loginAs("nakes");
    const patient = await prisma.patient.findUnique({ where: { id: "P-101" } });
    expect(patient).not.toBeNull();

    const validRecordId = `REC-SYNC-${Date.now().toString().slice(-5)}`;
    const tamperedRecordId = `REC-BAD-${Date.now().toString().slice(-5)}`;
    const startedAt = new Date();

    try {
      const validBundle = await encryptMedicalRecordPayload(
        {
          subjective: "Uji sinkronisasi PWA Background Sync dari IndexedDB ke PostgreSQL.",
          vitalSigns: { systolic: 128, diastolic: 82, heartRate: 76, temperature: 36.6, spo2: 99 },
          assessment: { icd10: "I10", desc: "Hipertensi Esensial (Sync Test)" },
          plan: { resep: ["Amlodipine 10mg 1x1"], tindakan: "Observasi" },
        },
        patient!.encryptionKeyHex,
        { patientId: "P-101", recordId: validRecordId, version: 1 }
      );

      // Tamper HMAC 1 byte -> wajib ditolak 422
      const tamperedReq = new NextRequest("http://localhost:3000/api/sync/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              recordId: tamperedRecordId,
              patientId: "P-101",
              faskesId: "FAS-01",
              primaryIcd10: "I10",
              diagnosisShort: "Tampered Record",
              encryptedPayload: validBundle.encryptedPayload,
              ivHex: validBundle.ivHex,
              hmacDigest: "f".repeat(64),
              version: 1,
            },
          ],
        }),
      });
      const tamperedRes = await outboxSyncPost(tamperedReq);
      expect(tamperedRes.status).toBe(422);

      // Payload sah -> wajib 201 & tersimpan ke tabel medical_records PostgreSQL
      const validReq = new NextRequest("http://localhost:3000/api/sync/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              recordId: validRecordId,
              patientId: "P-101",
              faskesId: "FAS-01",
              primaryIcd10: "I10",
              diagnosisShort: "Hipertensi Esensial (Sync Test)",
              encryptedPayload: validBundle.encryptedPayload,
              ivHex: validBundle.ivHex,
              hmacDigest: validBundle.hmacDigest,
              version: 1,
            },
          ],
        }),
      });
      const validRes = await outboxSyncPost(validReq);
      expect(validRes.status).toBe(201);
      const validJson = await validRes.json();
      expect(validJson.syncedCount).toBe(1);

      const saved = await prisma.medicalRecord.findUnique({ where: { id: validRecordId } });
      expect(saved).not.toBeNull();
      expect(saved?.hmacDigest).toBe(validBundle.hmacDigest);
    } finally {
      await prisma.medicalRecord.deleteMany({ where: { id: { in: [validRecordId, tamperedRecordId] } } });
      await prisma.securityAuditLog.deleteMany({
        where: {
          timestamp: { gte: startedAt },
          OR: [
            { targetResource: { contains: validRecordId } },
            { targetResource: { contains: tamperedRecordId } },
          ],
        },
      });
    }
  });

  test("3. REST /api/attachments menegakkan 401, 400, 404, 201, 200, dan Anti-BOLA 403 antar pasien", async () => {
    currentMockSessionToken = null;
    const unauth = await attachmentsGet(new NextRequest("http://localhost:3000/api/attachments?id=X"));
    expect(unauth.status).toBe(401);

    await loginAs("nakes");
    const badReq = await attachmentsGet(new NextRequest("http://localhost:3000/api/attachments"));
    expect(badReq.status).toBe(400);

    const notFound = await attachmentsGet(
      new NextRequest("http://localhost:3000/api/attachments?id=IMG-NONE-999")
    );
    expect(notFound.status).toBe(404);

    const existingRec = await prisma.medicalRecord.findFirst({ where: { patientId: "P-101" } });
    expect(existingRec).not.toBeNull();

    let createdImgId: string | null = null;
    const startedAt = new Date();
    try {
      const postReq = new NextRequest("http://localhost:3000/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicalRecordId: existingRec!.id,
          title: "Uji Citra Thorax Fase 3",
          type: "RONTGEN",
          encryptedBlobHex: "aabbccddeeff00112233445566778899",
          ivHex: "112233445566778899aabbcc",
          hmacDigest: "ab".repeat(32),
          mimeType: "image/jpeg",
          fileSizeBytes: 1024,
        }),
      });
      const postRes = await attachmentsPost(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      createdImgId = postJson.data.id;
      expect(createdImgId).toBeTruthy();

      // Pasien pemilik (P-101) -> 200 OK
      await loginAs("pasien", { id: "P-101", name: "Budi Santoso", username: "budi" });
      const ownerGet = await attachmentsGet(
        new NextRequest(`http://localhost:3000/api/attachments?id=${createdImgId}`)
      );
      expect(ownerGet.status).toBe(200);

      // Pasien lain (P-102) -> 403 Forbidden (Anti-BOLA)
      await loginAs("pasien", { id: "P-102", name: "Siti Rahmawati", username: "siti" });
      const bolaGet = await attachmentsGet(
        new NextRequest(`http://localhost:3000/api/attachments?id=${createdImgId}`)
      );
      expect(bolaGet.status).toBe(403);
    } finally {
      if (createdImgId) {
        await prisma.medicalImage.deleteMany({ where: { id: createdImgId } });
        await prisma.securityAuditLog.deleteMany({
          where: { timestamp: { gte: startedAt }, targetResource: { contains: createdImgId } },
        });
      }
    }
  });

  test("4. PWA Manifest, Service Worker, Deduplikasi Helper, & Sinkronisasi Tanggal Jadwal Seed", async () => {
    const root = process.cwd();
    const manifestPath = path.join(root, "public", "manifest.json");
    const iconPath = path.join(root, "public", "icon.svg");
    const swPath = path.join(root, "public", "sw.js");

    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(iconPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.short_name).toBe("JagaMedis");
    expect(manifest.start_url).toBe("/beranda");
    expect(manifest.display).toBe("standalone");

    const swSource = fs.readFileSync(swPath, "utf-8");
    expect(swSource).toContain("sync-medical-records");

    // Verifikasi modul tunggal parsePrescriptionDetail
    const parsedRx = parsePrescriptionDetail("Amlodipine 10mg 1x1");
    expect(parsedRx.medicineName).toBe("Amlodipine Besylate");

    // Verifikasi nol duplikasi `function safeRevalidate` di lib/actions/
    const actionDir = path.join(root, "lib", "actions");
    for (const file of fs.readdirSync(actionDir)) {
      if (!file.endsWith(".ts")) continue;
      const content = fs.readFileSync(path.join(actionDir, file), "utf-8");
      expect(content).not.toContain("function safeRevalidate");
    }

    // Verifikasi sinkronisasi tanggal jadwal seed APT-2026-001 dengan hari ini
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const apt001 = await prisma.appointment.findUnique({ where: { id: "APT-2026-001" } });
    expect(apt001?.tanggal.toISOString().split("T")[0]).toBe(todayIso);
  });
});
