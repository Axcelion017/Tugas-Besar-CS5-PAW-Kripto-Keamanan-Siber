// lib/db/mockData.ts
// Modul data tiruan terpadu untuk mendanai antarmuka multi-role Resilio-Health

export interface Faskes {
  id: string;
  kodeFaskes: string;
  nama: string;
  tipe: "Rumah Sakit" | "Klinik Pratama" | "Puskesmas";
  alamat: string;
  kota: string;
  spesialisasiList: string[];
  kategoriPenyakit: string[];
  status: "ACTIVE" | "QUARANTINED";
  kontak: string;
}

export interface AuthorizedDoctor {
  id: string;
  name: string;
  strNumber: string;
  sipNumber: string;
  specialty: string;
  hospital: string;
  faskesId: string;
  jadwal: { hari: string; jam: string }[];
  kuotaHarian: number;
  kuotaTerisi: number;
  accessStatus: "ACTIVE" | "REVOKED";
  lastAccess: string;
}

export interface Patient {
  id: string;
  nik: string;
  name: string;
  age: number;
  gender: "L" | "P";
  mrn: string;
  bloodType: string;
  allergies: string[];
  emergencyContact: { name: string; relation: string; phone: string };
  lastVisit: string;
  hasAccess: boolean;
  assignedDoctorId?: string;
  encryptionKeyHex: string;
  statusKyc: "VERIFIED" | "PENDING" | "REJECTED";
}

export interface Appointment {
  id: string;
  pasienId: string;
  pasienNama: string;
  pasienNik: string;
  faskesId: string;
  faskesNama: string;
  dokterId: string;
  dokterNama: string;
  poli: string;
  tanggal: string;
  jam: string;
  keluhanAwal: string;
  status: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  consentActive: boolean;
}

export interface VitalSigns {
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  spo2: number;
}

export interface MedicalRecordSOAP {
  subjective: string;
  vitalSigns: VitalSigns;
  assessment: {
    icd10Code: string;
    diagnosisDescription: string;
  };
  plan: {
    tindakan: string;
    resep: string[];
    anjuran: string;
  };
  meta: {
    dokterId: string;
    dokterNama: string;
    dokterStr: string;
    faskesId: string;
    faskesNama: string;
    timestamp: string;
  };
}

export interface EncryptedMedicalRecord {
  recordId: string;
  patientId: string;
  patientName: string;
  faskesId: string;
  faskesNama: string;
  dokterStr: string;
  dokterNama: string;
  primaryIcd10: string;
  diagnosisShort: string;
  encryptedPayload: string;
  ivHex: string;
  hmacDigest: string;
  timestamp: string;
  isOfflineCreated?: boolean;
  version: number;
}

export interface AccessGrant {
  id: string;
  pasienId: string;
  pasienNama: string;
  entityId: string; // Dokter ID atau Faskes ID
  entityNama: string;
  entityType: "DOKTER" | "FASKES";
  scope: string;
  validUntil: string;
  isRevoked: boolean;
  createdAt: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: "PASIEN" | "NAKES" | "ADMIN" | "GATEWAY";
  action: "LOGIN" | "VIEW_RME" | "WRITE_RME" | "IDOR_BLOCKED" | "HMAC_VERIFIED" | "HMAC_MISMATCH" | "REVOKE_CONSENT" | "QUARANTINE_FASKES";
  targetResource: string;
  ipAddress: string;
  userAgent: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  detail: string;
}

export interface KycSubmission {
  id: string;
  userId: string;
  namaLengkap: string;
  nik: string;
  tanggalLahir: string;
  alamat: string;
  ktpUrl: string;
  submittedAt: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  alasanPenolakan?: string;
}

export interface KydSubmission {
  id: string;
  userId: string;
  namaLengkap: string;
  nik: string;
  strNumber: string;
  sipNumber: string;
  spesialisasi: string;
  faskesNama: string;
  dokumenStrUrl: string;
  submittedAt: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  alasanPenolakan?: string;
}

