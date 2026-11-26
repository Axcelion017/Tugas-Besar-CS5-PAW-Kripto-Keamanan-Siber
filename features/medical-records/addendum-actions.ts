"use server";

import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/features/auth/guard";
import {
  CanonicalSoapPayload,
  decryptMedicalRecordPayload,
  encryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import {
  assertFaskesNotQuarantined,
  hasActiveEncounterForDoctor,
  hasValidGrantForDoctor,
} from "@/features/medical-records/helpers";

export async function addPrescriptionToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  prescriptions: string[];
  doctorId?: string;
}) {
  const auth = await requireSession(["nakes"], `addPrescription:${params.patientId}`);
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const docId = auth.session.id;

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      include: { accessGrants: true, appointments: true },
    });
    if (!patient) return { success: false, message: "Data pasien tidak ditemukan." };

    const killSwitch = await assertFaskesNotQuarantined(
      auth.session.faskesId || "FAS-01",
      "Peresepan obat"
    );
    if (!killSwitch.ok) return { success: false, message: killSwitch.message };

    const allowed =
      hasValidGrantForDoctor(patient.accessGrants, docId, auth.session.faskesId) ||
      hasActiveEncounterForDoctor(patient.appointments, docId);
    if (!allowed) {
      return {
        success: false,
        message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk meresepkan obat.",
      };
    }

    const targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    let basePayload: CanonicalSoapPayload = {
      subjective: "Pemeriksaan dan peresepan obat poliklinik spesialis.",
      vitalSigns: { systolic: 120, diastolic: 80, heartRate: 75, temperature: 36.5, spo2: 98 },
      assessment: { icd10: "Z71.9", desc: "Konsultasi Terapi Farmasi" },
      plan: { resep: [], tindakan: "Konsumsi obat sesuai dosis dan jadwal." },
    };

    if (targetRecord) {
      const decrypted = await decryptMedicalRecordPayload(
        {
          encryptedPayload: targetRecord.encryptedPayload,
          ivHex: targetRecord.ivHex,
          hmacDigest: targetRecord.hmacDigest,
        },
        patient.encryptionKeyHex,
        { patientId: patient.id, recordId: targetRecord.id, version: targetRecord.version }
      );
      if (decrypted.ok) basePayload = decrypted.data;
    }

    const mergedPayload: CanonicalSoapPayload = {
      ...basePayload,
      plan: {
        ...(basePayload.plan || {}),
        resep: Array.from(new Set([...(basePayload.plan?.resep || []), ...params.prescriptions])),
      },
      meta: {
        ...(basePayload.meta || {}),
        dokterId: docId,
        dokterNama: auth.session.name,
        timestamp: new Date().toISOString(),
      },
    };

    const newVersion = targetRecord ? targetRecord.version + 1 : 1;
    const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
    const bundle = await encryptMedicalRecordPayload(mergedPayload, patient.encryptionKeyHex, {
      patientId: patient.id,
      recordId: newRecordId,
      version: newVersion,
    });

    const created = await prisma.medicalRecord.create({
      data: {
        id: newRecordId,
        patientId: patient.id,
        doctorId: docId,
        faskesId: targetRecord?.faskesId || auth.session.faskesId || "FAS-01",
        appointmentId: targetRecord?.appointmentId || null,
        parentRecordId: targetRecord?.id || null,
        primaryIcd10: targetRecord?.primaryIcd10 || "Z71.9",
        diagnosisShort: targetRecord?.diagnosisShort || "Konsultasi Terapi Farmasi",
        encryptedPayload: bundle.encryptedPayload,
        ivHex: bundle.ivHex,
        hmacDigest: bundle.hmacDigest,
        version: newVersion,
        addendumReason: targetRecord
          ? `Addendum Penambahan Resep Obat oleh ${auth.session.name}`
          : null,
      },
    });

    return {
      success: true,
      message: "Resep obat berhasil dienkripsi AEAD (Addendum) dan disinkronkan ke rekam medis pasien.",
      recordId: created.id,
    };
  } catch (err: unknown) {
    console.warn("Add prescription error:", err);
    return { success: false, message: "Gagal menyimpan resep obat ke rekam medis." };
  }
}

