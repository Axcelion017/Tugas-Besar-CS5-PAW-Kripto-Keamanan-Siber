import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  AppointmentStatus,
  FaskesStatus,
  FaskesType,
  GrantEntityType,
  Prisma,
  TicketCategory,
  TicketStatus,
  TriaseLevel,
} from "@prisma/client";
import { encryptMedicalRecordPayload } from "@/features/medical-records/crypto-service";

const mockPrisma = vi.hoisted(() => ({
  faskes: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  doctor: {
    findUnique: vi.fn(),
  },
  patient: {
    findUnique: vi.fn(),
  },
  staffMember: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  appointment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  triageAssessment: {
    upsert: vi.fn(),
  },
  activeEncounter: {
    upsert: vi.fn(),
  },
  medicalRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  accessGrant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  familyMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  troubleTicket: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockGetSession = vi.hoisted(() => vi.fn());
const mockAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/sessionStore", () => ({
  getSessionFromStoreAsync: mockGetSession,
}));
vi.mock("@/features/auth/guard", () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue(null),
  recordSecurityAuditBestEffort: mockAudit,
}));
vi.mock("@/lib/utils/revalidate", () => ({
  safeRevalidate: vi.fn(),
}));

import { PROBLEM_CONTENT_TYPE, prismaErrorToProblem } from "@/lib/api/problem";
import { GET as getFaskesList, POST as createFaskes } from "@/app/api/v1/faskes/route";
import { GET as getFaskesById, DELETE as deleteFaskes } from "@/app/api/v1/faskes/[id]/route";
import { PATCH as patchFaskesQuarantine } from "@/app/api/v1/faskes/[id]/quarantine/route";
import { POST as createAppointment } from "@/app/api/v1/appointments/route";
import { DELETE as deleteAppointment } from "@/app/api/v1/appointments/[id]/route";
import { PUT as putTriage } from "@/app/api/v1/appointments/[id]/triage/route";
import { POST as postAssignDpjp } from "@/app/api/v1/appointments/[id]/assign-dpjp/route";
import { GET as getMedicalRecordById } from "@/app/api/v1/medical-records/[id]/route";
import { POST as postAddendum } from "@/app/api/v1/medical-records/[id]/addenda/route";
import { POST as revokeAccessGrant } from "@/app/api/v1/access-grants/[id]/revoke/route";
import {
  GET as getFamilyMembers,
  POST as postFamilyMember,
} from "@/app/api/v1/patients/me/family-members/route";
import { DELETE as deleteFamilyMember } from "@/app/api/v1/patients/me/family-members/[id]/route";
import { POST as postTroubleTicket } from "@/app/api/v1/trouble-tickets/route";
import { DELETE as deleteTroubleTicket } from "@/app/api/v1/trouble-tickets/[id]/route";

function makeRequest(
  path: string,
  options: {
    method?: string;
    body?: string;
    token?: string;
    contentType?: string;
  } = {}
): NextRequest {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", options.contentType ?? "application/json");
  }
  if (options.token) {
    headers.set("cookie", `resilio_session_token=${options.token}`);
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });
}

