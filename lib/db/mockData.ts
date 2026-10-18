// lib/db/mockData.ts
// Modul data tiruan terpadu untuk mendanai antarmuka 4-Role Resilio-Health:
// Pasien, Tenaga Kesehatan (DPJP), Staf Nakes (Triase & Admisi), dan Admin Regulator

export type TriaseLevel = "HIJAU" | "KUNING" | "MERAH";


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
  fotoProfilUrl?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: "Anak" | "Orang Tua" | "Pasangan";
  nik: string;
  age: number;
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
  familyMembers?: FamilyMember[];
}

export interface VitalSigns {
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  spo2: number;
  beratBadan?: number;
  tinggiBadan?: number;
}

export type AppointmentStatus =
  | "PENDING_ARRIVAL"
  | "WAITING_TRIAGE"
  | "WAITING_DOCTOR"
  | "IN_EXAMINATION"
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Appointment {
  id: string;
  pasienId: string;
  pasienNama: string;
  pasienNik: string;
  faskesId: string;
  faskesNama: string;
  dokterId: string;
  dokterNama: string;
  dpjpId?: string;
  dpjpNama?: string;
  poli: string;
  tanggal: string;
  jam: string;
  keluhanAwal: string;
  status: AppointmentStatus;
  consentActive: boolean;
  consentPin?: string;
  triaseLevel?: TriaseLevel;
  triaseVitals?: VitalSigns;
  checkInTime?: string;
}

export interface EncryptedMedicalImage {
  id: string;
  title: string;
  type: "RONTGEN" | "USG" | "LAB" | "EKG" | "FOTO_KLINIS";
  encryptedBlobHex: string;
  ivHex: string;
  hmacDigest: string;
  mimeType: string;
  timestamp: string;
  notes?: string;
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
  parentRecordId?: string;
  addendumReason?: string;
  isBreakGlass?: boolean;
  breakGlassReason?: string;
  medicalImages?: EncryptedMedicalImage[];
}

export interface AccessGrant {
  id: string;
  pasienId: string;
  pasienNama: string;
  entityId: string;
  entityNama: string;
  entityType: "DOKTER" | "FASKES";
  scope: string;
  validUntil: string;
  isRevoked: boolean;
  createdAt: string;
  isBreakGlass?: boolean;
}

export type AuditAction =
  | "LOGIN"
  | "VIEW_RME"
  | "WRITE_RME"
  | "IDOR_BLOCKED"
  | "HMAC_VERIFIED"
  | "HMAC_MISMATCH"
  | "REVOKE_CONSENT"
  | "QUARANTINE_FASKES"
  | "BREAK_GLASS_ACCESS"
  | "CHECK_IN_TRIAGE"
  | "ASSIGN_DPJP";

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: "PASIEN" | "NAKES" | "ADMIN" | "STAF" | "GATEWAY";
  action: AuditAction;
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
  selfieUrl: string;
  watermarkText: string;
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
  fotoProfilUrl: string;
  suratTugasUrl: string;
  watermarkText: string;
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
// DATA AWAL SISTEM RESILIO-HEALTH
// -------------------------------------------------------------

