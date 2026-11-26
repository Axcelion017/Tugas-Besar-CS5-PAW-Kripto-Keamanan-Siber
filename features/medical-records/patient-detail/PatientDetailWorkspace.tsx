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
import { PatientProfileCard } from "@/features/medical-records/patient-detail/PatientProfileCard";
import { PatientRecordsSection } from "@/features/medical-records/patient-detail/PatientRecordsSection";
import type { DoctorMedicalRecordRow } from "@/features/medical-records/patient-detail/MedicalRecordItemCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

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
      <Breadcrumb
        items={[
          { label: "Stasiun Nakes", href: "/nakes" },
          { label: "Daftar Pasien", href: "/nakes/pasien-lookup" },
          { label: "Rekam Medis Pasien" },
        ]}
      />

      {notif && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold"
        >
          {notif}
        </div>
      )}

      {/* Kartu Profil Pasien */}
      <PatientProfileCard
        patient={patient}
        accessAllowed={accessAllowed}
        isBreakGlassActive={isBreakGlassActive}
        activeQueuedAptId={activeQueuedApt?.id}
        latestTriage={latestTriage}
        onOpenPrescription={() => setShowPrescriptionModal(true)}
        onOpenLab={() => setShowLabModal(true)}
        onOpenProcedure={() => setShowProcedureModal(true)}
        onOpenBreakGlass={() => setShowBreakGlassModal(true)}
      />

      {/* Daftar Rekam Medis */}
      <PatientRecordsSection
        accessAllowed={accessAllowed}
        patient={patient}
        medicalRecords={medicalRecords}
        decryptedMap={decryptedMap}
        hmacStatusMap={hmacStatusMap}
        decryptErrorMap={decryptErrorMap}
        defaultPoli={appointments[0]?.poli || "Poli Spesialis"}
        defaultTriaseLevel={latestTriage?.triaseLevel || "HIJAU"}
        onDecrypt={(rec) => void handleDecryptRecord(rec)}
        onSelectPrint={(printData) => setPrintRecordData(printData)}
      />

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