export interface TroubleTicket {
  id: string;
  pengirimId: string;
  pengirimNama: string;
  pengirimRole: string;
  kategori: "BUG" | "SYNC_FAIL" | "DATA_MISMATCH" | "OTHER";
  judul: string;
  deskripsi: string;
  faskesTerkait?: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED";
  createdAt: string;
}

// -------------------------------------------------------------
// DATA AWAL
// -------------------------------------------------------------

export const MOCK_FASKES: Faskes[] = [
  {
    id: "FAS-01",
    kodeFaskes: "RS-SARDJITO-001",
    nama: "RSUP Dr. Sardjito",
    tipe: "Rumah Sakit",
    alamat: "Jl. Kesehatan No. 1, Sendangadi, Sleman",
    kota: "Yogyakarta",
    spesialisasiList: ["Spesialis Penyakit Dalam", "Spesialis Kardiologi", "Spesialis Anak", "Bedah Umum"],
    kategoriPenyakit: ["Hipertensi", "Jantung", "Diabetes", "Penyakit Dalam", "ISPA"],
    status: "ACTIVE",
    kontak: "(0274) 587333",
  },
  {
    id: "FAS-02",
    kodeFaskes: "RS-HARAPAN-002",
    nama: "RS Harapan Sehat",
    tipe: "Rumah Sakit",
    alamat: "Jl. Kaliurang KM 9, Sinduharjo, Ngaglik",
    kota: "Sleman",
    spesialisasiList: ["Spesialis Kardiologi", "Spesialis Penyakit Dalam", "Kesehatan Jiwa"],
    kategoriPenyakit: ["Jantung", "Hipertensi", "Aritmia", "Kolesterol"],
    status: "ACTIVE",
    kontak: "(0274) 889123",
  },
  {
    id: "FAS-03",
    kodeFaskes: "KLN-PRATAMA-003",
    nama: "Klinik Pratama Sehat Mandiri",
    tipe: "Klinik Pratama",
    alamat: "Jl. Gejayan No. 45, Condongcatur, Depok",
    kota: "Sleman",
    spesialisasiList: ["Dokter Umum", "Kesehatan Gigi & Mulut", "Kesehatan Ibu & Anak"],
    kategoriPenyakit: ["Demam", "Flu & Batuk", "Gigi & Mulut", "Gastritis", "ISPA"],
    status: "ACTIVE",
    kontak: "(0274) 556789",
  },
  {
    id: "FAS-04",
    kodeFaskes: "PUSK-MLATI-004",
    nama: "Puskesmas Mlati 1",
    tipe: "Puskesmas",
    alamat: "Jl. Magelang KM 7, Mlati",
    kota: "Sleman",
    spesialisasiList: ["Pelayanan Umum", "Poli Gizi", "Poli Imunisasi"],
    kategoriPenyakit: ["ISPA", "Stunting & Gizi", "Imunisasi", "Pemeriksaan Rutin"],
    status: "ACTIVE",
    kontak: "(0274) 868400",
  },
];