export const MOCK_FASKES: Faskes[] = [
  {
    id: "FAS-01",
    kodeFaskes: "RS-SARDJITO-001",
    nama: "RSUP Dr. Sardjito",
    tipe: "Rumah Sakit",
    alamat: "Jl. Kesehatan No. 1, Sendangadi, Sleman",
    kota: "Yogyakarta",
    spesialisasiList: ["Spesialis Penyakit Dalam", "Spesialis Kardiologi", "Spesialis Anak", "Bedah Umum", "IGD 24 Jam"],
    kategoriPenyakit: ["Hipertensi", "Jantung", "Diabetes", "Penyakit Dalam", "ISPA", "Trauma Darurat"],
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
    lastAccess: "15 Oktober 2026, 10:14 WIB",
    fotoProfilUrl: "/doctors/dr-andi.jpg",
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
    lastAccess: "14 Oktober 2026, 14:30 WIB",
    fotoProfilUrl: "/doctors/dr-ratna.jpg",
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
    lastAccess: "13 Oktober 2026, 11:00 WIB",
    fotoProfilUrl: "/doctors/dr-sarah.jpg",
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
    fotoProfilUrl: "/doctors/dr-rian.jpg",
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
    familyMembers: [
      { id: "FAM-01", name: "Rizky Santoso (Anak)", relation: "Anak", nik: "3171010502150009", age: 11 },
      { id: "FAM-02", name: "Dewi Sartika (Istri)", relation: "Pasangan", nik: "3171014408820004", age: 44 },
    ],
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
    dpjpId: "DOC-01",
    dpjpNama: "dr. Andi Pratama, Sp.PD",
    poli: "Poli Penyakit Dalam",
    tanggal: "2026-10-15",
    jam: "09:00 WIB",
    keluhanAwal: "Kontrol tensi rutin, kepala terasa berat di bagian tengkuk",
    status: "IN_EXAMINATION",
    consentActive: true,
    consentPin: "884120",
    triaseLevel: "KUNING",
    triaseVitals: {
      systolic: 145,
      diastolic: 92,
      heartRate: 82,
      temperature: 36.6,
      respiratoryRate: 18,
      spo2: 98,
      beratBadan: 74,
      tinggiBadan: 170,
    },
    checkInTime: "15 Oktober 2026, 08:35 WIB",
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
    dpjpId: "DOC-01",
    dpjpNama: "dr. Andi Pratama, Sp.PD",
    poli: "Poli Penyakit Dalam",
    tanggal: "2026-10-15",
    jam: "10:30 WIB",
    keluhanAwal: "Gula darah puasa tinggi dan lemas",
    status: "WAITING_DOCTOR",
    consentActive: true,
    consentPin: "551290",
    triaseLevel: "HIJAU",
    triaseVitals: {
      systolic: 128,
      diastolic: 80,
      heartRate: 74,
      temperature: 36.4,
      respiratoryRate: 16,
      spo2: 99,
      beratBadan: 68,
      tinggiBadan: 165,
    },
    checkInTime: "15 Oktober 2026, 09:10 WIB",
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
    dpjpId: "DOC-02",
    dpjpNama: "dr. Ratna Juwita, Sp.JP",
    poli: "Poli Kardiologi",
    tanggal: "2026-10-16",
    jam: "14:00 WIB",
    keluhanAwal: "Sesak napas saat menaiki tangga",
    status: "PENDING_ARRIVAL",
    consentActive: true,
    consentPin: "319402",
  },
];

