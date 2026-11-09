"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export interface VitalSignMetric {
  date: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature?: number;
}

interface VitalSignsTrendChartProps {
  data: VitalSignMetric[];
  title?: string;
}

export function VitalSignsTrendChart({
  data,
  title = "Grafik Tren Tanda Vital (Permenkes No. 24/2022)",
}: VitalSignsTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
        Belum ada riwayat pengukuran tanda vital untuk ditampilkan pada grafik.
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight">{title}</h3>
          <p className="text-[11px] text-slate-500">
            Pemantauan fisiologis berkala: Tekanan Darah (Sistolik/Diastolik) & Detak Jantung
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          {data.length} Titik Ukur
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[40, 200]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderRadius: "12px",
                border: "none",
                fontSize: "12px",
                color: "#f8fafc",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            <Line
              type="monotone"
              dataKey="systolic"
              name="Sistolik (mmHg)"
              stroke="#dc2626"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#dc2626" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="diastolic"
              name="Diastolik (mmHg)"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#2563eb" }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="heartRate"
              name="Detak Jantung (bpm)"
              stroke="#059669"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "#059669" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
        <div className="p-2 rounded-xl bg-red-50 text-red-900">
          <span className="text-[10px] font-bold uppercase block text-red-700">Sistolik Terakhir</span>
          <span className="text-sm font-black">{data[data.length - 1]?.systolic} mmHg</span>
        </div>
        <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
          <span className="text-[10px] font-bold uppercase block text-blue-700">Diastolik Terakhir</span>
          <span className="text-sm font-black">{data[data.length - 1]?.diastolic} mmHg</span>
        </div>
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-900">
          <span className="text-[10px] font-bold uppercase block text-emerald-700">Detak Jantung</span>
          <span className="text-sm font-black">{data[data.length - 1]?.heartRate} bpm</span>
        </div>
      </div>
    </div>
  );
}