const TEST_MASTER_KEY = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("REST API v1 — RFC 9457 Problem Details & Core Opsi A Contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
  });

  describe("1. Standar Galat RFC 9457 (400, 404, 409, 422)", () => {
    it("mengembalikan 400 application/problem+json saat body bukan JSON valid", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });

      const req = makeRequest("/api/v1/trouble-tickets", {
        method: "POST",
        body: "{kategori: rusak-bukan-json",
        token: "tok-pasien",
      });

      const res = await postTroubleTicket(req);
      expect(res.status).toBe(400);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      const body = await res.json();
      expect(body.type).toBe("https://jagamedis.id/problems/invalid-json");
      expect(body.status).toBe(400);
      expect(body.instance).toBe("/api/v1/trouble-tickets");
    });

    it("mengembalikan 422 application/problem+json untuk JSON valid dengan kategori tidak dikenal", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });

      const req = makeRequest("/api/v1/trouble-tickets", {
        method: "POST",
        token: "tok-pasien",
        body: JSON.stringify({
          kategori: "KATEGORI_TIDAK_DIKENAL",
          judul: "Laporan kendala aplikasi",
          deskripsi: "Deskripsi cukup panjang untuk lolos validasi panjang teks.",
        }),
      });

      const res = await postTroubleTicket(req);
      expect(res.status).toBe(422);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      const body = await res.json();
      expect(body.type).toBe("https://jagamedis.id/problems/validation-error");
      expect(body.errors?.[0]?.field).toBe("kategori");
    });

    it("mengembalikan 404 application/problem+json untuk ID yang tidak ada setelah await params", async () => {
      mockPrisma.faskes.findUnique.mockResolvedValue(null);

      const req = makeRequest("/api/v1/faskes/FAS-999999");
      const res = await getFaskesById(req, { params: Promise.resolve({ id: "FAS-999999" }) });

      expect(res.status).toBe(404);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      const body = await res.json();
      expect(body.type).toBe("https://jagamedis.id/problems/not-found");
      expect(body.title).toBe("Resource Not Found");
      expect(body.status).toBe(404);
      expect(body.instance).toBe("/api/v1/faskes/FAS-999999");
    });

    it("mengembalikan 400 application/problem+json jika parameter ID mengandung karakter tidak sah", async () => {
      const req = makeRequest("/api/v1/faskes/..%2Fetc");
      const res = await getFaskesById(req, { params: Promise.resolve({ id: "../etc" }) });

      expect(res.status).toBe(400);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      expect(mockPrisma.faskes.findUnique).not.toHaveBeenCalled();
    });

    it("mengembalikan 409 application/problem+json saat menghapus faskes yang masih memiliki relasi", async () => {
      mockGetSession.mockResolvedValue({ id: "ADM-01", name: "Admin Kemenkes", role: "admin" });
      mockPrisma.faskes.findUnique.mockResolvedValue({
        id: "FAS-01",
        nama: "RSUP Dr. Hasan Sadikin",
        _count: { doctors: 2, staffMembers: 1, appointments: 4, medicalRecords: 3 },
      });

      const req = makeRequest("/api/v1/faskes/FAS-01", { method: "DELETE", token: "tok-admin" });
      const res = await deleteFaskes(req, { params: Promise.resolve({ id: "FAS-01" }) });

      expect(res.status).toBe(409);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      const body = await res.json();
      expect(body.type).toBe("https://jagamedis.id/problems/conflict");
      expect(mockPrisma.faskes.delete).not.toHaveBeenCalled();
    });

    it("memetakan Prisma P2003 ke 409 Conflict dan P2025 ke 404 Not Found", async () => {
      const p2003 = new Prisma.PrismaClientKnownRequestError("FK constraint", {
        code: "P2003",
        clientVersion: "7.10.1",
      });
      const res409 = prismaErrorToProblem(p2003, "/api/v1/faskes/FAS-01", "Faskes");
      expect(res409.status).toBe(409);
      expect(res409.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);

      const p2025 = new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2025",
        clientVersion: "7.10.1",
      });
      const res404 = prismaErrorToProblem(p2025, "/api/v1/faskes/FAS-999", "Faskes");
      expect(res404.status).toBe(404);
    });
  });

  describe("2. Domain Faskes & Kill-Switch", () => {
    it("mengembalikan 200 daftar faskes dengan filter query valid", async () => {
      mockPrisma.faskes.findMany.mockResolvedValue([
        {
          id: "FAS-01",
          kodeFaskes: "RS-BDG-01",
          nama: "RSUP Dr. Hasan Sadikin",
          tipe: FaskesType.RUMAH_SAKIT,
          alamat: "Jl. Pasteur No. 38",
          kota: "Bandung",
          kontak: "022-2034953",
          spesialisasiList: ["Penyakit Dalam"],
          kategoriPenyakit: ["Hipertensi"],
          status: FaskesStatus.ACTIVE,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          doctors: [],
        },
      ]);

      const req = makeRequest("/api/v1/faskes?kota=Bandung&status=ACTIVE");
      const res = await getFaskesList(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("FAS-01");
    });

    it("menolak POST /api/v1/faskes oleh peran non-admin dengan 403 + SIEM audit", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });
      const req = makeRequest("/api/v1/faskes", {
        method: "POST",
        token: "tok-pasien",
        body: JSON.stringify({}),
      });
      const res = await createFaskes(req);
      expect(res.status).toBe(403);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      expect(mockAudit).toHaveBeenCalledTimes(1);
    });

    it("mengaktifkan karantina faskes melalui PATCH /api/v1/faskes/[id]/quarantine", async () => {
      mockGetSession.mockResolvedValue({ id: "ADM-01", name: "Admin Kemenkes", role: "admin" });
      mockPrisma.faskes.update.mockResolvedValue({
        id: "FAS-01",
        nama: "RSUP Dr. Hasan Sadikin",
        status: FaskesStatus.QUARANTINED,
      });

      const req = makeRequest("/api/v1/faskes/FAS-01/quarantine", {
        method: "PATCH",
        token: "tok-admin",
        body: JSON.stringify({ status: "QUARANTINED", reason: "Deteksi anomali ransomware" }),
      });

      const res = await patchFaskesQuarantine(req, { params: Promise.resolve({ id: "FAS-01" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe("QUARANTINED");
      expect(mockAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Domain Appointments, Triase (PUT Idempoten) & Assign DPJP", () => {
    it("memblokir POST /api/v1/appointments ke faskes berstatus QUARANTINED dengan 403", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });
      mockPrisma.faskes.findUnique.mockResolvedValue({
        id: "FAS-01",
        nama: "RS Karantina",
        status: FaskesStatus.QUARANTINED,
      });
      mockPrisma.doctor.findUnique.mockResolvedValue({
        id: "DOC-01",
        name: "dr. Andi",
        specialty: "Penyakit Dalam",
        faskesId: "FAS-01",
      });
      mockPrisma.patient.findUnique.mockResolvedValue({ id: "PAT-01" });

      const req = makeRequest("/api/v1/appointments", {
        method: "POST",
        token: "tok-pasien",
        body: JSON.stringify({
          faskesId: "FAS-01",
          doctorId: "DOC-01",
          tanggal: "2026-12-01",
          jam: "09:00 WIB",
          keluhanAwal: "Demam tinggi 3 hari berturut-turut",
          autoConsent: true,
        }),
      });

      const res = await createAppointment(req);
      expect(res.status).toBe(403);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("menolak DELETE /api/v1/appointments/[id] dengan 409 jika sudah memiliki rekam medis", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: "APT-001",
        patientId: "PAT-01",
        status: AppointmentStatus.COMPLETED,
        _count: { medicalRecords: 1 },
      });

      const req = makeRequest("/api/v1/appointments/APT-001", {
        method: "DELETE",
        token: "tok-pasien",
      });
      const res = await deleteAppointment(req, { params: Promise.resolve({ id: "APT-001" }) });
      expect(res.status).toBe(409);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("menjalankan PUT /api/v1/appointments/[id]/triage secara idempoten", async () => {
      mockGetSession.mockResolvedValue({
        id: "STF-01",
        name: "Ns. Sari",
        role: "staf",
        faskesId: "FAS-01",
      });
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: "APT-001",
        faskesId: "FAS-01",
        status: AppointmentStatus.WAITING_TRIAGE,
      });
      mockPrisma.staffMember.findUnique.mockResolvedValue({ id: "STF-01" });
      mockPrisma.triageAssessment.upsert.mockResolvedValue({
        id: "TRG-001",
        appointmentId: "APT-001",
        staffId: "STF-01",
        systolic: 145,
        diastolic: 92,
        heartRate: 88,
        temperature: 37.8,
        respiratoryRate: 20,
        spo2: 98,
        beratBadan: 68,
        tinggiBadan: 170,
        triaseLevel: TriaseLevel.KUNING,
        catatanPerawat: "Observasi hipertensi",
        assessedAt: new Date("2026-11-26T10:00:00Z"),
      });
      mockPrisma.appointment.update.mockResolvedValue({
        id: "APT-001",
        status: AppointmentStatus.WAITING_DOCTOR,
      });

      const payload = JSON.stringify({
        systolic: 145,
        diastolic: 92,
        heartRate: 88,
        temperature: 37.8,
        respiratoryRate: 20,
        spo2: 98,
        beratBadan: 68,
        tinggiBadan: 170,
        triaseLevel: "KUNING",
        catatanPerawat: "Observasi hipertensi",
      });

      const res1 = await putTriage(
        makeRequest("/api/v1/appointments/APT-001/triage", {
          method: "PUT",
          token: "tok-staf",
          body: payload,
        }),
        { params: Promise.resolve({ id: "APT-001" }) }
      );
      const res2 = await putTriage(
        makeRequest("/api/v1/appointments/APT-001/triage", {
          method: "PUT",
          token: "tok-staf",
          body: payload,
        }),
        { params: Promise.resolve({ id: "APT-001" }) }
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.data.triaseLevel).toBe("KUNING");
      expect(body2.data.appointmentStatus).toBe("WAITING_DOCTOR");
    });

    it("menolak POST /api/v1/appointments/[id]/assign-dpjp dengan 403 saat PIN 6-digit salah", async () => {
      mockGetSession.mockResolvedValue({ id: "STF-01", name: "Ns. Sari", role: "staf" });
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: "APT-001",
        patientId: "PAT-01",
        status: AppointmentStatus.WAITING_DOCTOR,
        consentPin: "123456",
      });
      mockPrisma.doctor.findUnique.mockResolvedValue({ id: "DOC-01", name: "dr. Andi" });

      const req = makeRequest("/api/v1/appointments/APT-001/assign-dpjp", {
        method: "POST",
        token: "tok-staf",
        body: JSON.stringify({ doctorId: "DOC-01", consentPin: "654321" }),
      });

      const res = await postAssignDpjp(req, { params: Promise.resolve({ id: "APT-001" }) });
      expect(res.status).toBe(403);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    });
  });

  describe("4. Domain Medical Records (Anti-BOLA & Addendum Immutable AEAD+HMAC)", () => {
    it("memblokir pasien membaca RME milik pasien lain (403 + SIEM IDOR_BLOCKED)", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-02", name: "Siti", role: "pasien" });
      mockPrisma.medicalRecord.findUnique.mockResolvedValue({
        id: "REC-001",
        patientId: "PAT-01",
        doctorId: "DOC-01",
        faskesId: "FAS-01",
        patient: {
          id: "PAT-01",
          name: "Budi",
          mrn: "MRN-01",
          bloodType: "O+",
          accessGrants: [],
          appointments: [],
        },
        doctor: { id: "DOC-01", name: "dr. Andi", specialty: "PD", strNumber: "STR-1" },
        faskes: { id: "FAS-01", nama: "RS A", kota: "Bandung" },
        childAddenda: [],
      });

      const req = makeRequest("/api/v1/medical-records/REC-001", { token: "tok-pat02" });
      const res = await getMedicalRecordById(req, { params: Promise.resolve({ id: "REC-001" }) });
      expect(res.status).toBe(403);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      expect(mockAudit).toHaveBeenCalledTimes(1);
    });

    it("menerima POST /api/v1/medical-records/[id]/addenda dengan ciphertext AEAD+HMAC valid (201 + Location)", async () => {
      mockGetSession.mockResolvedValue({
        id: "DOC-01",
        name: "dr. Andi",
        role: "nakes",
        faskesId: "FAS-01",
      });
      mockPrisma.faskes.findUnique.mockResolvedValue({
        id: "FAS-01",
        nama: "RSUP Dr. Hasan Sadikin",
        status: FaskesStatus.ACTIVE,
      });
      mockPrisma.medicalRecord.findUnique.mockResolvedValue({
        id: "REC-001",
        patientId: "PAT-01",
        doctorId: "DOC-01",
        faskesId: "FAS-01",
        appointmentId: "APT-001",
        primaryIcd10: "I10",
        diagnosisShort: "Hipertensi Esensial",
        version: 1,
        claimStatus: "DRAFT",
        patient: {
          id: "PAT-01",
          encryptionKeyHex: TEST_MASTER_KEY,
          accessGrants: [],
          appointments: [],
        },
      });

      const addendumId = "REC-001-V2";
      const encrypted = await encryptMedicalRecordPayload(
        {
          subjective: "Koreksi dosis terapi lanjutan.",
          vitalSigns: { systolic: 130, diastolic: 85, heartRate: 76, temperature: 36.6, spo2: 99 },
          plan: { resep: ["Amlodipine 5mg 1x1"] },
        },
        TEST_MASTER_KEY,
        { patientId: "PAT-01", recordId: addendumId, version: 2 }
      );

      mockPrisma.medicalRecord.create.mockResolvedValue({
        id: addendumId,
        parentRecordId: "REC-001",
        patientId: "PAT-01",
        version: 2,
        addendumReason: "Penyesuaian dosis obat antihipertensi pasca hasil lab",
        primaryIcd10: "I10",
        diagnosisShort: "Hipertensi Esensial",
        createdAt: new Date("2026-11-26T12:00:00Z"),
      });

      const req = makeRequest("/api/v1/medical-records/REC-001/addenda", {
        method: "POST",
        token: "tok-doc01",
        body: JSON.stringify({
          recordId: addendumId,
          addendumReason: "Penyesuaian dosis obat antihipertensi pasca hasil lab",
          encryptedPayload: encrypted.encryptedPayload,
          ivHex: encrypted.ivHex,
          hmacDigest: encrypted.hmacDigest,
        }),
      });

      const res = await postAddendum(req, { params: Promise.resolve({ id: "REC-001" }) });
      expect(res.status).toBe(201);
      expect(res.headers.get("Location")).toBe(`/api/v1/medical-records/${addendumId}`);
      const body = await res.json();
      expect(body.data.version).toBe(2);
      expect(body.data.parentRecordId).toBe("REC-001");
    });
  });

  describe("5. Domain Consent Revoke, Family Proxy & Trouble Tickets", () => {
    it("menolak POST /api/v1/access-grants/[id]/revoke tanpa autentikasi (401)", async () => {
      const req = makeRequest("/api/v1/access-grants/AG-001/revoke", { method: "POST" });
      const res = await revokeAccessGrant(req, { params: Promise.resolve({ id: "AG-001" }) });
      expect(res.status).toBe(401);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("mencabut izin milik pasien sendiri secara sukses (200)", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });
      mockPrisma.accessGrant.findUnique.mockResolvedValue({
        id: "AG-001",
        patientId: "PAT-01",
        entityId: "DOC-01",
        entityName: "dr. Andi",
        entityType: GrantEntityType.DOKTER,
        scope: "READ_RME",
        validUntil: new Date("2026-12-30T00:00:00Z"),
        isRevoked: false,
        revokedAt: null,
        isBreakGlass: false,
        createdAt: new Date("2026-11-26T00:00:00Z"),
      });
      mockPrisma.accessGrant.update.mockResolvedValue({
        id: "AG-001",
        patientId: "PAT-01",
        entityId: "DOC-01",
        entityName: "dr. Andi",
        entityType: GrantEntityType.DOKTER,
        scope: "READ_RME",
        validUntil: new Date("2026-12-30T00:00:00Z"),
        isRevoked: true,
        revokedAt: new Date("2026-11-26T12:00:00Z"),
        isBreakGlass: false,
        createdAt: new Date("2026-11-26T00:00:00Z"),
      });

      const req = makeRequest("/api/v1/access-grants/AG-001/revoke", {
        method: "POST",
        token: "tok-pasien",
      });
      const res = await revokeAccessGrant(req, { params: Promise.resolve({ id: "AG-001" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.isRevoked).toBe(true);
    });

    it("mengelola family-members dengan Anti-BOLA (GET 200, POST 201, DELETE lintas pasien 403)", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });
      mockPrisma.familyMember.findMany.mockResolvedValue([]);

      const listRes = await getFamilyMembers(
        makeRequest("/api/v1/patients/me/family-members", { token: "tok-pasien" })
      );
      expect(listRes.status).toBe(200);

      mockPrisma.familyMember.create.mockResolvedValue({
        id: "FAM-100001",
        patientId: "PAT-01",
        name: "Rina Santoso",
        nik: "3273012203150002",
        relation: "Anak",
        birthDate: new Date("2015-03-22T00:00:00Z"),
        createdAt: new Date("2026-11-26T12:00:00Z"),
      });

      const postRes = await postFamilyMember(
        makeRequest("/api/v1/patients/me/family-members", {
          method: "POST",
          token: "tok-pasien",
          body: JSON.stringify({
            name: "Rina Santoso",
            nik: "3273012203150002",
            relation: "Anak",
            birthDate: "2015-03-22",
          }),
        })
      );
      expect(postRes.status).toBe(201);
      expect(postRes.headers.get("Location")).toBe("/api/v1/patients/me/family-members/FAM-100001");

      mockPrisma.familyMember.findUnique.mockResolvedValue({
        id: "FAM-999999",
        patientId: "PAT-02",
        name: "Milik Orang Lain",
      });

      const delRes = await deleteFamilyMember(
        makeRequest("/api/v1/patients/me/family-members/FAM-999999", {
          method: "DELETE",
          token: "tok-pasien",
        }),
        { params: Promise.resolve({ id: "FAM-999999" }) }
      );
      expect(delRes.status).toBe(403);
      expect(delRes.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    });

    it("menolak DELETE tiket yang sudah INVESTIGATING/RESOLVED dengan 409 Conflict", async () => {
      mockGetSession.mockResolvedValue({ id: "PAT-01", name: "Budi", role: "pasien" });
      mockPrisma.troubleTicket.findUnique.mockResolvedValue({
        id: "TCK-001",
        reporterId: "PAT-01",
        kategori: TicketCategory.BUG,
        status: TicketStatus.RESOLVED,
      });

      const res = await deleteTroubleTicket(
        makeRequest("/api/v1/trouble-tickets/TCK-001", {
          method: "DELETE",
          token: "tok-pasien",
        }),
        { params: Promise.resolve({ id: "TCK-001" }) }
      );
      expect(res.status).toBe(409);
      expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    });
  });
});
