import { z } from "zod";

/**
 * Skema Zod untuk Formulir Pengkajian Triase Awal Pasien
 */
export const TriaseSchema = z.object({
  systolic: z
    .number({ message: "Nilai sistolik wajib diisi berupa angka." })
    .int()
    .min(50, { message: "Sistolik minimal 50 mmHg." })
    .max(300, { message: "Sistolik maksimal 300 mmHg." }),

  diastolic: z
    .number({ message: "Nilai diastolik wajib diisi berupa angka." })
    .int()
    .min(30, { message: "Diastolik minimal 30 mmHg." })
    .max(200, { message: "Diastolik maksimal 200 mmHg." }),

  heartRate: z
    .number({ message: "Detak jantung wajib diisi berupa angka." })
    .int()
    .min(30, { message: "Detak jantung minimal 30 bpm." })
    .max(250, { message: "Detak jantung maksimal 250 bpm." }),

  temperature: z
    .number({ message: "Suhu tubuh wajib diisi berupa angka." })
    .min(32.0, { message: "Suhu tubuh minimal 32.0 °C." })
    .max(43.0, { message: "Suhu tubuh maksimal 43.0 °C." }),

  respiratoryRate: z
    .number({ message: "Frekuensi pernapasan wajib diisi berupa angka." })
    .int()
    .min(8, { message: "Frekuensi napas minimal 8 kali/menit." })
    .max(60, { message: "Frekuensi napas maksimal 60 kali/menit." }),

  spo2: z
    .number({ message: "SpO2 wajib diisi berupa angka." })
    .int()
    .min(50, { message: "Saturasi oksigen minimal 50%." })
    .max(100, { message: "Saturasi oksigen maksimal 100%." }),

  beratBadan: z
    .number({ message: "Berat badan wajib diisi berupa angka." })
    .min(1, { message: "Berat badan minimal 1 kg." })
    .max(350, { message: "Berat badan maksimal 350 kg." }),

  tinggiBadan: z
    .number({ message: "Tinggi badan wajib diisi berupa angka." })
    .min(30, { message: "Tinggi badan minimal 30 cm." })
    .max(260, { message: "Tinggi badan maksimal 260 cm." }),

  triaseLevel: z.enum(["HIJAU", "KUNING", "MERAH"], {
    message: "Pilih kategori triase kegawatdaruratan yang sah.",
  }),

  catatanPerawat: z
    .string()
    .trim()
    .max(500, { message: "Catatan perawat maksimal 500 karakter." })
    .optional(),
});

export type TriaseInput = z.infer<typeof TriaseSchema>;

/**
 * Skema Zod untuk Pendaftaran Pasien Walk-in (Loket Admisi)
 */
export const WalkInAdmisiSchema = z.object({
  nik: z
    .string({ message: "NIK pasien walk-in wajib diisi." })
    .trim()
    .regex(/^\d{16}$/, { message: "NIK wajib terdiri dari tepat 16 digit angka." }),
  keluhan: z
    .string({ message: "Keluhan awal wajib diisi." })
    .trim()
    .min(5, { message: "Keluhan awal minimal 5 karakter." })
    .max(300, { message: "Keluhan awal maksimal 300 karakter." }),
  poli: z.string({ message: "Poli tujuan wajib dipilih." }).min(1),
});

export type WalkInAdmisiInput = z.infer<typeof WalkInAdmisiSchema>;

/**
 * Skema Zod untuk Penugasan DPJP & Validasi PIN Persetujuan Pasien
 */
export const AssignDpjpSchema = z.object({
  aptId: z.string({ message: "Pilih antrean pasien yang valid." }).min(1),
  doctorId: z.string({ message: "Pilih dokter DPJP yang bertugas." }).min(1),
  inputPin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: "Kode PIN persetujuan pasien harus berupa 6 digit angka." })
    .optional()
    .or(z.literal("")),
});

export type AssignDpjpInput = z.infer<typeof AssignDpjpSchema>;