export const MOCK_DOCTORS: AuthorizedDoctor[] = [
  {
    id: "DOC-01",
    name: "dr. Andi Pratama, Sp.PD",
    strNumber: "31.1.1.100.2.22.123456",
    sipNumber: "446/SIP-D/2023/001",
    specialty: "Spesialis Penyakit Dalam",
    hospital: "RSUP Dr. Sardjito",
    faskesId: "FAS-01",
    jadwal: [
      { hari: "Senin", jam: "08:00 - 12:00" },
      { hari: "Rabu", jam: "08:00 - 12:00" },
      { hari: "Jumat", jam: "08:00 - 11:30" },
    ],
    kuotaHarian: 20,
    kuotaTerisi: 14,
    accessStatus: "ACTIVE",
    lastAccess: "10 Oktober 2026, 10:14 WIB",
  },
  {
    id: "DOC-02",
    name: "dr. Ratna Juwita, Sp.JP",
    strNumber: "31.2.1.200.2.21.654321",
    sipNumber: "446/SIP-D/2023/002",
    specialty: "Spesialis Kardiologi",
    hospital: "RS Harapan Sehat",
    faskesId: "FAS-02",
    jadwal: [
      { hari: "Selasa", jam: "13:00 - 17:00" },
      { hari: "Kamis", jam: "13:00 - 17:00" },
    ],
    kuotaHarian: 15,
    kuotaTerisi: 9,
    accessStatus: "ACTIVE",
    lastAccess: "9 Oktober 2026, 14:30 WIB",
  },
  {
    id: "DOC-03",
    name: "dr. Sarah Sp.A",
    strNumber: "31.1.2.300.2.20.789012",
    sipNumber: "446/SIP-D/2022/003",
    specialty: "Spesialis Anak",
    hospital: "Klinik Pratama Sehat Mandiri",
    faskesId: "FAS-03",
    jadwal: [
      { hari: "Senin - Kamis", jam: "09:00 - 13:00" },
    ],
    kuotaHarian: 25,
    kuotaTerisi: 21,
    accessStatus: "ACTIVE",
    lastAccess: "8 Oktober 2026, 11:00 WIB",
  },
  {
    id: "DOC-04",
    name: "dr. Rian Sp.JP",
    strNumber: "31.1.1.400.2.19.112233",
    sipNumber: "446/SIP-D/2021/089",
    specialty: "Spesialis Jantung & Pembuluh Darah",
    hospital: "RSUP Dr. Sardjito",
    faskesId: "FAS-01",
    jadwal: [
      { hari: "Rabu - Jumat", jam: "14:00 - 18:00" },
    ],
    kuotaHarian: 12,
    kuotaTerisi: 12,
    accessStatus: "REVOKED",
    lastAccess: "12 Agustus 2026, 09:15 WIB",
  },
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "P-101",
    nik: "3171012304800001",
    name: "Budi Santoso",
    age: 45,
    gender: "L",
    mrn: "MRN-2026-0081",
    bloodType: "O+",
    allergies: ["Penicillin", "Aspirin"],
    emergencyContact: { name: "Dewi Sartika (Istri)", relation: "Istri", phone: "081234567899" },
    lastVisit: "2026-10-01",
    hasAccess: true,
    assignedDoctorId: "DOC-01",
    encryptionKeyHex: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    statusKyc: "VERIFIED",
  },
  {
    id: "P-102",
    nik: "3171025508920002",
    name: "Siti Rahmawati",
    age: 34,
    gender: "P",
    mrn: "MRN-2026-0082",
    bloodType: "A+",
    allergies: ["Sulfa"],
    emergencyContact: { name: "Hadi Pramono (Suami)", relation: "Suami", phone: "081298765432" },
    lastVisit: "2026-09-28",
    hasAccess: true,
    assignedDoctorId: "DOC-02",
    encryptionKeyHex: "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1",
    statusKyc: "VERIFIED",
  },
  {
    id: "P-103",
    nik: "3171031201750003",
    name: "Ahmad Dahlan",
    age: 51,
    gender: "L",
    mrn: "MRN-2026-0083",
    bloodType: "B+",
    allergies: [],
    emergencyContact: { name: "Anisa (Anak)", relation: "Anak", phone: "081345678912" },
    lastVisit: "2026-09-25",
    hasAccess: true,
    assignedDoctorId: "DOC-01",
    encryptionKeyHex: "c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2",
    statusKyc: "VERIFIED",
  },
  {
    id: "P-104",
    nik: "3171044406980004",
    name: "Dewi Lestari",
    age: 26,
    gender: "P",
    mrn: "MRN-2026-0084",
    bloodType: "AB+",
    allergies: ["Amoxicillin"],
    emergencyContact: { name: "Bambang (Ayah)", relation: "Orang Tua", phone: "081765432109" },
    lastVisit: "2026-09-18",
    hasAccess: false,
    encryptionKeyHex: "d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3",
    statusKyc: "PENDING",
  },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "APT-2026-001",
    pasienId: "P-101",
    pasienNama: "Budi Santoso",
    pasienNik: "3171012304800001",
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterId: "DOC-01",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    poli: "Poli Penyakit Dalam",
    tanggal: "2026-10-15",
    jam: "09:00 WIB",
    keluhanAwal: "Kontrol tensi rutin, kepala terasa berat di bagian tengkuk",
    status: "IN_PROGRESS",
    consentActive: true,
  },
  {
    id: "APT-2026-002",
    pasienId: "P-103",
    pasienNama: "Ahmad Dahlan",
    pasienNik: "3171031201750003",
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterId: "DOC-01",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    poli: "Poli Penyakit Dalam",
    tanggal: "2026-10-15",
    jam: "10:30 WIB",
    keluhanAwal: "Gula darah puasa tinggi dan lemas",
    status: "WAITING",
    consentActive: true,
  },
  {
    id: "APT-2026-003",
    pasienId: "P-102",
    pasienNama: "Siti Rahmawati",
    pasienNik: "3171025508920002",
    faskesId: "FAS-02",
    faskesNama: "RS Harapan Sehat",
    dokterId: "DOC-02",
    dokterNama: "dr. Ratna Juwita, Sp.JP",
    poli: "Poli Kardiologi",
    tanggal: "2026-10-16",
    jam: "14:00 WIB",
    keluhanAwal: "Sesak napas saat menaiki tangga",
    status: "WAITING",
    consentActive: true,
  },
];

