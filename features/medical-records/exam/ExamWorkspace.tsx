"use client";

import React from "react";
import Link from "next/link";
import { PrintableMedicalResume } from "@/components/clinical/PrintableMedicalResume";
import { ConfirmModal } from "@/components/ui/Modal";
import { ToastBanner } from "@/components/ui/ToastBanner";
import { StickyPatientBanner } from "@/features/medical-records/exam/StickyPatientBanner";
import { ExamTabs1To3 } from "@/features/medical-records/exam/ExamTabs1To3";
import { ExamTabs4To5 } from "@/features/medical-records/exam/ExamTabs4To5";
import { useExamForm } from "@/features/medical-records/exam/useExamForm";
import {
  BIAYA_KONSULTASI,
  BIAYA_TINDAKAN,
  BIAYA_OBAT,
  buildExamPrintableData,
} from "@/features/medical-records/exam/exam-builders";

const EXAM_TABS = [
  [1, "Tab 1: Administratif & Alergi", []],
  [2, "Tab 2: Anamnesis & Fisik", ["subjective", "systolic", "diastolic", "heartRate", "temperature", "spo2"]],
  [3, "Tab 3: Diagnosis & Citra Medis", ["icd10"]],
  [4, "Tab 4: Penatalaksanaan & Resep", ["planPrescription", "planAction"]],
  [5, "Tab 5: CPPT & Pengesahan", ["isMedicallyConfirmed"]],
] as const;

