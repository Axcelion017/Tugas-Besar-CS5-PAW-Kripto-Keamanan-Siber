# Direktori Pencatatan Perubahan (Change Log & Refactor History) — JagaMedis

Direktori `docs/perubahan/` berfungsi sebagai arsip resmi dan terstruktur untuk mencatat setiap perubahan berkas, migrasi basis data, stempel waktu pengerjaan, serta bukti pengujian (*Quality Gates*) pada tiap fase perombakan arsitektur **JagaMedis** berdasarkan Master Plan di [audit_menyeluruh_jagamedis_22Nov2026.md](../audit/audit_menyeluruh_jagamedis_22Nov2026.md).

## Indeks Catatan Perubahan per Fase

| Fase | Branch Git | Tanggal & Waktu (WIB) | Fokus Utama | Status | Dokumen Rincian |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Fase 0** | `Week-7` $\rightarrow$ `main` | 22–26 Nov 2026 | Penguncian baseline Modul 7 & merge PR #12 | **SELESAI** | Tercatat di [AI_LOG.md](../../AI_LOG.md) & [modul07.md](../praktikum/modul07.md) |
| **Fase 1** (`P0`) | `refactor/fase-1-security-crypto` | 26 Nov 2026, 07:55–08:15 WIB | Sesi Persisten DB, `proxy.ts` & `requireSession`, Anti-BOLA, Kriptografi AEAD+HKDF+AAD *Fail-Closed*, HTTP Security Headers | **SELESAI & TERVERIFIKASI** | [fase-1-security-crypto-2026-11-26.md](./fase-1-security-crypto-2026-11-26.md) |
| **Fase 2** (`P1`) | `refactor/fase-2-end-to-end-db` | 26 Nov 2026, 08:20–08:52 WIB | Eliminasi *Split-Brain* `localStorage`, alur End-to-End 4 peran 100% PostgreSQL, Sticky Patient Banner, CDS Vital Kritis, & Kill-Switch Server-Side | **SELESAI & TERVERIFIKASI** | [fase-2-end-to-end-db-2026-11-26.md](./fase-2-end-to-end-db-2026-11-26.md) |
| **Fase 3** (`P2`) | `refactor/fase-3-architecture-pwa` | 26 Nov 2026, 09:03–09:36 WIB | Modularisasi *God Files* ke `features/`, Server Components (`<Suspense>`), 4 Endpoint REST, PWA + IndexedDB Nyata, & Sinkronisasi Jadwal | **SELESAI & TERVERIFIKASI** | [fase-3-architecture-pwa-2026-11-26.md](./fase-3-architecture-pwa-2026-11-26.md) |
| **Fase 4** (`P3`) | *(Rencana)* `refactor/fase-4-ui-a11y-qa` | — | Usability Klinis (NISTIR 7804), Aksesibilitas WCAG 2.1 AA, & E2E Testing + DevOps | **BELUM DIMULAI** | — |