export const MOCK_ACCESS_GRANTS: AccessGrant[] = [
  {
    id: "GRANT-01",
    pasienId: "P-101",
    pasienNama: "Budi Santoso",
    entityId: "DOC-01",
    entityNama: "dr. Andi Pratama, Sp.PD",
    entityType: "DOKTER",
    scope: "Baca & Tulis Rekam Medis (Aktif Pemeriksaan)",
    validUntil: "2026-10-16 23:59 WIB",
    isRevoked: false,
    createdAt: "2026-10-15 08:00 WIB",
  },
  {
    id: "GRANT-02",
    pasienId: "P-101",
    pasienNama: "Budi Santoso",
    entityId: "FAS-01",
    entityNama: "RSUP Dr. Sardjito",
    entityType: "FASKES",
    scope: "Rujukan & Rekam Medis Rawat Inap",
    validUntil: "2026-11-01 00:00 WIB",
    isRevoked: false,
    createdAt: "2026-10-01 10:00 WIB",
  },
  {
    id: "GRANT-03",
    pasienId: "P-101",
    pasienNama: "Budi Santoso",
    entityId: "DOC-04",
    entityNama: "dr. Rian Sp.JP",
    entityType: "DOKTER",
    scope: "Konsultasi Kardiologi Rujukan",
    validUntil: "2026-08-30 23:59 WIB",
    isRevoked: true,
    createdAt: "2026-08-10 11:30 WIB",
  },
];

export const MOCK_SECURITY_LOGS: SecurityAuditLog[] = [
  {
    id: "LOG-01",
    timestamp: "15 Oktober 2026, 08:14:02 WIB",
    actorId: "DOC-04",
    actorName: "dr. Rian Sp.JP",
    actorRole: "NAKES",
    action: "IDOR_BLOCKED",
    targetResource: "/api/rme/record-P101-01",
    ipAddress: "192.168.1.88",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    severity: "CRITICAL",
    detail: "BOLA Guard: Izin akses pasien P-101 telah dicabut oleh pasien (Status: REVOKED). Akses diblokir.",
  },
  {
    id: "LOG-02",
    timestamp: "15 Oktober 2026, 08:10:11 WIB",
    actorId: "DOC-01",
    actorName: "dr. Andi Pratama, Sp.PD",
    actorRole: "NAKES",
    action: "HMAC_VERIFIED",
    targetResource: "/api/rme",
    ipAddress: "192.168.1.42",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    severity: "INFO",
    detail: "Verifikasi tanda tangan digital HMAC-SHA256 berhasil. Integritas data terkonfirmasi.",
  },
  {
    id: "LOG-03",
    timestamp: "14 Oktober 2026, 17:35:19 WIB",
    actorId: "ADM-01",
    actorName: "Administrator Utama",
    actorRole: "ADMIN",
    action: "QUARANTINE_FASKES",
    targetResource: "/api/admin/kill-switch",
    ipAddress: "10.0.1.1",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    severity: "WARN",
    detail: "Simulasi isolasi karantina faskes FAS-04 berhasil dipicu.",
  },
  {
    id: "LOG-04",
    timestamp: "14 Oktober 2026, 11:05:40 WIB",
    actorId: "P-101",
    actorName: "Budi Santoso",
    actorRole: "PASIEN",
    action: "REVOKE_CONSENT",
    targetResource: "/api/consent/revoke/GRANT-03",
    ipAddress: "182.253.12.90",
    userAgent: "Mobile Safari 18.0",
    severity: "INFO",
    detail: "Pasien mencabut hak akses dr. Rian Sp.JP (1-Click Revoke UU PDP).",
  },
];