export function ExamWorkspace({ bookingId }: { bookingId: string }) {
  const form = useExamForm(bookingId);

  if (form.notFound) {
    return (
      <div className="p-8 md:p-12 rounded-3xl bg-white border border-red-200 shadow-xl max-w-2xl mx-auto my-12 text-center space-y-5">
        <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
          404 - DATA TIDAK DITEMUKAN
        </span>
        <h2 className="text-2xl font-black text-slate-900">Jadwal Pemeriksaan Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">
          ID <span className="font-mono font-bold text-slate-800">{bookingId}</span> tidak terdaftar
          atau bukan merupakan wewenang DPJP Anda.
        </p>
        <Link
          href="/nakes"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider"
        >
          ← Kembali ke Stasiun Nakes
        </Link>
      </div>
    );
  }

  if (form.isLoading || !form.session || !form.appointment || !form.patient) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-teal-700 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Memverifikasi Otorisasi Sesi Pemeriksaan dari PostgreSQL...
        </p>
      </div>
    );
  }

  const { session, appointment, patient } = form;
  const isSubmitError =
    form.submitStatus?.startsWith("GALAT") || form.submitStatus?.startsWith("GAGAL");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
        <Link href="/nakes" className="hover:underline">
          Stasiun Nakes
        </Link>
        <span>/</span>
        <span>Pemeriksaan Klinis SOAP ({appointment.id})</span>
      </div>

      <StickyPatientBanner
        appointment={appointment}
        patient={patient}
        session={session}
        patientAllergies={form.patientAllergies}
        onOpenPrint={() => form.setIsPrintOpen(true)}
      />

      {form.submitStatus && (
        <div
          role={isSubmitError ? "alert" : "status"}
          className={`p-4 rounded-2xl border text-xs font-bold ${
            isSubmitError
              ? "bg-red-50 border-red-300 text-red-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}
        >
          {form.submitStatus}
        </div>
      )}

      {Object.keys(form.validationErrors).length > 0 && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1">
          <p className="font-bold uppercase text-[10px]">Validasi Medis (Zod v4):</p>
          <ul className="list-disc list-inside text-[11px]">
            {Object.values(form.validationErrors).map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={form.handleSaveAndSign}
        className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Dokumen Rekam Medis Elektronik Terpadu (Permenkes RI No. 24/2022)
            </h2>
            <p className="text-xs text-slate-600">
              Format 5-Tab: Administratif, Anamnesis/Fisik, ICD-10/Penunjang, Terapi/ICD-9, & CPPT/Resume
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={form.isAddendum}
              onChange={(e) => form.setIsAddendum(e.target.checked)}
              className="rounded text-teal-700"
            />
            <span>Mode Addendum</span>
          </label>
        </div>

        {form.isAddendum && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-xs">
            <label htmlFor="addendum-reason" className="block font-bold text-amber-900 uppercase text-[10px]">
              Alasan Klinis Revisi Addendum *
            </label>
            <input
              id="addendum-reason"
              type="text"
              required={form.isAddendum}
              value={form.addendumReason}
              onChange={(e) => form.setAddendumReason(e.target.value)}
              placeholder="Contoh: Koreksi dosis obat setelah hasil rontgen paru diterima..."
              className="w-full px-3 py-2 border rounded-xl bg-white text-sm"
            />
          </div>
        )}

        <div role="tablist" className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-2">
          {EXAM_TABS.map(([tabNum, label, tabKeys]) => {
            const hasTabError = tabKeys.some((k) => Boolean(form.validationErrors[k]));
            return (
              <button
                key={tabNum}
                type="button"
                role="tab"
                aria-selected={form.activeTab === tabNum}
                onClick={() => form.setActiveTab(tabNum)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer inline-flex items-center gap-1.5 ${
                  form.activeTab === tabNum
                    ? "bg-teal-700 text-white shadow-xs"
                    : hasTabError
                    ? "bg-red-50 text-red-800 border border-red-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{label}</span>
                {hasTabError && (
                  <span
                    aria-label="Terdapat kesalahan validasi pada tab ini"
                    className="w-2 h-2 rounded-full bg-red-600 inline-block"
                  />
                )}
              </button>
            );
          })}
        </div>

        <ExamTabs1To3
          activeTab={form.activeTab}
          appointment={appointment}
          patient={patient}
          patientAllergies={form.patientAllergies}
          subjective={form.subjective}
          setSubjective={form.setSubjective}
          gcsEye={form.gcsEye}
          setGcsEye={form.setGcsEye}
          gcsVerbal={form.gcsVerbal}
          setGcsVerbal={form.setGcsVerbal}
          gcsMotor={form.gcsMotor}
          setGcsMotor={form.setGcsMotor}
          systolic={form.systolic}
          setSystolic={form.setSystolic}
          diastolic={form.diastolic}
          setDiastolic={form.setDiastolic}
          heartRate={form.heartRate}
          setHeartRate={form.setHeartRate}
          temperature={form.temperature}
          setTemperature={form.setTemperature}
          spo2={form.spo2}
          setSpo2={form.setSpo2}
          icd10={form.icd10}
          setIcd10={form.setIcd10}
          attachedImages={form.attachedImages}
          selectedImageType={form.selectedImageType}
          setSelectedImageType={form.setSelectedImageType}
          imageTitle={form.imageTitle}
          setImageTitle={form.setImageTitle}
          onAddSampleImage={() => void form.handleAddSampleImage()}
          validationErrors={form.validationErrors}
          clearFieldError={form.clearFieldError}
        />

        <ExamTabs4To5
          activeTab={form.activeTab}
          session={session}
          planPrescription={form.planPrescription}
          setPlanPrescription={form.setPlanPrescription}
          detectedAllergies={form.detectedAllergies}
          icd9Procedure={form.icd9Procedure}
          setIcd9Procedure={form.setIcd9Procedure}
          planAction={form.planAction}
          setPlanAction={form.setPlanAction}
          biayaKonsultasi={BIAYA_KONSULTASI}
          biayaTindakan={BIAYA_TINDAKAN}
          biayaObat={BIAYA_OBAT}
          berikanSuratSakit={form.berikanSuratSakit}
          setBerikanSuratSakit={form.setBerikanSuratSakit}
          lamaHariSakit={form.lamaHariSakit}
          setLamaHariSakit={form.setLamaHariSakit}
          isRujukan={form.isRujukan}
          setIsRujukan={form.setIsRujukan}
          rujukanFaskesId={form.rujukanFaskesId}
          setRujukanFaskesId={form.setRujukanFaskesId}
          rujukanDokterId={form.rujukanDokterId}
          setRujukanDokterId={form.setRujukanDokterId}
          rujukanUrgensi={form.rujukanUrgensi}
          setRujukanUrgensi={form.setRujukanUrgensi}
          setRujukanTujuan={form.setRujukanTujuan}
          rujukanAlasan={form.rujukanAlasan}
          setRujukanAlasan={form.setRujukanAlasan}
          dischargeDisposition={form.dischargeDisposition}
          setDischargeDisposition={form.setDischargeDisposition}
          jadwalKontrol={form.jadwalKontrol}
          setJadwalKontrol={form.setJadwalKontrol}
          isAddendum={form.isAddendum}
          addendumReason={form.addendumReason}
          isMedicallyConfirmed={form.isMedicallyConfirmed}
          setIsMedicallyConfirmed={form.setIsMedicallyConfirmed}
          validationErrors={form.validationErrors}
          clearFieldError={form.clearFieldError}
        />

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {form.activeTab > 1 && (
              <button
                type="button"
                onClick={() => form.setActiveTab((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3 | 4 | 5) : 1))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Tab Sebelumnya
              </button>
            )}
            {form.activeTab < 5 && (
              <button
                type="button"
                onClick={() => form.setActiveTab((p) => (p < 5 ? ((p + 1) as 1 | 2 | 3 | 4 | 5) : 5))}
                className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Lanjut ke Tab {form.activeTab + 1} →
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={form.isSubmitting}
            className="px-6 py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer disabled:bg-slate-400"
          >
            {form.isSubmitting
              ? "Mengenkripsi & Mengesahkan..."
              : form.isAddendum
              ? "Sahkan Revisi Addendum (Versi 2)"
              : "Simpan & Tanda Tangani Berkas RME"}
          </button>
        </div>
      </form>

      {form.isPrintOpen && (
        <PrintableMedicalResume
          data={buildExamPrintableData({
            session, appointment, patient,
            subjective: form.subjective, systolic: form.systolic, diastolic: form.diastolic,
            heartRate: form.heartRate, temperature: form.temperature, spo2: form.spo2,
            icd10: form.icd10, planPrescription: form.planPrescription, planAction: form.planAction,
            gcsEye: form.gcsEye, gcsVerbal: form.gcsVerbal, gcsMotor: form.gcsMotor,
            icd9Procedure: form.icd9Procedure, dischargeDisposition: form.dischargeDisposition,
            berikanSuratSakit: form.berikanSuratSakit, lamaHariSakit: form.lamaHariSakit,
            isRujukan: form.isRujukan, rujukanFaskesId: form.rujukanFaskesId,
            rujukanDokterId: form.rujukanDokterId, rujukanUrgensi: form.rujukanUrgensi,
            rujukanTujuan: form.rujukanTujuan, rujukanAlasan: form.rujukanAlasan,
            jadwalKontrol: form.jadwalKontrol, isAddendum: form.isAddendum,
            addendumReason: form.addendumReason,
          })}
          onClose={() => form.setIsPrintOpen(false)}
        />
      )}

      <ConfirmModal
        isOpen={form.showAllergyConfirmModal}
        onClose={() => form.setShowAllergyConfirmModal(false)}
        onConfirm={() => void form.executeSaveAndSign()}
        title="Peringatan Kontraindikasi Alergi Obat (UR-T10)"
        description={`Resep memuat zat yang tercatat sebagai alergi pasien (${form.detectedAllergies.join(
          ", "
        )}). Konfirmasi bahwa Anda tetap ingin menandatangani peresepan ini berdasarkan pertimbangan klinis khusus.`}
        confirmLabel="Tetap Sahkan Resep"
        tone="warning"
        isBusy={form.isSubmitting}
      />

      <ToastBanner
        message={form.submitStatus}
        type={isSubmitError ? "error" : "success"}
        onDismiss={() => form.setSubmitStatus(null)}
      />
    </div>
  );
}
