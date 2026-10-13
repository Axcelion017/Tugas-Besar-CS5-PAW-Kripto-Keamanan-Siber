import React from "react";

export type BadgeVariant = "success" | "danger" | "warning" | "neutral";

export interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({
  label,
  variant = "neutral",
  className = "",
}: StatusBadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    success: "bg-emerald-100 text-emerald-800 border-emerald-200",
    danger: "bg-red-100 text-red-800 border-red-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 text-[11px] font-black rounded-full uppercase border ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;