export const MOCK_KYC_REQUESTS: KycSubmission[] = [
  {
    id: "KYC-01",
    userId: "P-104",
    namaLengkap: "Dewi Lestari",
    nik: "3171044406980004",
    tanggalLahir: "14 Juni 1998",
    alamat: "Jl. Mawar Bodas No. 12, Bandung",
    ktpUrl: "/ktp-mock-dewi.jpg",
    submittedAt: "14 Oktober 2026, 16:20 WIB",
    status: "PENDING",
  },
  {
    id: "KYC-02",
    userId: "P-105",
    namaLengkap: "Bambang Pamungkas",
    nik: "3301021005820007",
    tanggalLahir: "10 Mei 1982",
    alamat: "Jl. Kaliurang KM 5, Sleman",
    ktpUrl: "/ktp-mock-bambang.jpg",
    submittedAt: "15 Oktober 2026, 07:15 WIB",
    status: "PENDING",
  },
];

export const MOCK_KYD_REQUESTS: KydSubmission[] = [
  {
    id: "KYD-01",
    userId: "DOC-05",
    namaLengkap: "dr. Hendro Wicaksono, Sp.B",
    nik: "3273011210810003",
    strNumber: "31.1.1.500.1.20.998877",
    sipNumber: "446/SIP-D/2024/110",
    spesialisasi: "Spesialis Bedah Umum",
    faskesNama: "RSUP Dr. Sardjito",
    dokumenStrUrl: "/str-mock-hendro.pdf",
    submittedAt: "14 Oktober 2026, 10:00 WIB",
    status: "PENDING",
  },
];

export const MOCK_TROUBLE_TICKETS: TroubleTicket[] = [
  {
    id: "TCK-101",
    pengirimId: "DOC-01",
    pengirimNama: "dr. Andi Pratama, Sp.PD",
    pengirimRole: "NAKES",
    kategori: "SYNC_FAIL",
    judul: "Antrean offline 3 berkas gagal disinkronkan saat jaringan pulih",
    deskripsi: "Saat internet pulih di poli, 3 batch rekam medis memberi pesan HMAC payload timeout.",
    faskesTerkait: "RSUP Dr. Sardjito",
    status: "OPEN",
    createdAt: "15 Oktober 2026, 08:30 WIB",
  },
  {
    id: "TCK-102",
    pengirimId: "P-101",
    pengirimNama: "Budi Santoso",
    pengirimRole: "PASIEN",
    kategori: "DATA_MISMATCH",
    judul: "Golongan darah di kartu profil tertulis B padahal O+",
    deskripsi: "Mohon sinkronkan dengan data KTP saya yang sah.",
    status: "INVESTIGATING",
    createdAt: "14 Oktober 2026, 12:15 WIB",
  },
];

// -------------------------------------------------------------
// HELPER STORAGE PERSISTENCE
// -------------------------------------------------------------

export function getStorageData<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStorageData<T>(key: string, value: T): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving to localStorage [${key}]:`, e);
    }
  }
}
