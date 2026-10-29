import { z } from "zod";

/**
 * Skema Zod untuk Pemesanan Jadwal Konsultasi (Booking)
 */
export const BookingSchema = z.object({
  faskesId: z.string({ message: "Fasilitas kesehatan wajib dipilih." }).min(1),
  dokterId: z.string({ message: "Dokter tujuan wajib dipilih." }).min(1),
  tanggal: z.string({ message: "Tanggal konsultasi wajib diisi." }).min(1),
  jam: z.string({ message: "Jam praktik wajib diisi." }).min(1),
  keluhanAwal: z
    .string({ message: "Keluhan awal wajib diisi." })
    .trim()
    .min(5, { message: "Keluhan awal minimal 5 karakter untuk referensi dokter." })
    .max(500, { message: "Keluhan awal maksimal 500 karakter." }),
  autoConsent: z.boolean(),
});

export type BookingInput = z.infer<typeof BookingSchema>;

/**
 * Skema Zod untuk Pelaporan Kendala / Tiket Sengketa Data
 */
export const TroubleTicketSchema = z.object({
  kategori: z.enum(["DATA_MISMATCH", "SYNC_FAIL", "BUG", "OTHER"], {
    message: "Pilih kategori kendala yang valid.",
  }),
  judul: z
    .string({ message: "Judul laporan kendala wajib diisi." })
    .trim()
    .min(5, { message: "Judul laporan kendala minimal 5 karakter." })
    .max(120, { message: "Judul laporan maksimal 120 karakter." }),
  deskripsi: z
    .string({ message: "Deskripsi kendala wajib diisi." })
    .trim()
    .min(10, { message: "Jelaskan permasalahan secara detail minimal 10 karakter." })
    .max(1000, { message: "Deskripsi maksimal 1.000 karakter." }),
});

export type TroubleTicketInput = z.infer<typeof TroubleTicketSchema>;

/**
 * Skema Zod untuk Pemberian Hak Akses (Consent Grant)
 */
export const ConsentGrantSchema = z.object({
  entityId: z.string({ message: "Dokter atau faskes tujuan wajib dipilih." }).min(1),
  validDays: z
    .number({ message: "Masa berlaku izin wajib ditentukan berupa angka." })
    .int()
    .min(1, { message: "Masa berlaku izin minimal 1 hari." })
    .max(90, { message: "Masa berlaku izin maksimal 90 hari." }),
});

export type ConsentGrantInput = z.infer<typeof ConsentGrantSchema>;
