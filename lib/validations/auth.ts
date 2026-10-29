import { z } from "zod";

/**
 * Skema Zod untuk Formulir Masuk / Autentikasi
 */
export const LoginSchema = z.object({
  identifier: z
    .string({ message: "Identifier (NIK, username, atau email) wajib diisi." })
    .trim()
    .min(3, { message: "Identifier minimal 3 karakter." })
    .max(100, { message: "Identifier maksimal 100 karakter." }),
  password: z
    .string({ message: "Kata sandi wajib diisi." })
    .min(6, { message: "Kata sandi minimal 6 karakter." })
    .max(100, { message: "Kata sandi maksimal 100 karakter." }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Skema Zod untuk Formulir Registrasi Pasien (e-KYC)
 */
export const RegisterPasienSchema = z.object({
  nik: z
    .string({ message: "Nomor Induk Kependudukan (NIK) wajib diisi." })
    .trim()
    .regex(/^\d{16}$/, { message: "NIK wajib terdiri dari tepat 16 digit angka kependudukan." }),
  namaLengkap: z
    .string({ message: "Nama lengkap wajib diisi." })
    .trim()
    .min(3, { message: "Nama lengkap minimal 3 karakter." })
    .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
  email: z
    .string({ message: "Email wajib diisi." })
    .trim()
    .email({ message: "Format alamat email tidak valid." }),
  phone: z
    .string({ message: "Nomor telepon/WhatsApp wajib diisi." })
    .trim()
    .min(10, { message: "Nomor telepon minimal 10 digit." })
    .max(16, { message: "Nomor telepon maksimal 16 digit." }),
  tanggalLahir: z
    .string({ message: "Tanggal lahir wajib diisi." })
    .min(1, { message: "Tanggal lahir wajib dipilih." }),
  alamat: z
    .string({ message: "Alamat domisili wajib diisi." })
    .trim()
    .min(5, { message: "Alamat domisili minimal 5 karakter." })
    .max(300, { message: "Alamat domisili maksimal 300 karakter." }),
  golDarah: z.enum(["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"], {
    message: "Pilih golongan darah yang valid.",
  }),
  alergi: z.string().trim().max(200).optional(),
  ktpUploaded: z.boolean().refine((v) => v === true, {
    message: "Foto fisik KTP asli wajib diunggah untuk verifikasi e-KYC.",
  }),
  selfieUploaded: z.boolean().refine((v) => v === true, {
    message: "Swafoto (selfie) liveness check wajib diunggah.",
  }),
});

export type RegisterPasienInput = z.infer<typeof RegisterPasienSchema>;

/**
 * Skema Zod untuk Formulir Registrasi Tenaga Medis (e-KYD)
 */
export const RegisterNakesSchema = z.object({
  nik: z
    .string({ message: "NIK wajib diisi." })
    .trim()
    .regex(/^\d{16}$/, { message: "NIK wajib terdiri dari tepat 16 digit angka." }),
  namaLengkap: z
    .string({ message: "Nama lengkap dan gelar wajib diisi." })
    .trim()
    .min(3, { message: "Nama lengkap minimal 3 karakter." })
    .max(120, { message: "Nama lengkap maksimal 120 karakter." }),
  strNumber: z
    .string({ message: "Nomor STR wajib diisi." })
    .trim()
    .min(5, { message: "Nomor Surat Tanda Registrasi (STR) minimal 5 karakter." })
    .max(50, { message: "Nomor STR maksimal 50 karakter." }),
  sipNumber: z
    .string({ message: "Nomor SIP wajib diisi." })
    .trim()
    .min(5, { message: "Nomor Surat Izin Praktik (SIP) minimal 5 karakter." })
    .max(50, { message: "Nomor SIP maksimal 50 karakter." }),
  spesialisasi: z
    .string({ message: "Spesialisasi klinis wajib diisi." })
    .trim()
    .min(3, { message: "Spesialisasi dokter minimal 3 karakter." }),
  faskesNama: z
    .string({ message: "Fasilitas kesehatan bertugas wajib diisi." })
    .trim()
    .min(3, { message: "Nama faskes minimal 3 karakter." }),
  strDokumenUploaded: z.boolean().refine((v) => v === true, {
    message: "Dokumen bukti legalitas STR/SIP wajib diunggah untuk verifikasi KYD.",
  }),
});

export type RegisterNakesInput = z.infer<typeof RegisterNakesSchema>;
