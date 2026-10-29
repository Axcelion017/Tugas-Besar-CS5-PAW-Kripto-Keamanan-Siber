import { describe, test, expect } from "vitest";
import { PemeriksaanKlinisSchema } from "../lib/validations/clinical";
import { LoginSchema, RegisterPasienSchema, RegisterNakesSchema } from "../lib/validations/auth";
import { TriaseSchema, WalkInAdmisiSchema, AssignDpjpSchema } from "../lib/validations/triage";
import { BookingSchema, TroubleTicketSchema } from "../lib/validations/patient";

describe("Resilio-Health Zod Validation Schemas Tests", () => {
  describe("PemeriksaanKlinisSchema (SOAP Klinis & Medikolegal)", () => {
    const validData = {
      subjective: "Pasien mengeluh pusing berputar sejak 3 hari yang lalu disertai mual.",
      systolic: 120,
      diastolic: 80,
      heartRate: 75,
      temperature: 36.5,
      spo2: 98,
      icd10: "I10" as const,
      planPrescription: "Amlodipine 5mg No. XXX, S 1 dd 1 tab pagi hari",
      planAction: "Diet rendah garam dan istirahat cukup",
      isMedicallyConfirmed: true,
    };

    test("1. Positif: Data pemeriksaan klinis valid berhasil lolos", () => {
      const result = PemeriksaanKlinisSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test("2. Negatif: Keluhan utama kurang dari 10 karakter ditolak", () => {
      const result = PemeriksaanKlinisSchema.safeParse({
        ...validData,
        subjective: "Pusing",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("minimal 10 karakter");
      }
    });

    test("3. Negatif: Tekanan darah di luar rentang fisiologis (sistolik < 70) ditolak", () => {
      const result = PemeriksaanKlinisSchema.safeParse({
        ...validData,
        systolic: 65,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("minimal 70 mmHg");
      }
    });

    test("4. Negatif: Kode ICD-10 di luar daftar enum resmi ditolak", () => {
      const result = PemeriksaanKlinisSchema.safeParse({
        ...validData,
        icd10: "INVALID_CODE",
      });
      expect(result.success).toBe(false);
    });

    test("5. Batas: Kotak centang medikolegal bernilai false ditolak (Fail-Closed)", () => {
      const result = PemeriksaanKlinisSchema.safeParse({
        ...validData,
        isMedicallyConfirmed: false,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("wajib mencentang konfirmasi");
      }
    });
  });

  describe("Auth Schemas (Login, Pasien, Nakes)", () => {
    test("1. Positif: Login valid", () => {
      const result = LoginSchema.safeParse({
        identifier: "dr_andi",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    test("2. Negatif: Password login kurang dari 6 karakter ditolak", () => {
      const result = LoginSchema.safeParse({
        identifier: "dr_andi",
        password: "123",
      });
      expect(result.success).toBe(false);
    });

    test("3. Positif: Registrasi pasien dengan NIK 16 digit dan berkas lengkap diterima", () => {
      const result = RegisterPasienSchema.safeParse({
        nik: "3171011102900001",
        namaLengkap: "Budi Santoso",
        email: "budi@resilio.id",
        phone: "081234567890",
        tanggalLahir: "1990-02-11",
        alamat: "Jl. Diponegoro No. 10 Jakarta",
        golDarah: "O+",
        ktpUploaded: true,
        selfieUploaded: true,
      });
      expect(result.success).toBe(true);
    });

    test("4. Negatif: NIK kurang dari 16 digit angka ditolak", () => {
      const result = RegisterPasienSchema.safeParse({
        nik: "3171011102",
        namaLengkap: "Budi Santoso",
        email: "budi@resilio.id",
        phone: "081234567890",
        tanggalLahir: "1990-02-11",
        alamat: "Jl. Diponegoro No. 10 Jakarta",
        golDarah: "O+",
        ktpUploaded: true,
        selfieUploaded: true,
      });
      expect(result.success).toBe(false);
    });

    test("5. Positif: Registrasi nakes kredensial lengkap diterima", () => {
      const result = RegisterNakesSchema.safeParse({
        nik: "3171019901850002",
        namaLengkap: "dr. Andi Pratama, Sp.PD",
        strNumber: "STR-123456789",
        sipNumber: "SIP-456789012",
        spesialisasi: "Spesialis Penyakit Dalam",
        faskesNama: "RSUP Dr. Sardjito",
        strDokumenUploaded: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Triage & Admisi Schemas", () => {
    test("1. Positif: Skema triase vital signs valid", () => {
      const result = TriaseSchema.safeParse({
        systolic: 120,
        diastolic: 80,
        heartRate: 80,
        temperature: 36.8,
        respiratoryRate: 18,
        spo2: 99,
        beratBadan: 70,
        tinggiBadan: 172,
        triaseLevel: "HIJAU",
      });
      expect(result.success).toBe(true);
    });

    test("2. Negatif: NIK walk-in mengandung huruf ditolak", () => {
      const result = WalkInAdmisiSchema.safeParse({
        nik: "317101ABCD900001",
        keluhan: "Batuk pilek demam tinggi",
        poli: "Poli Umum",
      });
      expect(result.success).toBe(false);
    });

    test("3. Positif: Penugasan DPJP dengan PIN 6 digit valid", () => {
      const result = AssignDpjpSchema.safeParse({
        aptId: "APT-2026-001",
        doctorId: "DOC-01",
        inputPin: "123456",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Patient Booking & Ticket Schemas", () => {
    test("1. Positif: Booking jadwal valid", () => {
      const result = BookingSchema.safeParse({
        faskesId: "FAS-01",
        dokterId: "DOC-01",
        tanggal: "2026-10-25",
        jam: "09:00",
        keluhanAwal: "Konsultasi rutin evaluasi tensi",
        autoConsent: true,
      });
      expect(result.success).toBe(true);
    });

    test("2. Positif: Tiket kendala valid", () => {
      const result = TroubleTicketSchema.safeParse({
        kategori: "DATA_MISMATCH",
        judul: "Perbedaan data resep obat",
        deskripsi: "Riwayat obat yang tampil berbeda dengan cetakan fisik dari RS.",
      });
      expect(result.success).toBe(true);
    });
  });
});
