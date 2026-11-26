import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedSession } from "@/features/auth/guard";
import { AccountStatus, AppointmentStatus, AuditAction, FaskesStatus, TicketStatus } from "@prisma/client";
import type { UserSession } from "@/lib/auth/auth";

export interface BerandaAppointmentRow {
  id: string;
  patientId: string;
  pasienNama: string;
  faskesNama: string;
  poli: string;
  tanggal: string;
  jam: string;
  keluhanAwal: string;
  status: string;
  triaseLevel: string;
}

export interface BerandaServerData {
  session: UserSession;
  role: "pasien" | "staf" | "nakes" | "admin";
  metrics: {
    primary: { label: string; value: string; caption: string; tone: "emerald" | "blue" | "amber" | "purple" };
    secondary: { label: string; value: string; caption: string; tone: "emerald" | "blue" | "amber" | "purple" };
    tertiary: { label: string; value: string; caption: string; tone: "emerald" | "blue" | "amber" | "purple" };
    quaternary: { label: string; value: string; caption: string; tone: "emerald" | "blue" | "amber" | "purple" };
  };
  appointments: BerandaAppointmentRow[];
  recentSecurityLogs: Array<{
    id: string;
    action: string;
    actorName: string;
    severity: string;
    detail: string;
    timestamp: string;
  }>;
}

