import { describe, test, expect, vi, afterAll } from "vitest";
import { AccountStatus, AppointmentStatus, FaskesStatus, Gender } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { registerSessionAsync, revokeSessionAsync } from "../lib/auth/sessionStore";

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

import {
  getAdminDashboardSummaryServerAction,
  getSiemAuditLogsServerAction,
  getKydSubmissionsServerAction,
} from "../lib/actions/admin";
import {
  createAppointmentServerAction,
  checkInAppointmentServerAction,
  createWalkInAppointmentServerAction,
  assignDpjpServerAction,
} from "../lib/actions/appointment";
import { submitTriageServerAction } from "../lib/actions/triage";
import {
  getAppointmentForExamServerAction,
  submitPemeriksaanKlinisAction,
} from "../lib/actions/clinical";
import { toggleFaskesKillSwitchServerAction } from "../lib/actions/faskes";
import { rejectKycServerAction, submitKycVerificationServerAction } from "../lib/actions/auth";

describe("Fase 2 Quality Gates — Eliminasi Split-Brain & Integritas Alur End-to-End 4 Peran (100% PostgreSQL)", () => {
  const createdSessionTokens: string[] = [];

  async function loginAs(
    role: "pasien" | "staf" | "nakes" | "admin",
    overrides: Partial<{
      id: string;
      name: string;
      username: string;
      faskesId: string;
      faskesName: string;
    }> = {}
  ) {
    const defaults = {
      pasien: { id: "P-101", name: "Budi Santoso", username: "budi" },
      staf: {
        id: "STF-01",
        name: "Ns. Rina Wati, S.Kep",
        username: "staf_rina",
        faskesId: "FAS-01",
        faskesName: "RSUP Dr. Sardjito",
      },
      nakes: {
        id: "DOC-01",
        name: "dr. Andi Pratama, Sp.PD",
        username: "dr_andi",
        faskesId: "FAS-01",
        faskesName: "RSUP Dr. Sardjito",
      },
      admin: { id: "ADM-01", name: "Admin Regulator Kemenkes", username: "admin" },
    }[role];

    const token = `phase2-test-${role}-${crypto.randomUUID()}`;
    await registerSessionAsync(
      token,
      {
        ...defaults,
        ...overrides,
        role,
        status: "VERIFIED",
      },
      3600
    );
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

  test("1. Seluruh Server Actions baru Fase 2 (Admin, Staf, Ruang Periksa) menolak tegas tanpa sesi (401)", async () => {
    currentMockSessionToken = null;

    const adminSummary = await getAdminDashboardSummaryServerAction();
    expect(adminSummary.success).toBe(false);
    expect(adminSummary.message).toContain("401");

    const siemLogs = await getSiemAuditLogsServerAction();
    expect(siemLogs.success).toBe(false);
    expect(siemLogs.message).toContain("401");

    const kydSubs = await getKydSubmissionsServerAction();
    expect(kydSubs.success).toBe(false);
    expect(kydSubs.message).toContain("401");

    const examData = await getAppointmentForExamServerAction("APT-2026-001");
    expect(examData.success).toBe(false);
    expect(examData.message).toContain("401");

    const checkIn = await checkInAppointmentServerAction("APT-2026-001");
    expect(checkIn.success).toBe(false);
    expect(checkIn.message).toContain("401");

    const walkIn = await createWalkInAppointmentServerAction({
      pasienNik: "3171011234560001",
      pasienNama: "Test Walk-In",
      poli: "Poli Umum",
      keluhanAwal: "Demam tinggi",
    });
    expect(walkIn.success).toBe(false);
    expect(walkIn.message).toContain("401");
  });

  test("2. Alur End-to-End 4 Peran 100% PostgreSQL: Booking (+Auto-Consent) -> Check-In -> Triase Atomik -> Assign DPJP ber-PIN -> Periksa SOAP AEAD -> Audit SIEM", async () => {
    let createdAptId: string | null = null;
    let createdRecordId: string | null = null;
    const testStartedAt = new Date();

    try {
      // A. PASIEN: Booking jadwal + Auto-Consent ke PostgreSQL
      await loginAs("pasien");
      const todayIso = new Date().toISOString().split("T")[0];
      const bookingRes = await createAppointmentServerAction({
        faskesId: "FAS-01",
        dokterId: "DOC-01",
        poli: "Poli Penyakit Dalam",
        tanggal: todayIso,
        jam: "10:30",
        keluhanAwal: "Sesak napas dan nyeri dada mendadak (uji Fase 2)",
        autoConsent: true,
      });

      expect(bookingRes.success).toBe(true);
      const aptData = bookingRes.data as { id: string; consentPin: string; status: string };
      expect(aptData.id).toBeTruthy();
      expect(aptData.consentPin).toMatch(/^\d{6}$/);
      expect(aptData.status).toBe(AppointmentStatus.PENDING_ARRIVAL);
      createdAptId = aptData.id;

      // Pastikan Auto-Consent benar-benar tersimpan di tabel access_grants PostgreSQL
      const autoGrant = await prisma.accessGrant.findFirst({
        where: {
          patientId: "P-101",
          scope: { contains: createdAptId },
        },
      });
      expect(autoGrant).not.toBeNull();
      expect(autoGrant?.isRevoked).toBe(false);

      // B. STAF: Check-In Loket -> WAITING_TRIAGE
      await loginAs("staf");
      const checkInRes = await checkInAppointmentServerAction(createdAptId);
      expect(checkInRes.success).toBe(true);

      const afterCheckIn = await prisma.appointment.findUnique({ where: { id: createdAptId } });
      expect(afterCheckIn?.status).toBe(AppointmentStatus.WAITING_TRIAGE);

      // C. STAF: Pengkajian Triase MERAH -> Atomik ke WAITING_DOCTOR
      const triageRes = await submitTriageServerAction(createdAptId, {
        systolic: 185,
        diastolic: 112,
        heartRate: 124,
        temperature: 38.7,
        respiratoryRate: 26,
        spo2: 89,
        beratBadan: 70,
        tinggiBadan: 170,
        triaseLevel: "MERAH",
        catatanPerawat: "Desaturasi SpO2 89% dan krisis hipertensi — prioritas IGD",
      });
      expect(triageRes.success).toBe(true);

      const afterTriage = await prisma.appointment.findUnique({
        where: { id: createdAptId },
        include: { triageAssessment: true },
      });
      expect(afterTriage?.status).toBe(AppointmentStatus.WAITING_DOCTOR);
      expect(afterTriage?.triageAssessment?.triaseLevel).toBe("MERAH");
      expect(afterTriage?.triageAssessment?.spo2).toBe(89);

      // D. STAF: Assign DPJP gagal jika PIN salah, lulus jika PIN 6-digit persis
      const badPinRes = await assignDpjpServerAction({
        aptId: createdAptId,
        doctorId: "DOC-01",
        inputPin: "000000",
      });
      expect(badPinRes.success).toBe(false);

      const goodPinRes = await assignDpjpServerAction({
        aptId: createdAptId,
        doctorId: "DOC-01",
        inputPin: aptData.consentPin,
      });
      expect(goodPinRes.success).toBe(true);

      const afterAssign = await prisma.appointment.findUnique({ where: { id: createdAptId } });
      expect(afterAssign?.status).toBe(AppointmentStatus.IN_EXAMINATION);
      expect(afterAssign?.dpjpId).toBe("DOC-01");

      // E. DOKTER: Muat ruang periksa dari PostgreSQL & simpan SOAP terenkripsi AEAD
      await loginAs("nakes");
      const examLoad = await getAppointmentForExamServerAction(createdAptId);
      expect(examLoad.success).toBe(true);
      expect(examLoad.data?.appointment.triaseLevel).toBe("MERAH");
      expect(examLoad.data?.appointment.triaseVitals?.spo2).toBe(89);

      const formData = new FormData();
      formData.set("patientId", "P-101");
      formData.set("bookingId", createdAptId);
      formData.set("subjective", "Pasien datang dengan sesak napas dan tensi 185/112 mmHg.");
      formData.set("systolic", "185");
      formData.set("diastolic", "112");
      formData.set("heartRate", "124");
      formData.set("temperature", "38.7");
      formData.set("respiratoryRate", "26");
      formData.set("spo2", "89");
      formData.set("icd10", "I10");
      formData.set("assessment", "Krisis Hipertensi + Desaturasi");
      formData.set("planPrescription", "Amlodipine 10mg 1x1\nOksigen nasal kanul 4 L/menit");
      formData.set("planAction", "Observasi ketat di IGD dan kontrol poli 3 hari lagi");
      formData.set("isMedicallyConfirmed", "true");
      formData.set("skipRedirect", "true");

      const soapRes = await submitPemeriksaanKlinisAction(null, formData);
      expect(soapRes.success).toBe(true);
      createdRecordId = soapRes.data?.recordId || null;
      expect(createdRecordId).toBeTruthy();

      const afterExam = await prisma.appointment.findUnique({ where: { id: createdAptId } });
      expect(afterExam?.status).toBe(AppointmentStatus.COMPLETED);

      // F. ADMIN: Verifikasi dashboard summary & SIEM log PostgreSQL
      await loginAs("admin");
      const adminSummary = await getAdminDashboardSummaryServerAction();
      expect(adminSummary.success).toBe(true);
      expect(adminSummary.data?.faskesList.length).toBeGreaterThan(0);

      const siem = await getSiemAuditLogsServerAction();
      expect(siem.success).toBe(true);
      expect(
        siem.data.some((l) => l.action === "WRITE_RME" && l.detail.includes(createdRecordId!))
      ).toBe(true);
    } finally {
      if (createdRecordId) {
        await prisma.medicalRecord.deleteMany({ where: { id: createdRecordId } });
      }
      if (createdAptId) {
        await prisma.medicalRecord.deleteMany({ where: { appointmentId: createdAptId } });
        await prisma.activeEncounter.deleteMany({ where: { appointmentId: createdAptId } });
        await prisma.triageAssessment.deleteMany({ where: { appointmentId: createdAptId } });
        await prisma.accessGrant.deleteMany({
          where: { patientId: "P-101", scope: { contains: createdAptId } },
        });
        await prisma.appointment.deleteMany({ where: { id: createdAptId } });
      }
      await prisma.securityAuditLog.deleteMany({
        where: {
          timestamp: { gte: testStartedAt },
          detail: { contains: createdAptId || "__none__" },
        },
      });
      if (createdRecordId) {
        await prisma.securityAuditLog.deleteMany({
          where: {
            timestamp: { gte: testStartedAt },
            detail: { contains: createdRecordId },
          },
        });
      }
    }
  });

  test("3. Penegakan Kill-Switch Siber: Faskes QUARANTINED memblokir booking pasien & penulisan RME dokter di server", async () => {
    const testFaskesId = "FAS-02";
    const originalFaskes = await prisma.faskes.findUnique({ where: { id: testFaskesId } });
    const startedAt = new Date();

    try {
      // Admin aktifkan Kill-Switch pada FAS-02
      await loginAs("admin");
      const qRes = await toggleFaskesKillSwitchServerAction(testFaskesId, FaskesStatus.QUARANTINED);
      expect(qRes.success).toBe(true);

      // Pasien mencoba booking di FAS-02 -> wajib ditolak server
      await loginAs("pasien");
      const blockedBooking = await createAppointmentServerAction({
        faskesId: testFaskesId,
        dokterId: "DOC-02",
        poli: "Poli Jantung",
        tanggal: new Date().toISOString().split("T")[0],
        jam: "09:00",
        keluhanAwal: "Kontrol rutin jantung",
        autoConsent: true,
      });
      expect(blockedBooking.success).toBe(false);
      expect(blockedBooking.message).toContain("KARANTINA");

      // Dokter di FAS-02 mencoba menandatangani RME -> wajib ditolak server (403 Kill-Switch)
      await loginAs("nakes", {
        id: "DOC-02",
        name: "dr. Siti Rahma, Sp.JP",
        username: "dr_siti",
        faskesId: testFaskesId,
        faskesName: originalFaskes?.nama || "RS Swasta",
      });
      const formData = new FormData();
      formData.set("patientId", "P-101");
      formData.set("subjective", "Kontrol pasca perawatan kardiologi.");
      formData.set("systolic", "125");
      formData.set("diastolic", "80");
      formData.set("heartRate", "78");
      formData.set("temperature", "36.6");
      formData.set("spo2", "98");
      formData.set("icd10", "I10");
      formData.set("planPrescription", "Bisoprolol 5mg 1x1");
      formData.set("isMedicallyConfirmed", "true");
      formData.set("skipRedirect", "true");

      const blockedSoap = await submitPemeriksaanKlinisAction(null, formData);
      expect(blockedSoap.success).toBe(false);
      expect(blockedSoap.message).toContain("KARANTINA");
    } finally {
      // Pulihkan status faskes semula
      await prisma.faskes.update({
        where: { id: testFaskesId },
        data: { status: originalFaskes?.status || FaskesStatus.ACTIVE },
      });
      await prisma.securityAuditLog.deleteMany({
        where: {
          timestamp: { gte: startedAt },
          targetResource: { contains: testFaskesId },
        },
      });
    }
  });

  test("4. Siklus Status e-KYC: Pengajuan tidak menimpa NIK sebelum disetujui & Penolakan persisten berstatus REJECTED", async () => {
    const suffix = Date.now().toString().slice(-5);
    const tempUserId = `P-T${suffix}`;
    const originalNik = `TEMP-${suffix}`;
    let createdKycId: string | null = null;

    try {
      await prisma.user.create({
        data: {
          id: tempUserId,
          username: `test_kyc_${suffix}`,
          email: `test_kyc_${suffix}@example.com`,
          passwordHash: "$2b$10$dummyhashfortestonly0000000000000000000000000000000",
          role: "pasien",
          status: AccountStatus.PENDING,
        },
      });
      await prisma.patient.create({
        data: {
          id: tempUserId,
          userId: tempUserId,
          nik: originalNik,
          name: "Pasien Uji KYC",
          birthDate: new Date("1995-05-05"),
          mrn: `MRN-T-${suffix}`,
          gender: Gender.L,
          bloodType: "O+",
          emergencyContactName: "Keluarga",
          emergencyContactRelation: "Orang Tua",
          emergencyContactPhone: "08123456789",
          encryptionKeyHex: "a".repeat(64),
        },
      });

      // Pasien mengajukan e-KYC dengan NIK baru -> TIDAK boleh langsung menimpa `patient.nik`
      await loginAs("pasien", {
        id: tempUserId,
        name: "Pasien Uji KYC",
        username: `test_kyc_${suffix}`,
      });
      const submitRes = await submitKycVerificationServerAction({
        userId: tempUserId,
        nik: `31710199999${suffix}`,
        namaLengkap: "Pasien Uji KYC Resmi",
        tanggalLahir: "1995-05-05",
        alamat: "Jl. Malioboro No. 10, Yogyakarta",
        ktpUrl: "/uploads/ktp_uji.jpg",
        selfieUrl: "/uploads/selfie_uji.jpg",
      });
      expect(submitRes.success).toBe(true);

      const patientBeforeApproval = await prisma.patient.findUnique({ where: { id: tempUserId } });
      expect(patientBeforeApproval?.nik.trim()).toBe(originalNik);

      const kycRow = await prisma.kycSubmission.findFirst({
        where: { userId: tempUserId },
        orderBy: { submittedAt: "desc" },
      });
      expect(kycRow).not.toBeNull();
      createdKycId = kycRow!.id;

      // Admin menolak e-KYC -> status wajib REJECTED (bukan SUSPENDED) dan persisten di DB
      await loginAs("admin");
      const rejectRes = await rejectKycServerAction(
        createdKycId,
        "Foto e-KTP buram dan tidak terbaca jelas."
      );
      expect(rejectRes.success).toBe(true);

      const persistedKyc = await prisma.kycSubmission.findUnique({ where: { id: createdKycId } });
      const persistedUser = await prisma.user.findUnique({ where: { id: tempUserId } });
      expect(persistedKyc?.status).toBe(AccountStatus.REJECTED);
      expect(persistedKyc?.alasanPenolakan).toContain("buram");
      expect(persistedUser?.status).toBe(AccountStatus.REJECTED);
    } finally {
      if (createdKycId) {
        await prisma.kycSubmission.deleteMany({ where: { id: createdKycId } });
      }
      await prisma.patient.deleteMany({ where: { id: tempUserId } });
      await prisma.user.deleteMany({ where: { id: tempUserId } });
    }
  });
});