export async function addLabResultToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  labTestName: string;
  labResultValue: string;
  referenceRange: string;
  notes?: string;
  doctorId?: string;
}) {
  const auth = await requireSession(["nakes", "staf"], `addLabResult:${params.patientId}`);
  if (!auth.ok) return { success: false, message: auth.message };

  const docId = auth.role === "nakes" ? auth.session.id : "DOC-01";

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      include: { accessGrants: true, appointments: true },
    });
    if (!patient) return { success: false, message: "Data pasien tidak ditemukan." };

    const killSwitch = await assertFaskesNotQuarantined(
      auth.session.faskesId || "FAS-01",
      "Input hasil lab"
    );
    if (!killSwitch.ok) return { success: false, message: killSwitch.message };

    if (auth.role === "nakes") {
      const allowed =
        hasValidGrantForDoctor(patient.accessGrants, docId, auth.session.faskesId) ||
        hasActiveEncounterForDoctor(patient.appointments, docId);
      if (!allowed) {
        return {
          success: false,
          message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk pasien ini.",
        };
      }
    }

    let targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    if (!targetRecord) {
      const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
      const bundle = await encryptMedicalRecordPayload(
        {
          subjective: `Pemeriksaan penunjang laboratorium: ${params.labTestName}`,
          assessment: { icd10: "Z01.7", desc: params.labTestName },
          labResults: [
            {
              test: params.labTestName,
              value: params.labResultValue,
              ref: params.referenceRange,
              notes: params.notes,
            },
          ],
        },
        patient.encryptionKeyHex,
        { patientId: patient.id, recordId: newRecordId, version: 1 }
      );

      targetRecord = await prisma.medicalRecord.create({
        data: {
          id: newRecordId,
          patientId: patient.id,
          doctorId: docId,
          faskesId: auth.session.faskesId || "FAS-01",
          primaryIcd10: "Z01.7",
          diagnosisShort: `Pemeriksaan Laboratorium: ${params.labTestName}`,
          encryptedPayload: bundle.encryptedPayload,
          ivHex: bundle.ivHex,
          hmacDigest: bundle.hmacDigest,
          version: 1,
        },
      });
    }

    const imageId = `LAB-${Date.now().toString().slice(-6)}`;
    const labAttachmentBundle = await encryptMedicalRecordPayload(
      {
        subjective: `Lampiran Hasil Lab: ${params.labTestName}`,
        labResults: [
          {
            test: params.labTestName,
            value: params.labResultValue,
            ref: params.referenceRange,
            notes: params.notes || "Hasil uji laboratorium terverifikasi analis",
          },
        ],
      },
      patient.encryptionKeyHex,
      { patientId: patient.id, recordId: imageId, version: 1 }
    );

    await prisma.medicalImage.create({
      data: {
        id: imageId,
        medicalRecordId: targetRecord.id,
        title: `Hasil Lab: ${params.labTestName} (${params.labResultValue})`,
        type: "LAB",
        encryptedBlobHex: labAttachmentBundle.encryptedPayload,
        ivHex: labAttachmentBundle.ivHex,
        hmacDigest: labAttachmentBundle.hmacDigest,
        mimeType: "application/json",
        notes: `Nilai: ${params.labResultValue} (Rujukan: ${params.referenceRange}). ${params.notes || ""}`,
      },
    });

    return {
      success: true,
      message: `Hasil LAB ${params.labTestName} berhasil dienkripsi AEAD dan dicatat ke rekam medis pasien.`,
      recordId: targetRecord.id,
    };
  } catch (err: unknown) {
    console.warn("Add Lab error:", err);
    return { success: false, message: "Gagal menyimpan hasil laboratorium ke rekam medis." };
  }
}

