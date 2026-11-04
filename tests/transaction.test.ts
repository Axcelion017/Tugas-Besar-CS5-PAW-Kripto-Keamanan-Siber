import { describe, test, expect } from "vitest";
import { prisma } from "../lib/db/prisma";
import { Prisma } from "@prisma/client";

describe("Modul 6 — Transaksi, Rollback & Integritas Referensial (RESTRICT)", () => {
  test("1. Galat saat menghapus relasi tanpa transaksi (onDelete: Restrict) - Menolak Hapus Pasien yang Memiliki RME", async () => {
    // Pasien P-101 memiliki Medical Record (MR-001) di database
    // Usaha penghapusan langsung wajib digagalkan oleh konstrain PostgreSQL
    let errorThrown: unknown = null;
    try {
      await prisma.patient.delete({
        where: { id: "P-101" },
      });
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeDefined();
    expect(errorThrown instanceof Prisma.PrismaClientKnownRequestError).toBe(true);
    // Prisma P2003: Foreign key constraint failed on the field
    const prismaError = errorThrown as Prisma.PrismaClientKnownRequestError;
    expect(prismaError.code).toBe("P2003");
  });

  test("2. Bukti Rollback Transaksi Atomik: Seluruh operasi dibatalkan jika salah satu gagal", async () => {
    // Hitung jumlah appointment awal
    const countBefore = await prisma.appointment.count();

    let transactionFailed = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Operasi 1: Buat janji temu valid
        await tx.appointment.create({
          data: {
            id: "APT-ROLLBACK-TEST",
            patientId: "P-101",
            doctorId: "DOC-01",
            faskesId: "FAS-01",
            tanggal: new Date("2026-11-20"),
            jam: "10:00",
            poli: "Poli Uji Rollback",
            keluhanAwal: "Uji coba transaksi atomik",
            status: "PENDING_ARRIVAL",
          },
        });

        // Operasi 2: Sengaja gagal - insert record dengan foreign key tidak ada di DB
        await tx.appointment.create({
          data: {
            id: "APT-ROLLBACK-FAIL",
            patientId: "PATIENT-NON-EXISTENT-999", // FK Error
            doctorId: "DOC-01",
            faskesId: "FAS-01",
            tanggal: new Date("2026-11-20"),
            jam: "11:00",
            poli: "Poli Uji Rollback",
            keluhanAwal: "Data yang sengaja salah",
            status: "PENDING_ARRIVAL",
          },
        });
      });
    } catch (err) {
      transactionFailed = true;
      expect(err instanceof Prisma.PrismaClientKnownRequestError).toBe(true);
    }

    expect(transactionFailed).toBe(true);

    // Hitung kembali jumlah appointment setelah rollback
    const countAfter = await prisma.appointment.count();

    // Jumlah wajib sama persis (Operasi 1 ikut di-rollback dan tidak tersimpan di database)
    expect(countAfter).toBe(countBefore);

    // Verifikasi bahwa APT-ROLLBACK-TEST tidak ada di database
    const checkRecord = await prisma.appointment.findUnique({
      where: { id: "APT-ROLLBACK-TEST" },
    });
    expect(checkRecord).toBeNull();
  });
});
