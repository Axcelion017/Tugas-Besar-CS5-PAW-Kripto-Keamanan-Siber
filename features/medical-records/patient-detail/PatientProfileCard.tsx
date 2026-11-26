"use client";

import React from "react";
import Link from "next/link";

interface PatientProfileCardProps {
  patient: {
    id: string;
    name: string;
    mrn: string;
    nik: string;
    gender: string;
    bloodType: string;
    phone: string;
    allergies: string[];
  };
  accessAllowed: boolean;
  isBreakGlassActive: boolean;
  activeQueuedAptId?: string;
  latestTriage?: {
    triaseLevel: string;
    systolic: number;
    diastolic: number;
    spo2: number;
  } | null;
  onOpenPrescription: () => void;
  onOpenLab: () => void;
  onOpenProcedure: () => void;
  onOpenBreakGlass: () => void;
}

export function PatientProfileCard({
  patient,
  accessAllowed,
  isBreakGlassActive,
  activeQueuedAptId,
  latestTriage,
  onOpenPrescription,
  onOpenLab,
  onOpenProcedure,
  onOpenBreakGlass,
}: PatientProfileCardProps) {
  return (
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
              {activeQueuedAptId && (
                <Link
                  href={`/nakes/periksa/${activeQueuedAptId}`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase"
                >
                  Buka Ruang Periksa →
                </Link>
              )}
              <button
                type="button"
                onClick={onOpenPrescription}
                className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + Resep
              </button>
              <button
                type="button"
                onClick={onOpenLab}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + Lab
              </button>
              <button
                type="button"
                onClick={onOpenProcedure}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                + Tindakan
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenBreakGlass}
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
  );
}
