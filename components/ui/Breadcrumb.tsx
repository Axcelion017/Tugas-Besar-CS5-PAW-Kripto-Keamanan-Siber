import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Komponen Breadcrumb tunggal berstandar WAI-ARIA APG & WCAG 2.1 AA/AAA.
 * Palet konsisten di seluruh 4 peran (Pasien, Staf, Nakes, Admin):
 * - Link induk: slate-600 (kontras 5.7:1) dengan hover red-700
 * - Pemisah: slate-400 (aria-hidden)
 * - Halaman aktif: slate-900 (kontras 15.8:1, aria-current="page")
 */
export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-1.5 text-xs font-bold tracking-wide">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5 min-w-0">
              {idx > 0 && (
                <span aria-hidden="true" className="text-slate-400 font-semibold select-none">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-slate-600 hover:text-red-700 hover:underline underline-offset-4 transition truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="text-slate-900 font-extrabold truncate"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