export const MOCK_ENCRYPTED_RECORDS: EncryptedMedicalRecord[] = [
  {
    recordId: "REC-2026-001",
    patientId: "P-101",
    patientName: "Budi Santoso",
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterStr: "31.1.1.100.2.22.123456",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    primaryIcd10: "I10",
    diagnosisShort: "Hipertensi Esensial (Primer)",
    encryptedPayload:
      "7b227375626a656374697665223a2250617369656e206d656e67656c75682074656e676b756b2062657261742064616e20707573696e67222c22766974616c5369676e73223a7b22737973746f6c6963223a3134352c2264696173746f6c6963223a39322c22686561727452617465223a38322c2274656d7065726174757265223a33362e367d2c226173736573736d656e74223a7b226963643130223a22493130222c2264657363223a22486970657274656e7369204573656e7369616c227d2c22706c616e223a7b227265736570223a5b22416d6c6f646970696e652031306d6720317831222c224b616e646573617274616e20386d6720317831225d2c2274696e64616b616e223a224b6f6e74726f6c2074656e73692032206d696e676775206c616769227d7d",
    ivHex: "1a2b3c4d5e6f7a8b9c0d1e2f",
    hmacDigest: "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9",
    timestamp: "10 Oktober 2026, 10:30 WIB",
    version: 1,
    medicalImages: [
      {
        id: "IMG-01",
        title: "Foto Rontgen Thorax AP/PA",
        type: "RONTGEN",
        encryptedBlobHex: "42494e4152595f585241595f54484f524158",
        ivHex: "1a2b3c4d5e6f7a8b9c0d1e2f",
        hmacDigest: "5f8d93c18b7642e09a3d4c1b72e5a9c8f01b2c3d4e5f60718293a4b5c6d7e8f9",
        mimeType: "image/jpeg",
        timestamp: "10 Oktober 2026",
        notes: "Cor dan pulmo dalam batas normal, kardiomegali ringan (CTR ~52%).",
      },
    ],
  },
  {
    recordId: "REC-2026-002",
    patientId: "P-101",
    patientName: "Budi Santoso",
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterStr: "31.1.1.100.2.22.123456",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    primaryIcd10: "E11",
    diagnosisShort: "Diabetes Melitus Tipe 2",
    encryptedPayload:
      "7b227375626a656374697665223a224c656d61732064616e20736572696e672068617573222c22766974616c5369676e73223a7b22737973746f6c6963223a3133302c2264696173746f6c6963223a38352c22686561727452617465223a37362c2274656d7065726174757265223a33362e357d2c226173736573736d656e74223a7b226963643130223a22453131222c2264657363223a224469616265746573204d656c6974757320546970652032227d2c22706c616e223a7b227265736570223a5b224d6574666f726d696e203530306d6720327831225d2c2274696e64616b616e223a22446965742072656e6461682067756c61227d7d",
    ivHex: "2b3c4d5e6f7a8b9c0d1e2f3a",
    hmacDigest: "6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6071",
    timestamp: "25 September 2026, 09:15 WIB",
    version: 1,
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
    scope: "DPJP Aktif: Baca & Tulis Rekam Medis (SOAP + Citra Medis)",
    validUntil: "2026-10-16 23:59 WIB",
    isRevoked: false,
    createdAt: "2026-10-15 08:35 WIB",
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
    detail: "BOLA Guard: Izin akses pasien P-101 telah dicabut oleh pasien (Status: REVOKED). Akses dokter non-DPJP diblokir.",
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
    detail: "Verifikasi tanda tangan digital HMAC-SHA256 berhasil. Integritas data klinis dan citra Rontgen terkonfirmasi.",
  },
  {
    id: "LOG-03",
    timestamp: "15 Oktober 2026, 08:35:10 WIB",
    actorId: "STF-01",
    actorName: "Ners Maya Kartika, S.Kep",
    actorRole: "STAF",
    action: "ASSIGN_DPJP",
    targetResource: "/api/encounters/APT-2026-001",
    ipAddress: "192.168.1.15 (Meja Triase)",
    userAgent: "Chrome 129.0 on Windows",
    severity: "INFO",
    detail: "Triase Selesai (KUNING). Pasien Budi Santoso diarahkan ke dr. Andi Pratama, Sp.PD (DPJP Aktif). Active Encounter diterbitkan.",
  },
  {
    id: "LOG-04",
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
    id: "LOG-05",
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
    selfieUrl: "/selfie-mock-dewi.jpg",
    watermarkText: "HANYA UNTUK VERIFIKASI RESILIO-HEALTH - 14 OKT 2026",
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
    selfieUrl: "/selfie-mock-bambang.jpg",
    watermarkText: "HANYA UNTUK VERIFIKASI RESILIO-HEALTH - 15 OKT 2026",
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
    fotoProfilUrl: "/doctors/dr-hendro.jpg",
    suratTugasUrl: "/sk-tugas-hendro.pdf",
    watermarkText: "DOKUMEN KREDENSIAL RESILIO-HEALTH KEMENKES - 14 OKT 2026",
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
    judul: "Antrean offline citra Rontgen gagal disinkronkan saat internet pulih",
    deskripsi: "Pemeriksaan radiologi berukuran 4 MB di IndexedDB memberi status timeout saat background sync ke server pusat.",
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

// Helper Storage Persistence
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