export async function addProcedureToMedicalRecordServerAction(params: {
  patientId: string;
  recordId?: string;
  icd9Code: string;
  procedureName: string;
  performerRole: "DOKTER" | "STAF";
  notes?: string;
  doctorId?: string;
}) {
  const auth = await requireSession(["nakes", "staf"], `addProcedure:${params.patientId}`);
  if (!auth.ok) return { success: false, message: auth.message };

  const docId = auth.role === "nakes" ? auth.session.id : "DOC-01";

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      include: { accessGrants: true, appointments: true },
    });
    if (!patient) return { success: false, message: "Data pasien tidak ditemukan." };

    const killSwitch = await assertFaskesNotQuarantined(
      auth.session.faskesId || "FAS-01",
      "Pencatatan tindakan medis"
    );
    if (!killSwitch.ok) return { success: false, message: killSwitch.message };

    if (auth.role === "nakes") {
      const allowed =
        hasValidGrantForDoctor(patient.accessGrants, docId, auth.session.faskesId) ||
        hasActiveEncounterForDoctor(patient.appointments, docId);
      if (!allowed) {
        return {
          success: false,
          message: "403 Forbidden: Tidak ada izin consent atau encounter aktif untuk pasien ini.",
        };
      }
    }

    const targetRecord = params.recordId
      ? await prisma.medicalRecord.findUnique({ where: { id: params.recordId } })
      : await prisma.medicalRecord.findFirst({
          where: { patientId: params.patientId },
          orderBy: { createdAt: "desc" },
        });

    let basePayload: CanonicalSoapPayload = {
      subjective: `Tindakan medis: ${params.procedureName}`,
      assessment: { icd10: "Z01.8", desc: params.procedureName },
      plan: { resep: [], tindakan: "" },
    };

    if (targetRecord) {
      const decrypted = await decryptMedicalRecordPayload(
        {
          encryptedPayload: targetRecord.encryptedPayload,
          ivHex: targetRecord.ivHex,
          hmacDigest: targetRecord.hmacDigest,
        },
        patient.encryptionKeyHex,
        { patientId: patient.id, recordId: targetRecord.id, version: targetRecord.version }
      );
      if (decrypted.ok) basePayload = decrypted.data;
    }

    const existingTindakan = basePayload.plan?.tindakan || "";
    const newEntry = `[${params.icd9Code}] ${params.procedureName} (${params.performerRole})${
      params.notes ? `: ${params.notes}` : ""
    }`;

    const mergedPayload: CanonicalSoapPayload = {
      ...basePayload,
      plan: {
        ...(basePayload.plan || {}),
        tindakan: existingTindakan ? `${existingTindakan} | ${newEntry}` : newEntry,
      },
      meta: {
        ...(basePayload.meta || {}),
        dokterId: docId,
        dokterNama: auth.session.name,
        timestamp: new Date().toISOString(),
      },
    };

    const newVersion = targetRecord ? targetRecord.version + 1 : 1;
    const newRecordId = `REC-${Date.now().toString().slice(-6)}`;
    const bundle = await encryptMedicalRecordPayload(mergedPayload, patient.encryptionKeyHex, {
      patientId: patient.id,
      recordId: newRecordId,
      version: newVersion,
    });

    const created = await prisma.medicalRecord.create({
      data: {
        id: newRecordId,
        patientId: patient.id,
        doctorId: docId,
        faskesId: targetRecord?.faskesId || auth.session.faskesId || "FAS-01",
        appointmentId: targetRecord?.appointmentId || null,
        parentRecordId: targetRecord?.id || null,
        primaryIcd10: targetRecord?.primaryIcd10 || "Z01.8",
        diagnosisShort:
          targetRecord?.diagnosisShort ||
          `Tindakan ${params.performerRole}: ${params.procedureName}`,
        encryptedPayload: bundle.encryptedPayload,
        ivHex: bundle.ivHex,
        hmacDigest: bundle.hmacDigest,
        version: newVersion,
        addendumReason: targetRecord
          ? `Addendum Tindakan [${params.icd9Code}] oleh ${auth.session.name}`
          : null,
      },
    });

    return {
      success: true,
      message: `Tindakan ${params.procedureName} berhasil dienkripsi AEAD (Addendum) dan dicatat ke rekam medis pasien.`,
      recordId: created.id,
    };
  } catch (err: unknown) {
    console.warn("Add Procedure error:", err);
    return { success: false, message: "Gagal menyimpan tindakan medis ke rekam medis." };
  }
}
