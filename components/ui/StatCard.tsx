import React from "react";

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  statusText?: string;
  isAlert?: boolean;
}

export function StatCard({
  title,
  value,
  unit,
  statusText,
  isAlert = false,
}: StatCardProps) {
  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        isAlert
          ? "bg-red-50 border-red-200 text-red-900"
          : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-black text-slate-900">{value}</span>
        {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
      </div>
      {statusText && (
        <p className="text-[11px] font-semibold mt-1 text-slate-600">
          {statusText}
        </p>
      )}
    </div>
  );
}

export default StatCard;