"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/auth";
import {
  CanonicalSoapPayload,
  decryptMedicalRecordPayload,
} from "@/features/medical-records/crypto-service";
import { createAuditLogServerAction } from "@/lib/actions/audit";
import {
  getPatientDetailForDoctorServerAction,
  executeBreakGlassServerAction,
  addPrescriptionToMedicalRecordServerAction,
  addLabResultToMedicalRecordServerAction,
  addProcedureToMedicalRecordServerAction,
} from "@/lib/actions/clinical";
import {
  PrintableMedicalResume,
  PrintableRecordData,
} from "@/components/clinical/PrintableMedicalResume";
import { ClinicalActionModals } from "@/features/medical-records/patient-detail/ClinicalActionModals";
import {
  DoctorMedicalRecordRow,
  MedicalRecordItemCard,
} from "@/features/medical-records/patient-detail/MedicalRecordItemCard";

type PatientDetailResponse = Awaited<ReturnType<typeof getPatientDetailForDoctorServerAction>>;

export function PatientDetailWorkspace({ patientId }: { patientId: string }) {
  const [data, setData] = useState<PatientDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, CanonicalSoapPayload>>({});
  const [hmacStatusMap, setHmacStatusMap] = useState<Record<string, boolean>>({});
  const [decryptErrorMap, setDecryptErrorMap] = useState<Record<string, string>>({});

  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState(
    "Pasien Tidak Sadarkan Diri / Koma di IGD"
  );
  const [isBreakGlassActive, setIsBreakGlassActive] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const [printRecordData, setPrintRecordData] = useState<PrintableRecordData | null>(null);

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionInput, setPrescriptionInput] = useState("");
  const [signaInput, setSignaInput] = useState("3x1 tablet sesudah makan");

  const [showLabModal, setShowLabModal] = useState(false);
  const [labTestName, setLabTestName] = useState("Darah Lengkap (Hematologi)");
  const [labResultValue, setLabResultValue] = useState("");
  const [labReferenceRange, setLabReferenceRange] = useState("4.000 - 10.000 /uL");
  const [labNotes, setLabNotes] = useState("");

  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [icd9Code, setIcd9Code] = useState("89.52");
  const [procedureName, setProcedureName] = useState("Elektrokardiogram (EKG 12-Lead)");
  const [performerRole, setPerformerRole] = useState<"DOKTER" | "STAF">("DOKTER");
  const [procedureNotes, setProcedureNotes] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const loadPatientDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = getUserSession();
      const res = await getPatientDetailForDoctorServerAction(patientId, session?.id);
      setData(res);
    } catch (err) {
      console.warn("Failed fetching patient detail from PostgreSQL:", err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPatientDetail();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPatientDetail]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Memuat berkas rekam medis & memvalidasi izin consent dari PostgreSQL...
        </p>
      </div>
    );
  }

  if (!data || !data.success || !data.patient) {
    return (
      <div className="p-8 md:p-12 rounded-3xl bg-white border border-slate-200 text-center max-w-xl mx-auto my-8 space-y-4">
        <h2 className="text-xl font-black text-slate-900">Data Pasien Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">
          {data?.message || `ID atau NIK pasien ${patientId} tidak terdaftar di PostgreSQL.`}
        </p>
        <Link
          href="/nakes/pasien-lookup"
          className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider"
        >
          ← Kembali ke Daftar Pasien
        </Link>
      </div>
    );
  }

  const { patient, accessAllowed, medicalRecords = [], appointments = [] } = data;
  const patientKey = patient.encryptionKeyHex;

  const handleDecryptRecord = async (record: DoctorMedicalRecordRow) => {
    setDecryptErrorMap((prev) => {
      const next = { ...prev };
      delete next[record.id];
      return next;
    });

    const result = await decryptMedicalRecordPayload(
      {
        encryptedPayload: record.encryptedPayload,
        ivHex: record.ivHex,
        hmacDigest: record.hmacDigest,
      },
      patientKey,
      { patientId: patient.id, recordId: record.id, version: record.version }
    );

    if (result.ok) {
      setHmacStatusMap((prev) => ({ ...prev, [record.id]: true }));
      setDecryptedMap((prev) => ({ ...prev, [record.id]: result.data }));
      return;
    }

    setHmacStatusMap((prev) => ({ ...prev, [record.id]: false }));
    setDecryptedMap((prev) => {
      const next = { ...prev };
      delete next[record.id];
      return next;
    });
    setDecryptErrorMap((prev) => ({ ...prev, [record.id]: result.message }));

    await createAuditLogServerAction({
      action: "HMAC_MISMATCH",
      targetResource: `/api/rme/record/${record.id}`,
      severity: "CRITICAL",
      detail: `Fail-Closed Triggered (${result.errorCode}): ${result.message} [Pasien: ${patient.id}]`,
    }).catch(() => {});
  };

  const handleExecuteBreakGlass = async () => {
    const res = await executeBreakGlassServerAction({
      patientId: patient.id,
      reason: breakGlassReason,
    });
    if (res.success) {
      setShowBreakGlassModal(false);
      setIsBreakGlassActive(true);
      setNotif(res.message || "Protokol Break-Glass IGD diaktifkan (12 jam).");
      await loadPatientDetail();
    } else {
      setNotif(res.message || "Gagal mengaktifkan Break-Glass.");
    }
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionInput.trim()) return;
    setIsSubmittingAction(true);
    try {
      const fullPrescription = `${prescriptionInput.trim()} (${signaInput.trim()})`;
      const res = await addPrescriptionToMedicalRecordServerAction({
        patientId: patient.id,
        recordId: medicalRecords[0]?.id,
        prescriptions: [fullPrescription],
      });
      setNotif(res.message || "Resep diperbarui.");
      if (res.success) {
        setShowPrescriptionModal(false);
        setPrescriptionInput("");
        await loadPatientDetail();
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddLabResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labResultValue.trim()) return;
    setIsSubmittingAction(true);
    try {
      const res = await addLabResultToMedicalRecordServerAction({
        patientId: patient.id,
        recordId: medicalRecords[0]?.id,
        labTestName,
        labResultValue: labResultValue.trim(),
        referenceRange: labReferenceRange.trim(),
        notes: labNotes.trim(),
      });
      setNotif(res.message || "Hasil lab dicatat.");
      if (res.success) {
        setShowLabModal(false);
        setLabResultValue("");
        setLabNotes("");
        await loadPatientDetail();
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureName.trim()) return;
    setIsSubmittingAction(true);
    try {
      const res = await addProcedureToMedicalRecordServerAction({
        patientId: patient.id,
        recordId: medicalRecords[0]?.id,
        icd9Code,
        procedureName: procedureName.trim(),
        performerRole,
        notes: procedureNotes.trim(),
      });
      setNotif(res.message || "Tindakan dicatat.");
      if (res.success) {
        setShowProcedureModal(false);
        setProcedureNotes("");
        await loadPatientDetail();
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const activeQueuedApt = appointments.find(
    (a) => a.status !== "COMPLETED" && a.status !== "CANCELLED"
  );
  const latestTriage = appointments[0]?.triageAssessment;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
        <Link href="/nakes" className="hover:underline">
          Stasiun Nakes
        </Link>
        <span>/</span>
        <Link href="/nakes/pasien-lookup" className="hover:underline">
          Daftar Pasien
        </Link>
        <span>/</span>
        <span>Rekam Medis Pasien</span>
      </div>

      {notif && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold"
        >
          {notif}
        </div>
      )}

      {/* Kartu Profil Pasien */}
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {patient.mrn}
              </span>
              <span className="text-xs font-mono text-slate-600">NIK: {patient.nik}</span>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  accessAllowed || isBreakGlassActive
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}
              >
                {accessAllowed || isBreakGlassActive
                  ? isBreakGlassActive
                    ? "Akses Darurat Break-Glass"
                    : "Consent Pasien Aktif"
                  : "Akses Terkunci (Zero-Trust)"}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">{patient.name}</h1>
            <p className="text-xs text-slate-600">
              Gender: {patient.gender} • Gol. Darah: <strong>{patient.bloodType}</strong> • Kontak:{" "}
              {patient.phone}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {accessAllowed ? (
              <>
                {activeQueuedApt && (
                  <Link
                    href={`/nakes/periksa/${activeQueuedApt.id}`}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase"
                  >
                    Buka Ruang Periksa →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Resep
                </button>
                <button
                  type="button"
                  onClick={() => setShowLabModal(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Lab
                </button>
                <button
                  type="button"
                  onClick={() => setShowProcedureModal(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Tindakan
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase cursor-pointer"
              >
                Aktifkan Break-Glass IGD
              </button>
            )}
          </div>
        </div>

        {accessAllowed && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-600">Alergi Kritis:</span>
              {patient.allergies.length > 0 ? (
                patient.allergies.map((al) => (
                  <span
                    key={al}
                    className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-black uppercase text-[10px]"
                  >
                    {al}
                  </span>
                ))
              ) : (
                <span className="text-emerald-700 font-semibold">Tidak ada alergi tercatat</span>
              )}
            </div>
            {latestTriage && (
              <span className="font-mono text-slate-600">
                Triase Terbaru ({latestTriage.triaseLevel}): {latestTriage.systolic}/
                {latestTriage.diastolic} mmHg • SpO2 {latestTriage.spo2}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Daftar Rekam Medis */}
      {!accessAllowed ? (
        <div className="p-8 rounded-3xl bg-red-50 border border-red-200 text-center space-y-3">
          <h2 className="text-lg font-black text-red-900">
            Akses Rekam Medis Ditolak (403 Zero-Trust BOLA Guard)
          </h2>
          <p className="text-xs text-red-800 max-w-xl mx-auto">
            Pasien belum memberikan tiket consent aktif kepada Anda. Kunci dekripsi dan isi rekam
            medis tidak dikirim oleh server. Gunakan protokol darurat Break-Glass hanya untuk kasus
            gawat darurat IGD.
          </p>
        </div>
      ) : medicalRecords.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-xs text-slate-500">
          Belum ada berkas rekam medis tersimpan untuk pasien ini di PostgreSQL.
        </div>
      ) : (
        <div className="space-y-4">
          {medicalRecords.map((rec) => (
            <MedicalRecordItemCard
              key={rec.id}
              record={rec}
              decrypted={decryptedMap[rec.id]}
              hmacValid={hmacStatusMap[rec.id]}
              decryptError={decryptErrorMap[rec.id]}
              onDecrypt={() => void handleDecryptRecord(rec)}
              onPrint={() => {
                const dec = decryptedMap[rec.id];
                if (!dec) return;
                setPrintRecordData({
                  recordId: rec.id,
                  faskesNama: rec.faskesNama,
                  patientNama: patient.name,
                  patientNik: patient.nik,
                  patientMrn: patient.mrn,
                  patientBloodType: patient.bloodType,
                  tanggalPeriksa: rec.createdAt,
                  poli: appointments[0]?.poli || "Poli Spesialis",
                  dokterNama: rec.dokterNama,
                  dokterSpecialty: rec.dokterSpecialty,
                  dokterStr: rec.dokterStr,
                  dokterSip: rec.dokterSip,
                  triaseLevel: latestTriage?.triaseLevel || "HIJAU",
                  triageVitals: dec.vitalSigns
                    ? {
                        systolic: dec.vitalSigns.systolic,
                        diastolic: dec.vitalSigns.diastolic,
                        heartRate: dec.vitalSigns.heartRate,
                        temperature: dec.vitalSigns.temperature,
                        spo2: dec.vitalSigns.spo2,
                      }
                    : undefined,
                  subjective: dec.subjective,
                  diagnosisIcd10: rec.primaryIcd10,
                  diagnosisShort: rec.diagnosisShort,
                  prescriptions: dec.plan?.resep || [],
                  tindakanMedis: dec.plan?.tindakan,
                  version: rec.version,
                  addendumReason: rec.addendumReason || undefined,
                });
              }}
            />
          ))}
        </div>
      )}

      <ClinicalActionModals
        patientName={patient.name}
        showBreakGlassModal={showBreakGlassModal}
        setShowBreakGlassModal={setShowBreakGlassModal}
        breakGlassReason={breakGlassReason}
        setBreakGlassReason={setBreakGlassReason}
        onExecuteBreakGlass={() => void handleExecuteBreakGlass()}
        showPrescriptionModal={showPrescriptionModal}
        setShowPrescriptionModal={setShowPrescriptionModal}
        prescriptionInput={prescriptionInput}
        setPrescriptionInput={setPrescriptionInput}
        signaInput={signaInput}
        setSignaInput={setSignaInput}
        onAddPrescription={(e) => void handleAddPrescription(e)}
        showLabModal={showLabModal}
        setShowLabModal={setShowLabModal}
        labTestName={labTestName}
        setLabTestName={setLabTestName}
        labResultValue={labResultValue}
        setLabResultValue={setLabResultValue}
        labReferenceRange={labReferenceRange}
        setLabReferenceRange={setLabReferenceRange}
        labNotes={labNotes}
        setLabNotes={setLabNotes}
        onAddLabResult={(e) => void handleAddLabResult(e)}
        showProcedureModal={showProcedureModal}
        setShowProcedureModal={setShowProcedureModal}
        icd9Code={icd9Code}
        setIcd9Code={setIcd9Code}
        procedureName={procedureName}
        setProcedureName={setProcedureName}
        performerRole={performerRole}
        setPerformerRole={setPerformerRole}
        procedureNotes={procedureNotes}
        setProcedureNotes={setProcedureNotes}
        onAddProcedure={(e) => void handleAddProcedure(e)}
        isSubmittingAction={isSubmittingAction}
      />

      {printRecordData && (
        <PrintableMedicalResume data={printRecordData} onClose={() => setPrintRecordData(null)} />
      )}
    </div>
  );
}
