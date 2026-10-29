import { z } from "zod";

/**
 * Skema Zod untuk Formulir Pemeriksaan Medis Klinis Dokter (SOAP & ICD-10)
 * Sesuai Tugas Pendahuluan Modul 5 dan standar Permenkes No. 24/2022
 */
export const PemeriksaanKlinisSchema = z.object({
  // 1. Kolom teks dengan batas panjang karakter (Subjective)
  subjective: z
    .string({ message: "Keluhan utama pasien wajib diisi." })
    .trim()
    .min(10, { message: "Keluhan utama pasien wajib diisi minimal 10 karakter." })
    .max(1000, { message: "Keluhan utama pasien tidak boleh melebihi 1.000 karakter." }),

  // 2. Kolom numerik tanda vital fisiologis (Objective)
  systolic: z
    .number({ message: "Nilai tekanan darah sistolik wajib diisi berupa angka." })
    .int({ message: "Nilai sistolik harus berupa bilangan bulat." })
    .min(70, { message: "Nilai tekanan darah sistolik minimal 70 mmHg." })
    .max(250, { message: "Nilai tekanan darah sistolik maksimal 250 mmHg." }),

  diastolic: z
    .number({ message: "Nilai tekanan darah diastolik wajib diisi berupa angka." })
    .int({ message: "Nilai diastolik harus berupa bilangan bulat." })
    .min(40, { message: "Nilai tekanan darah diastolik minimal 40 mmHg." })
    .max(150, { message: "Nilai tekanan darah diastolik maksimal 150 mmHg." }),

  heartRate: z
    .number({ message: "Detak jantung wajib diisi berupa angka." })
    .int({ message: "Detak jantung harus berupa bilangan bulat." })
    .min(40, { message: "Detak jantung minimal 40 bpm." })
    .max(220, { message: "Detak jantung maksimal 220 bpm." }),

  temperature: z
    .number({ message: "Suhu tubuh wajib diisi berupa angka." })
    .min(30.0, { message: "Suhu tubuh minimal 30.0 °C." })
    .max(45.0, { message: "Suhu tubuh maksimal 45.0 °C." }),

  spo2: z
    .number({ message: "Saturasi oksigen wajib diisi berupa angka." })
    .int({ message: "Saturasi oksigen harus berupa bilangan bulat." })
    .min(50, { message: "Saturasi oksigen minimal 50%." })
    .max(100, { message: "Saturasi oksigen maksimal 100%." }),

  // 3. Kolom pilihan dengan z.enum (Assessment ICD-10)
  icd10: z.enum(["I10", "J06.9", "E11", "K29.7", "I20.9"], {
    message: "Kode diagnosis ICD-10 harus dipilih dari daftar rujukan diagnosis yang valid.",
  }),

  // 4. Kolom teks resep / rencana terapi (Plan)
  planPrescription: z
    .string({ message: "Resep obat wajib diisi." })
    .trim()
    .min(5, { message: "Resep obat atau rencana terapi wajib diisi minimal 5 karakter." })
    .max(500, { message: "Resep obat tidak boleh melebihi 500 karakter." }),

  planAction: z
    .string()
    .trim()
    .max(500, { message: "Catatan tindakan maksimal 500 karakter." })
    .optional(),

  // 5. Kotak centang (Checkbox) konfirmasi medikolegal
  isMedicallyConfirmed: z
    .boolean({ message: "Konfirmasi keabsahan medikolegal wajib ditentukan." })
    .refine((val) => val === true, {
      message: "Dokter wajib mencentang konfirmasi keabsahan medikolegal sebelum rekam medis dienkripsi.",
    }),
});

export type PemeriksaanKlinisInput = z.infer<typeof PemeriksaanKlinisSchema>;
