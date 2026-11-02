// prisma/seed.ts
// Skrip Seeder Idempoten (menggunakan UPSERT) untuk Resilio-Health HIS
// Sesuai prinsip praktikum Modul 6: aman dijalankan berulang kali tanpa memicu Unique Constraint Violation

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db/prisma";
import { UserRole, FamilyRelation, GrantEntityType, TriaseLevel, ImageType } from "@prisma/client";
import {
  MOCK_FASKES,
  MOCK_DOCTORS,
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_ENCRYPTED_RECORDS,
  MOCK_ACCESS_GRANTS,
} from "../lib/db/mockData";
import { DEMO_USERS } from "../lib/auth/auth";

async function main() {
  console.log("🚀 Memulai proses database seeding idempoten Resilio-Health...");

  // 1. SEED PENGGUNA INDUK (USERS)
  console.log("-> Seeding Users...");
  for (const user of DEMO_USERS) {
    const role: UserRole =
      user.role === "doctor"
        ? UserRole.nakes
        : user.role === "patient"
        ? UserRole.pasien
        : (user.role as UserRole);

    const realHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        email: user.email,
        passwordHash: realHash,
        role,
        status: "VERIFIED",
      },
      create: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash: realHash,
        role,
        status: "VERIFIED",
      },
    });
  }

  // Akun tambahan untuk dokter lain (DOC-02, DOC-03, DOC-04)
  const defaultDocHash = await bcrypt.hash("doctor123", 10);
  for (const doc of MOCK_DOCTORS) {
    if (doc.id === "DOC-01") continue;
    const username = doc.id.toLowerCase();
    await prisma.user.upsert({
      where: { id: doc.id },
      update: {
        username,
        email: `${username}@resilio.id`,
        passwordHash: defaultDocHash,
        role: UserRole.nakes,
        status: "VERIFIED",
      },
      create: {
        id: doc.id,
        username,
        email: `${username}@resilio.id`,
        passwordHash: defaultDocHash,
        role: UserRole.nakes,
        status: "VERIFIED",
      },
    });
  }

  // Akun tambahan untuk pasien lain (P-102, P-103)
  const defaultPatientHash = await bcrypt.hash("patient123", 10);
  for (const p of MOCK_PATIENTS) {
    if (p.id === "P-101") continue;
    const username = p.id.toLowerCase();
    await prisma.user.upsert({
      where: { id: p.id },
      update: {
        username,
        email: `${username}@patient.resilio.id`,
        passwordHash: defaultPatientHash,
        role: UserRole.pasien,
        status: "VERIFIED",
      },
      create: {
        id: p.id,
        username,
        email: `${username}@patient.resilio.id`,
        passwordHash: defaultPatientHash,
        role: UserRole.pasien,
        status: "VERIFIED",
      },
    });
  }

  // 2. SEED FASILITAS PELAYANAN KESEHATAN (FASKES)
  console.log("-> Seeding Master Faskes...");
  for (const faskes of MOCK_FASKES) {
    const tipeMap: Record<string, "RUMAH_SAKIT" | "KLINIK_PRATAMA" | "PUSKESMAS"> = {
      "Rumah Sakit": "RUMAH_SAKIT",
      "Klinik Pratama": "KLINIK_PRATAMA",
      Puskesmas: "PUSKESMAS",
    };

    await prisma.faskes.upsert({
      where: { id: faskes.id },
      update: {
        nama: faskes.nama,
        kodeFaskes: faskes.kodeFaskes,
        alamat: faskes.alamat,
        kota: faskes.kota,
        kontak: faskes.kontak,
        spesialisasiList: faskes.spesialisasiList,
        kategoriPenyakit: faskes.kategoriPenyakit,
        status: faskes.status,
      },
      create: {
        id: faskes.id,
        kodeFaskes: faskes.kodeFaskes,
        nama: faskes.nama,
        tipe: tipeMap[faskes.tipe] || "RUMAH_SAKIT",
        alamat: faskes.alamat,
        kota: faskes.kota,
        kontak: faskes.kontak,
        spesialisasiList: faskes.spesialisasiList,
        kategoriPenyakit: faskes.kategoriPenyakit,
        status: faskes.status,
      },
    });
  }

  // 3. SEED DOKTER DPJP (DOCTORS)
  console.log("-> Seeding Doctors...");
  for (const doc of MOCK_DOCTORS) {
    await prisma.doctor.upsert({
      where: { id: doc.id },
      update: {
        name: doc.name,
        strNumber: doc.strNumber,
        sipNumber: doc.sipNumber,
        specialty: doc.specialty,
        faskesId: doc.faskesId,
        kuotaHarian: doc.kuotaHarian,
        fotoProfilUrl: doc.fotoProfilUrl,
        isActive: doc.accessStatus === "ACTIVE",
      },
      create: {
        id: doc.id,
        userId: doc.id,
        faskesId: doc.faskesId,
        name: doc.name,
        strNumber: doc.strNumber,
        sipNumber: doc.sipNumber,
        specialty: doc.specialty,
        kuotaHarian: doc.kuotaHarian,
        fotoProfilUrl: doc.fotoProfilUrl,
        isActive: doc.accessStatus === "ACTIVE",
      },
    });
  }

  // 4. SEED PROFIL STAF ADMISI & TRIASE (STAFF_MEMBERS)
  console.log("-> Seeding Staff Members...");
  const susterMaya = DEMO_USERS.find((u) => u.id === "STF-01")!;
  await prisma.staffMember.upsert({
    where: { id: susterMaya.id },
    update: {
      name: susterMaya.name,
      nip: "199308152020122005",
      posisi: susterMaya.posisiStaf || "Perawat Triase",
      faskesId: "FAS-01",
    },
    create: {
      id: susterMaya.id,
      userId: susterMaya.id,
      faskesId: "FAS-01",
      name: susterMaya.name,
      nip: "199308152020122005",
      posisi: susterMaya.posisiStaf || "Perawat Triase",
    },
  });

  // 5. SEED PROFIL PASIEN (PATIENTS)
  console.log("-> Seeding Patients...");
  for (const patient of MOCK_PATIENTS) {
    await prisma.patient.upsert({
      where: { id: patient.id },
      update: {
        name: patient.name,
        nik: patient.nik,
        bloodType: patient.bloodType,
        mrn: patient.mrn,
        allergies: patient.allergies,
        emergencyContactName: patient.emergencyContact.name,
        emergencyContactRelation: patient.emergencyContact.relation,
        emergencyContactPhone: patient.emergencyContact.phone,
        encryptionKeyHex: patient.encryptionKeyHex,
      },
      create: {
        id: patient.id,
        userId: patient.id,
        nik: patient.nik,
        name: patient.name,
        birthDate: new Date("1980-04-23"),
        gender: patient.gender,
        bloodType: patient.bloodType,
        mrn: patient.mrn,
        allergies: patient.allergies,
        emergencyContactName: patient.emergencyContact.name,
        emergencyContactRelation: patient.emergencyContact.relation,
        emergencyContactPhone: patient.emergencyContact.phone,
        encryptionKeyHex: patient.encryptionKeyHex,
      },
    });

    // Anggota keluarga (Family Proxy)
    if (patient.familyMembers) {
      const relMap: Record<string, FamilyRelation> = {
        Anak: FamilyRelation.Anak,
        "Orang Tua": FamilyRelation.Orang_Tua,
        Pasangan: FamilyRelation.Pasangan,
      };

      for (const fam of patient.familyMembers) {
        const relation = relMap[fam.relation] || FamilyRelation.Anak;
        await prisma.familyMember.upsert({
          where: { id: fam.id },
          update: {
            name: fam.name,
            nik: fam.nik,
            relation,
          },
          create: {
            id: fam.id,
            patientId: patient.id,
            nik: fam.nik,
            name: fam.name,
            relation,
            birthDate: new Date("2016-08-10"),
          },
        });
      }
    }
  }

  // 6. SEED ANTREAN KUNJUNGAN (APPOINTMENTS) & TRIASE
  console.log("-> Seeding Appointments & Triage Assessments...");
  for (const apt of MOCK_APPOINTMENTS) {
    await prisma.appointment.upsert({
      where: { id: apt.id },
      update: {
        status: apt.status,
        keluhanAwal: apt.keluhanAwal,
        consentActive: apt.consentActive,
        consentPin: apt.consentPin,
      },
      create: {
        id: apt.id,
        patientId: apt.pasienId,
        faskesId: apt.faskesId,
        doctorId: apt.dokterId,
        dpjpId: apt.dpjpId,
        tanggal: new Date(apt.tanggal),
        jam: apt.jam,
        poli: apt.poli,
        keluhanAwal: apt.keluhanAwal,
        consentActive: apt.consentActive,
        consentPin: apt.consentPin,
        status: apt.status,
      },
    });

    if (apt.triaseVitals && apt.triaseLevel) {
      const triaseMap: Record<string, TriaseLevel> = {
        HIJAU: TriaseLevel.HIJAU,
        KUNING: TriaseLevel.KUNING,
        MERAH: TriaseLevel.MERAH,
      };

      await prisma.triageAssessment.upsert({
        where: { appointmentId: apt.id },
        update: {
          systolic: apt.triaseVitals.systolic,
          diastolic: apt.triaseVitals.diastolic,
          heartRate: apt.triaseVitals.heartRate,
          temperature: apt.triaseVitals.temperature,
          respiratoryRate: apt.triaseVitals.respiratoryRate,
          spo2: apt.triaseVitals.spo2,
          triaseLevel: triaseMap[apt.triaseLevel] || TriaseLevel.HIJAU,
        },
        create: {
          id: `TRG-${apt.id.slice(-4)}`,
          appointmentId: apt.id,
          staffId: "STF-01",
          systolic: apt.triaseVitals.systolic,
          diastolic: apt.triaseVitals.diastolic,
          heartRate: apt.triaseVitals.heartRate,
          temperature: apt.triaseVitals.temperature,
          respiratoryRate: apt.triaseVitals.respiratoryRate,
          spo2: apt.triaseVitals.spo2,
          beratBadan: apt.triaseVitals.beratBadan,
          tinggiBadan: apt.triaseVitals.tinggiBadan,
          triaseLevel: triaseMap[apt.triaseLevel] || TriaseLevel.HIJAU,
          catatanPerawat: "Pengkajian triase fisik di loket admisi",
        },
      });
    }
  }

  // 7. SEED REKAM MEDIS ELEKTRONIK TERENKRIPSI (MEDICAL_RECORDS & CITRA)
  console.log("-> Seeding Encrypted Medical Records (AES-256-GCM + HMAC)...");
  for (const record of MOCK_ENCRYPTED_RECORDS) {
    await prisma.medicalRecord.upsert({
      where: { id: record.recordId },
      update: {
        primaryIcd10: record.primaryIcd10,
        diagnosisShort: record.diagnosisShort,
        encryptedPayload: record.encryptedPayload,
        ivHex: record.ivHex,
        hmacDigest: record.hmacDigest,
        version: record.version,
        isBreakGlass: record.isBreakGlass || false,
      },
      create: {
        id: record.recordId,
        patientId: record.patientId,
        doctorId: "DOC-01",
        faskesId: record.faskesId,
        primaryIcd10: record.primaryIcd10,
        diagnosisShort: record.diagnosisShort,
        encryptedPayload: record.encryptedPayload,
        ivHex: record.ivHex,
        hmacDigest: record.hmacDigest,
        version: record.version,
        isBreakGlass: record.isBreakGlass || false,
      },
    });

    if (record.medicalImages) {
      for (const img of record.medicalImages) {
        await prisma.medicalImage.upsert({
          where: { id: img.id },
          update: {
            title: img.title,
            type: img.type as ImageType,
            encryptedBlobHex: img.encryptedBlobHex,
            ivHex: img.ivHex,
            hmacDigest: img.hmacDigest,
            mimeType: img.mimeType,
            notes: img.notes,
          },
          create: {
            id: img.id,
            medicalRecordId: record.recordId,
            title: img.title,
            type: img.type as ImageType,
            encryptedBlobHex: img.encryptedBlobHex,
            ivHex: img.ivHex,
            hmacDigest: img.hmacDigest,
            mimeType: img.mimeType,
            notes: img.notes,
          },
        });
      }
    }
  }

  // 8. SEED PERSETUJUAN HAK AKSES PASIEN (ACCESS_GRANTS)
  console.log("-> Seeding Access Grants (UU PDP Consent)...");
  for (const grant of MOCK_ACCESS_GRANTS) {
    const entityType =
      grant.entityType === "DOKTER" ? GrantEntityType.DOKTER : GrantEntityType.FASKES;

    const cleanDateStr = grant.validUntil.replace(" WIB", "").trim();
    const validUntil = new Date(
      cleanDateStr.includes(" ") ? cleanDateStr.replace(" ", "T") + "+07:00" : cleanDateStr
    );

    await prisma.accessGrant.upsert({
      where: { id: grant.id },
      update: {
        scope: grant.scope,
        validUntil,
        isRevoked: grant.isRevoked,
      },
      create: {
        id: grant.id,
        patientId: grant.pasienId,
        entityId: grant.entityId,
        entityName: grant.entityNama,
        entityType,
        scope: grant.scope,
        validUntil,
        isRevoked: grant.isRevoked,
      },
    });
  }

  console.log("✅ Database seeding berhasil diselesaikan secara idempoten 100%!");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi kesalahan saat database seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
