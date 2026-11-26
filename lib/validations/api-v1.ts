import { z } from "zod";

// -----------------------------------------------------------------------------
// 1. MASTER FASKES
// -----------------------------------------------------------------------------
export const FaskesTypeEnum = z.enum(["RUMAH_SAKIT", "KLINIK_PRATAMA", "PUSKESMAS"], {
  message: "Tipe faskes harus salah satu dari RUMAH_SAKIT, KLINIK_PRATAMA, atau PUSKESMAS.",
});

export const FaskesStatusEnum = z.enum(["ACTIVE", "QUARANTINED"], {
  message: "Status faskes harus ACTIVE atau QUARANTINED.",
});

export const CreateFaskesApiSchema = z.object({
  id: z
    .string({ message: "ID faskes harus string." })
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,32}$/, { message: "Format ID faskes tidak valid." })
    .optional(),
  kodeFaskes: z
    .string({ message: "Kode faskes wajib diisi." })
    .trim()
    .min(3, { message: "Kode faskes minimal 3 karakter." })
    .max(50, { message: "Kode faskes maksimal 50 karakter." }),
  nama: z
    .string({ message: "Nama faskes wajib diisi." })
    .trim()
    .min(3, { message: "Nama faskes minimal 3 karakter." })
    .max(150, { message: "Nama faskes maksimal 150 karakter." }),
  tipe: FaskesTypeEnum,
  alamat: z
    .string({ message: "Alamat faskes wajib diisi." })
    .trim()
    .min(5, { message: "Alamat minimal 5 karakter." })
    .max(500, { message: "Alamat maksimal 500 karakter." }),
  kota: z
    .string({ message: "Kota faskes wajib diisi." })
    .trim()
    .min(2, { message: "Nama kota minimal 2 karakter." })
    .max(100, { message: "Nama kota maksimal 100 karakter." }),
  kontak: z
    .string({ message: "Nomor kontak faskes wajib diisi." })
    .trim()
    .min(6, { message: "Kontak minimal 6 karakter." })
    .max(50, { message: "Kontak maksimal 50 karakter." }),
  spesialisasiList: z.array(z.string().trim().min(1)).default([]),
  kategoriPenyakit: z.array(z.string().trim().min(1)).default([]),
});

export const UpdateFaskesApiSchema = CreateFaskesApiSchema.omit({ id: true, kodeFaskes: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus disertakan untuk pembaruan faskes.",
  });

export const QuarantineFaskesApiSchema = z.object({
  status: FaskesStatusEnum,
  reason: z
    .string({ message: "Alasan karantina harus berupa teks." })
    .trim()
    .max(500, { message: "Alasan maksimal 500 karakter." })
    .optional(),
});

