"use client";

import React from "react";
import type { UserSession } from "@/lib/auth/auth";
import type { Appointment, Patient } from "@/lib/db/mockData";

interface StickyPatientBannerProps {
  appointment: Appointment;
  patient: Patient;
  session: UserSession;
  patientAllergies: string[];
  onOpenPrint: () => void;
}

export function StickyPatientBanner({
  appointment,
  patient,
  session,
  patientAllergies,
  onOpenPrint,
}: StickyPatientBannerProps) {
  return (
    <>
      {/* STICKY PATIENT BANNER (NISTIR 7804 — Patient Identification Safety di seluruh 5 tab) */}
      <div className="sticky top-14 z-10 bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-md border border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-black text-sm text-white">{patient.name}</span>
          <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded-md text-slate-200">
            {patient.mrn}
          </span>
          <span className="text-slate-300">
            {patient.gender === "L" ? "Laki-laki" : "Perempuan"}, {patient.age} th • Gol.{" "}
            {patient.bloodType}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {patientAllergies.length > 0 ? (
            <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">
              ALERGI: {patientAllergies.join(", ")}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-emerald-600/30 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold">
              Tanpa Alergi Obat Tercatat
            </span>
          )}
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase ${
              appointment.triaseLevel === "MERAH"
                ? "bg-red-600 text-white"
                : appointment.triaseLevel === "KUNING"
                ? "bg-amber-500 text-slate-950"
                : "bg-emerald-600 text-white"
            }`}
          >
            Triase: {appointment.triaseLevel || "HIJAU"}
          </span>
        </div>
      </div>

      {/* Header Info Pasien & Triase */}
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Tiket Pemeriksaan: {appointment.id}
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Poli: {appointment.poli}
              </span>
              {appointment.triaseLevel && (
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    appointment.triaseLevel === "MERAH"
                      ? "bg-red-100 text-red-800 border-red-300"
                      : appointment.triaseLevel === "KUNING"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  }`}
                >
                  Triase: {appointment.triaseLevel}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Pasien: {patient.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              NIK: <span className="font-mono font-bold text-slate-700">{patient.nik}</span> • Usia:{" "}
              {patient.age} Thn • Gol. Darah: <strong>{patient.bloodType}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenPrint}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Cetak Resume Medis</span>
            </button>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Dokter DPJP Bertugas
              </span>
              <p className="text-xs font-bold text-slate-800">{session.name}</p>
              <p className="text-[10px] text-slate-500 font-mono">STR: {session.strNumber}</p>
            </div>
          </div>
        </div>

        {patientAllergies.length > 0 && (
          <div className="p-4 bg-red-100 border border-red-300 rounded-2xl flex items-center gap-3 text-red-900 text-xs font-bold">
            <div>
              <span>PERINGATAN ALERGI KRITIS: </span>
              <span className="text-red-700 underline">{patientAllergies.join(", ")}</span>
              <span className="block text-[11px] font-normal text-red-800 mt-0.5">
                Hindari meresepkan golongan obat atau derivat terkait di bawah ini!
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