export async function getBerandaServerData(): Promise<BerandaServerData | null> {
  const auth = await getAuthenticatedSession();
  if (!auth) return null;

  const { session, role } = auth;

  if (role === "nakes") {
    const [appointments, totalPatients, faskesCount, recordsCount] = await Promise.all([
      prisma.appointment.findMany({
        where: { OR: [{ doctorId: session.id }, { dpjpId: session.id }] },
        include: {
          patient: { select: { name: true } },
          faskes: { select: { nama: true } },
          triageAssessment: { select: { triaseLevel: true } },
        },
        orderBy: [{ tanggal: "asc" }, { jam: "asc" }],
        take: 8,
      }),
      prisma.patient.count(),
      prisma.faskes.count({ where: { status: FaskesStatus.ACTIVE } }),
      prisma.medicalRecord.count({ where: { doctorId: session.id } }),
    ]);

    const pendingSign = appointments.filter(
      (a) =>
        a.status === AppointmentStatus.WAITING_DOCTOR ||
        a.status === AppointmentStatus.IN_EXAMINATION ||
        a.status === AppointmentStatus.IN_PROGRESS
    ).length;

    return {
      session,
      role,
      metrics: {
        primary: {
          label: "Antrean Praktik",
          value: `${appointments.length} Pasien`,
          caption: "Jadwal konsultasi aktif dari PostgreSQL.",
          tone: "emerald",
        },
        secondary: {
          label: "Total Pasien Terdaftar",
          value: `${totalPatients} Pasien`,
          caption: "Terlindungi Zero-Knowledge AEAD.",
          tone: "blue",
        },
        tertiary: {
          label: "Menunggu TTD SOAP",
          value: `${pendingSign} Berkas`,
          caption: "Memerlukan tanda tangan klinis DPJP.",
          tone: "amber",
        },
        quaternary: {
          label: "RME Ditandatangani",
          value: `${recordsCount} Berkas`,
          caption: `Faskes aktif dalam jaringan: ${faskesCount}.`,
          tone: "purple",
        },
      },
      appointments: appointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        pasienNama: a.patient.name,
        faskesNama: a.faskes.nama,
        poli: a.poli,
        tanggal: a.tanggal.toISOString().split("T")[0],
        jam: a.jam,
        keluhanAwal: a.keluhanAwal,
        status: a.status,
        triaseLevel: a.triageAssessment?.triaseLevel || "HIJAU",
      })),
      recentSecurityLogs: [],
    };
  }

  if (role === "pasien") {
    const [appointments, recordsCount, activeGrantsCount, auditCount] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: session.id },
        include: {
          patient: { select: { name: true } },
          faskes: { select: { nama: true } },
          triageAssessment: { select: { triaseLevel: true } },
        },
        orderBy: { tanggal: "desc" },
        take: 6,
      }),
      prisma.medicalRecord.count({ where: { patientId: session.id } }),
      prisma.accessGrant.count({
        where: { patientId: session.id, isRevoked: false, validUntil: { gt: new Date() } },
      }),
      prisma.securityAuditLog.count({
        where: {
          OR: [{ actorId: session.id }, { targetResource: { contains: session.id } }],
        },
      }),
    ]);

    return {
      session,
      role,
      metrics: {
        primary: {
          label: "Rekam Medis Terenkripsi",
          value: `${recordsCount} Berkas`,
          caption: "Dilindungi AES-256-GCM + HKDF + HMAC.",
          tone: "emerald",
        },
        secondary: {
          label: "Jadwal Kunjungan",
          value: `${appointments.length} Tiket`,
          caption: "Terhubung langsung ke loket faskes.",
          tone: "blue",
        },
        tertiary: {
          label: "Izin Consent Aktif",
          value: `${activeGrantsCount} Entitas`,
          caption: "Dapat dicabut seketika (UU PDP 27/2022).",
          tone: "amber",
        },
        quaternary: {
          label: "Jejak Audit Akses",
          value: `${auditCount} Peristiwa`,
          caption: "Transparansi log pembukaan RME.",
          tone: "purple",
        },
      },
      appointments: appointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        pasienNama: a.patient.name,
        faskesNama: a.faskes.nama,
        poli: a.poli,
        tanggal: a.tanggal.toISOString().split("T")[0],
        jam: a.jam,
        keluhanAwal: a.keluhanAwal,
        status: a.status,
        triaseLevel: a.triageAssessment?.triaseLevel || "HIJAU",
      })),
      recentSecurityLogs: [],
    };
  }

  if (role === "staf") {
    const appointments = await prisma.appointment.findMany({
      include: {
        patient: { select: { name: true } },
        faskes: { select: { nama: true } },
        triageAssessment: { select: { triaseLevel: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    const pendingArrival = appointments.filter(
      (a) => a.status === AppointmentStatus.PENDING_ARRIVAL
    ).length;
    const waitingTriage = appointments.filter(
      (a) => a.status === AppointmentStatus.WAITING_TRIAGE
    ).length;
    const waitingDoctor = appointments.filter(
      (a) => a.status === AppointmentStatus.WAITING_DOCTOR
    ).length;
    const inExam = appointments.filter(
      (a) => a.status === AppointmentStatus.IN_EXAMINATION || a.status === AppointmentStatus.IN_PROGRESS
    ).length;

    return {
      session,
      role,
      metrics: {
        primary: {
          label: "Menunggu Check-In",
          value: `${pendingArrival} Pasien`,
          caption: "Antrean booking daring siap registrasi.",
          tone: "blue",
        },
        secondary: {
          label: "Antrean Triase",
          value: `${waitingTriage} Pasien`,
          caption: "Menunggu pengukuran tanda vital.",
          tone: "amber",
        },
        tertiary: {
          label: "Siap Assign DPJP",
          value: `${waitingDoctor} Pasien`,
          caption: "Triase selesai, perlu verifikasi PIN.",
          tone: "emerald",
        },
        quaternary: {
          label: "Sedang Diperiksa",
          value: `${inExam} Pasien`,
          caption: "Berada di ruang konsultasi dokter.",
          tone: "purple",
        },
      },
      appointments: appointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        pasienNama: a.patient.name,
        faskesNama: a.faskes.nama,
        poli: a.poli,
        tanggal: a.tanggal.toISOString().split("T")[0],
        jam: a.jam,
        keluhanAwal: a.keluhanAwal,
        status: a.status,
        triaseLevel: a.triageAssessment?.triaseLevel || "HIJAU",
      })),
      recentSecurityLogs: [],
    };
  }

  // Role: admin
  const [kycPending, kydPending, idorBlocked, openTickets, recentLogs] = await Promise.all([
    prisma.kycSubmission.count({ where: { status: AccountStatus.PENDING } }),
    prisma.kydSubmission.count({ where: { status: AccountStatus.PENDING } }),
    prisma.securityAuditLog.count({ where: { action: AuditAction.IDOR_BLOCKED } }),
    prisma.troubleTicket.count({ where: { status: { not: TicketStatus.RESOLVED } } }),
    prisma.securityAuditLog.findMany({ orderBy: { timestamp: "desc" }, take: 5 }),
  ]);

  return {
    session,
    role: "admin",
    metrics: {
      primary: {
        label: "Antrean e-KYC Pasien",
        value: `${kycPending} Berkas`,
        caption: "Menunggu verifikasi identitas Dukcapil.",
        tone: "blue",
      },
      secondary: {
        label: "Antrean e-KYD Dokter",
        value: `${kydPending} Berkas`,
        caption: "Validasi STR/SIP dokter nasional.",
        tone: "emerald",
      },
      tertiary: {
        label: "Blokir BOLA/IDOR",
        value: `${idorBlocked} Insiden`,
        caption: "Tercatat otomatis di SIEM PostgreSQL.",
        tone: "amber",
      },
      quaternary: {
        label: "Tiket Kendala Aktif",
        value: `${openTickets} Tiket`,
        caption: "Terpantau di Pusat Insiden Regulator.",
        tone: "purple",
      },
    },
    appointments: [],
    recentSecurityLogs: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      actorName: l.actorName,
      severity: l.severity,
      detail: l.detail,
      timestamp: l.timestamp.toLocaleString("id-ID"),
    })),
  };
}
