"use client";

import React, { useId } from "react";

interface BrandIconProps {
  size?: number;
  className?: string;
}

/**
 * Ikon resmi aplikasi JagaMedis (perisai-dokumen medis & palang medis #DC2626, viewBox 192x221).
 * Menggunakan useId() untuk clipPath agar aman dirender berulang pada halaman yang sama.
 */
export function BrandIcon({ size = 36, className = "" }: BrandIconProps) {
  const clipId = useId();
  const width = Math.round((size * 192) / 221);

  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 192 221"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M32.3855 -3.4277H123.759V38.2108C123.759 55.1747 132.241 63.6566 149.205 63.6566H192V134.211C192 173.536 151.518 204.765 101.783 219.801C97.9277 221.343 94.0723 221.343 90.2169 219.801C40.4819 204.765 0 173.536 0 134.211V28.9578C0 7.36748 10.7952 -3.4277 32.3855 -3.4277ZM84.4337 65.9699C82.1205 65.9699 80.9639 67.1265 80.9639 69.4398V92.5723H57.8313C55.5181 92.5723 54.3614 93.7289 54.3614 96.0422V119.175C54.3614 121.488 55.5181 122.645 57.8313 122.645H80.9639V145.777C80.9639 148.09 82.1205 149.247 84.4337 149.247H107.566C109.88 149.247 111.036 148.09 111.036 145.777V122.645H134.169C136.482 122.645 137.639 121.488 137.639 119.175V96.0422C137.639 93.7289 136.482 92.5723 134.169 92.5723H111.036V69.4398C111.036 67.1265 109.88 65.9699 107.566 65.9699H84.4337Z"
          fillRule="evenodd"
          clipRule="evenodd"
          fill="#DC2626"
        />
        <path
          d="M137.057 1.12129C140.047 1.12129 142.663 2.24258 144.906 4.48516L187.515 47.0942C189.757 49.3367 190.879 51.5793 190.879 53.8219H151.634C141.916 53.8219 137.057 48.963 137.057 39.2451V1.12129Z"
          fill="#DC2626"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="192" height="221" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

interface BrandLogoProps {
  variant?: "horizontal" | "stacked";
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  asHeading?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 32, title: "text-sm", subtitle: "text-[10px]" },
  md: { icon: 40, title: "text-base sm:text-lg", subtitle: "text-[11px]" },
  lg: { icon: 56, title: "text-2xl", subtitle: "text-xs" },
} as const;

export function BrandLogo({
  variant = "horizontal",
  size = "md",
  subtitle,
  asHeading = false,
  className = "",
}: BrandLogoProps) {
  const cfg = SIZE_MAP[size];
  const TitleTag = asHeading ? "h1" : "span";

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <BrandIcon size={cfg.icon} className="mb-3 shrink-0" />
        <TitleTag className={`font-black text-slate-900 tracking-tight leading-none ${cfg.title}`}>
          JAGA<span className="text-red-600">MEDIS</span>
        </TitleTag>
        {subtitle && (
          <p className={`text-slate-600 font-bold uppercase tracking-wider mt-1.5 ${cfg.subtitle}`}>
            {subtitle}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <BrandIcon size={cfg.icon} className="shrink-0" />
      <div className="leading-tight min-w-0">
        <TitleTag className={`block font-black text-slate-900 tracking-tight ${cfg.title}`}>
          JAGA<span className="text-red-600">MEDIS</span>
        </TitleTag>
        {subtitle && (
          <p className={`text-slate-600 font-bold tracking-wider uppercase truncate ${cfg.subtitle}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