// -----------------------------------------------------------------------------
// 2. APPOINTMENTS & WORKFLOW
// -----------------------------------------------------------------------------
export const CreateAppointmentApiSchema = z.object({
  faskesId: z.string({ message: "faskesId wajib diisi." }).trim().min(3),
  doctorId: z.string({ message: "doctorId wajib diisi." }).trim().min(3),
  patientId: z.string({ message: "patientId harus string." }).trim().min(3).optional(),
  tanggal: z
    .string({ message: "Tanggal konsultasi wajib diisi (YYYY-MM-DD)." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format tanggal wajib YYYY-MM-DD." }),
  jam: z
    .string({ message: "Jam praktik wajib diisi." })
    .trim()
    .min(3, { message: "Jam praktik minimal 3 karakter." })
    .max(20, { message: "Jam praktik maksimal 20 karakter." }),
  poli: z.string({ message: "Poli harus teks." }).trim().max(100).optional(),
  keluhanAwal: z
    .string({ message: "Keluhan awal wajib diisi." })
    .trim()
    .min(5, { message: "Keluhan awal minimal 5 karakter." })
    .max(500, { message: "Keluhan awal maksimal 500 karakter." }),
  autoConsent: z.boolean({ message: "autoConsent harus boolean." }).default(true),
});

export const UpdateAppointmentApiSchema = z
  .object({
    tanggal: z
      .string({ message: "Format tanggal wajib YYYY-MM-DD." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format tanggal wajib YYYY-MM-DD." })
      .optional(),
    jam: z
      .string({ message: "Jam praktik harus berupa teks." })
      .trim()
      .min(3, { message: "Jam praktik minimal 3 karakter." })
      .max(20, { message: "Jam praktik maksimal 20 karakter." })
      .optional(),
    keluhanAwal: z
      .string({ message: "Keluhan awal harus berupa teks." })
      .trim()
      .min(5, { message: "Keluhan awal minimal 5 karakter." })
      .max(500, { message: "Keluhan awal maksimal 500 karakter." })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field (tanggal, jam, atau keluhanAwal) wajib diisi.",
  });

export const AssignDpjpApiSchema = z.object({
  doctorId: z.string({ message: "doctorId DPJP wajib diisi." }).trim().min(3),
  consentPin: z
    .string({ message: "Kode PIN persetujuan 6-digit pasien wajib diisi." })
    .trim()
    .regex(/^\d{6}$/, { message: "Kode PIN persetujuan wajib tepat 6 digit angka." }),
});

// -----------------------------------------------------------------------------
// 3. MEDICAL RECORDS & ADDENDA (ZERO-KNOWLEDGE AEAD + HMAC)
// -----------------------------------------------------------------------------
export const CreateMedicalRecordApiSchema = z.object({
  recordId: z
    .string({ message: "recordId harus string." })
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,32}$/, { message: "Format recordId tidak valid." })
    .optional(),
  patientId: z.string({ message: "patientId wajib diisi." }).trim().min(3),
  appointmentId: z.string({ message: "appointmentId harus string." }).trim().min(3).optional().nullable(),
  primaryIcd10: z
    .string({ message: "Kode ICD-10 utama wajib diisi." })
    .trim()
    .min(2, { message: "Kode ICD-10 minimal 2 karakter." })
    .max(20, { message: "Kode ICD-10 maksimal 20 karakter." }),
  diagnosisShort: z
    .string({ message: "Ringkasan diagnosis wajib diisi." })
    .trim()
    .min(3, { message: "Ringkasan diagnosis minimal 3 karakter." })
    .max(255, { message: "Ringkasan diagnosis maksimal 255 karakter." }),
  encryptedPayload: z
    .string({ message: "encryptedPayload wajib berupa hex valid." })
    .regex(/^[0-9a-fA-F]+$/, { message: "Ciphertext wajib berformat heksadesimal." }),
  ivHex: z
    .string({ message: "ivHex wajib 24 karakter hex (96-bit)." })
    .regex(/^[0-9a-fA-F]{24}$/, { message: "IV wajib 96-bit (24 karakter hex)." }),
  hmacDigest: z
    .string({ message: "hmacDigest wajib 64 karakter hex (SHA-256)." })
    .regex(/^[0-9a-fA-F]{64}$/, { message: "HMAC wajib 64 karakter hex." }),
});

export const CreateAddendumApiSchema = z.object({
  recordId: z
    .string({ message: "recordId harus string." })
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,32}$/, { message: "Format recordId tidak valid." })
    .optional(),
  addendumReason: z
    .string({ message: "Alasan klinis addendum wajib diisi (Permenkes 24/2022)." })
    .trim()
    .min(5, { message: "Alasan addendum minimal 5 karakter." })
    .max(500, { message: "Alasan addendum maksimal 500 karakter." }),
  primaryIcd10: z.string({ message: "primaryIcd10 harus string." }).trim().min(2).max(20).optional(),
  diagnosisShort: z
    .string({ message: "diagnosisShort harus string." })
    .trim()
    .min(3)
    .max(255)
    .optional(),
  encryptedPayload: z
    .string({ message: "encryptedPayload wajib berupa hex valid." })
    .regex(/^[0-9a-fA-F]+$/, { message: "Ciphertext wajib berformat heksadesimal." }),
  ivHex: z
    .string({ message: "ivHex wajib 24 karakter hex (96-bit)." })
    .regex(/^[0-9a-fA-F]{24}$/, { message: "IV wajib 96-bit (24 karakter hex)." }),
  hmacDigest: z
    .string({ message: "hmacDigest wajib 64 karakter hex (SHA-256)." })
    .regex(/^[0-9a-fA-F]{64}$/, { message: "HMAC wajib 64 karakter hex." }),
});

// -----------------------------------------------------------------------------
// 4. ACCESS GRANTS (CONSENT)
// -----------------------------------------------------------------------------
export const CreateAccessGrantApiSchema = z.object({
  entityId: z.string({ message: "entityId dokter/faskes wajib diisi." }).trim().min(3),
  entityName: z
    .string({ message: "entityName harus berupa teks." })
    .trim()
    .min(2)
    .max(150)
    .optional(),
  entityType: z.enum(["DOKTER", "FASKES"], {
    message: "entityType wajib DOKTER atau FASKES.",
  }),
  scope: z
    .string({ message: "scope harus berupa teks." })
    .trim()
    .min(2)
    .max(100)
    .default("READ_RME"),
  durationHours: z
    .number({ message: "durationHours wajib berupa angka bulat." })
    .int({ message: "durationHours wajib bilangan bulat." })
    .min(1, { message: "Durasi izin minimal 1 jam." })
    .max(2160, { message: "Durasi izin maksimal 90 hari (2160 jam)." })
    .default(24),
});

// -----------------------------------------------------------------------------
// 5. FAMILY MEMBERS (PROXY PERWALIAN)
// -----------------------------------------------------------------------------
export const CreateFamilyMemberApiSchema = z.object({
  name: z
    .string({ message: "Nama lengkap anggota keluarga wajib diisi." })
    .trim()
    .min(3, { message: "Nama lengkap minimal 3 karakter." })
    .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
  nik: z
    .string({ message: "NIK anggota keluarga wajib diisi." })
    .trim()
    .regex(/^\d{16}$/, { message: "NIK anggota keluarga wajib tepat 16 digit angka." }),
  relation: z.enum(["Anak", "Orang_Tua", "Pasangan", "Wali"], {
    message: "Hubungan keluarga harus salah satu dari Anak, Orang_Tua, Pasangan, atau Wali.",
  }),
  birthDate: z
    .string({ message: "Tanggal lahir wajib diisi (YYYY-MM-DD)." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format tanggal lahir harus YYYY-MM-DD." }),
});

export const UpdateFamilyMemberApiSchema = CreateFamilyMemberApiSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Minimal satu field wajib disertakan untuk pembaruan anggota keluarga." }
);

// -----------------------------------------------------------------------------
// 6. TROUBLE TICKETS
// -----------------------------------------------------------------------------
export const UpdateTroubleTicketApiSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"], {
    message: "Status tiket harus salah satu dari OPEN, INVESTIGATING, atau RESOLVED.",
  }),
});
