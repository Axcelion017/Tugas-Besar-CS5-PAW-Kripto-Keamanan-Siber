# Spesifikasi REST API v1 — JagaMedis (`v0.3.5`)

Dokumen ini mendefinisikan kontrak REST API berversi (`/api/v1/*`) pada JagaMedis sesuai **RFC 9110 (HTTP Semantics)**, **RFC 9457 (Problem Details for HTTP APIs)**, konvensi **Next.js 16 Route Handlers** (`await context.params`), validasi **Zod v4**, serta pemisahan wewenang **4-Role RBAC & Anti-BOLA**.

---

## 1. Konvensi Global API v1

- **Base Path**: `/api/v1`
- **Autentikasi**: Cookie HTTP-Only `resilio_session_token` yang diverifikasi terhadap tabel PostgreSQL `sessions` melalui `requireApiSession()` ([lib/api/auth.ts](../../lib/api/auth.ts)).
- **Format Respons Sukses**:
  - `200 OK` / `201 Created`: `{ "data": ... }` (dengan header `Location` pada `201 Created`).
  - `204 No Content`: body kosong untuk operasi `DELETE` yang sukses.
- **Format Respons Galat (RFC 9457)**:
  - Header wajib: `Content-Type: application/problem+json; charset=utf-8`
  - Struktur body oleh [lib/api/problem.ts](../../lib/api/problem.ts):
    ```json
    {
      "type": "https://jagamedis.id/problems/not-found",
      "title": "Resource Not Found",
      "status": 404,
      "detail": "Faskes dengan ID 'FAS-999999' tidak ditemukan di direktori nasional JagaMedis.",
      "instance": "/api/v1/faskes/FAS-999999"
    }
    ```
  - Galat validasi (`422 Unprocessable Entity` / `400 Bad Request`) menyertakan field tambahan `errors: [{ field, message, code }]`.
- **Validasi Parameter Path Dinamis (Next.js 16)**:
  - Setiap Route Handler dengan segmen `[id]` wajib melakukan `const { id } = await context.params` lalu memvalidasi formatnya melalui `validatePathId()` (`^[A-Za-z0-9_-]{3,36}$`) sebelum kueri Prisma dieksekusi.
- **Pemetaan Kode Status Standar**:
  - `400 Bad Request`: body bukan JSON valid (`invalid-json`) atau parameter `[id]` berformat ilegal (`invalid-path-param`).
  - `401 Unauthorized`: tidak ada sesi aktif / sesi kedaluwarsa.
  - `403 Forbidden`: pelanggaran RBAC, BOLA/IDOR (otomatis dicatat ke `security_audit_logs`), PIN 6-digit salah, atau faskes berstatus `QUARANTINED`.
  - `404 Not Found`: resource tidak ada (`findUnique === null` atau Prisma `P2025`).
  - `405 Method Not Allowed`: metode tidak didukung (mis. `PUT`/`DELETE` pada `/medical-records/[id]` demi sifat *immutable* Permenkes 24/2022).
  - `409 Conflict`: duplikasi kunci unik (`P2002`), larangan hapus relasi aktif (`P2003` / `onDelete: Restrict`), atau transisi status klinis ilegal.
  - `422 Unprocessable Entity`: JSON valid tetapi nilai field/enum/kategori tidak memenuhi skema Zod atau verifikasi kriptografi AEAD/HMAC gagal.

---

## 2. Katalog Endpoint Aktif — Core API v1 (Opsi A, Tersedia di `v0.3.5`)

Total **17 Route Handler files** mencakup 6 domain inti lintas 4 peran:

### A. Master Faskes & Isolasi Darurat
| Metode | Path | Peran | ID Kebutuhan | Kode Status | Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/faskes` | Publik / Semua | `UR-P02`, `UR-A03` | `200`, `422`, `500` | `app/api/v1/faskes/route.ts` |
| `POST` | `/api/v1/faskes` | `admin` | `UR-A03` | `201`, `400`, `401`, `403`, `409`, `422`, `500` | `app/api/v1/faskes/route.ts` |
| `GET` | `/api/v1/faskes/[id]` | Publik / Semua | `UR-P03` | `200`, `400`, `404`, `500` | `app/api/v1/faskes/[id]/route.ts` |
| `PATCH` | `/api/v1/faskes/[id]` | `admin` | `UR-A03` | `200`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/faskes/[id]/route.ts` |
| `DELETE` | `/api/v1/faskes/[id]` | `admin` | `UR-A03` | `204`, `400`, `401`, `403`, `404`, `409`, `500` | `app/api/v1/faskes/[id]/route.ts` |
| `PATCH` | `/api/v1/faskes/[id]/quarantine` | `admin` | `UR-A03` | `200`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/faskes/[id]/quarantine/route.ts` |

### B. Alur Kunjungan, Check-In, Triase & Penugasan DPJP
| Metode | Path | Peran | ID Kebutuhan | Kode Status | Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/appointments` | Semua (scoped) | `UR-P04`, `UR-S01`, `UR-T02` | `200`, `401`, `422`, `500` | `app/api/v1/appointments/route.ts` |
| `POST` | `/api/v1/appointments` | `pasien`, `staf`, `admin` | `UR-P04`, `UR-S01` | `201`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/appointments/route.ts` |
| `GET` | `/api/v1/appointments/[id]` | Semua (Anti-BOLA) | `UR-P04`, `UR-S01` | `200`, `400`, `401`, `403`, `404`, `500` | `app/api/v1/appointments/[id]/route.ts` |
| `PATCH` | `/api/v1/appointments/[id]` | `pasien`, `staf`, `admin` | `UR-P04` | `200`, `400`, `401`, `403`, `404`, `409`, `422`, `500` | `app/api/v1/appointments/[id]/route.ts` |
| `DELETE` | `/api/v1/appointments/[id]` | `pasien`, `staf`, `admin` | `UR-P04` | `204`, `400`, `401`, `403`, `404`, `409`, `500` | `app/api/v1/appointments/[id]/route.ts` |
| `POST` | `/api/v1/appointments/[id]/check-in` | `staf`, `admin` | `UR-S01` | `200`, `400`, `401`, `403`, `404`, `409`, `500` | `app/api/v1/appointments/[id]/check-in/route.ts` |
| `PUT` | `/api/v1/appointments/[id]/triage` | `staf`, `nakes`, `admin` | `UR-S02` | `200`, `400`, `401`, `403`, `404`, `409`, `422`, `500` | `app/api/v1/appointments/[id]/triage/route.ts` |
| `POST` | `/api/v1/appointments/[id]/assign-dpjp` | `staf`, `admin` | `UR-S03`, `UR-P10` | `200`, `400`, `401`, `403`, `404`, `409`, `422`, `500` | `app/api/v1/appointments/[id]/assign-dpjp/route.ts` |

### C. Rekam Medis Zero-Knowledge & Addendum Immutable
| Metode | Path | Peran | ID Kebutuhan | Kode Status | Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/medical-records` | `pasien`, `nakes`, `admin` | `UR-P06`, `UR-T03` | `200`, `401`, `403`, `500` | `app/api/v1/medical-records/route.ts` |
| `POST` | `/api/v1/medical-records` | `nakes` | `UR-T04` | `201`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/medical-records/route.ts` |
| `GET` | `/api/v1/medical-records/[id]` | `pasien`, `nakes`, `admin` | `UR-P06`, `UR-T03` | `200`, `400`, `401`, `403`, `404`, `500` | `app/api/v1/medical-records/[id]/route.ts` |
| `POST` | `/api/v1/medical-records/[id]/addenda` | `nakes` | `UR-T09` | `201`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/medical-records/[id]/addenda/route.ts` |

### D. Kedaulatan Izin (Consent)
| Metode | Path | Peran | ID Kebutuhan | Kode Status | Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/access-grants` | `pasien`, `admin` | `UR-P05`, `UR-P07` | `200`, `401`, `403`, `500` | `app/api/v1/access-grants/route.ts` |
| `POST` | `/api/v1/access-grants` | `pasien` | `UR-P05` | `201`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/access-grants/route.ts` |
| `POST` | `/api/v1/access-grants/[id]/revoke` | `pasien`, `admin` | `UR-P07` | `200`, `400`, `401`, `403`, `404`, `500` | `app/api/v1/access-grants/[id]/revoke/route.ts` |

### E. Profil Tanggungan Keluarga (Family Proxy)
| Metode | Path | Peran | ID Kebutuhan | Kode Status | Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/patients/me/family-members` | `pasien` | `UR-P11` | `200`, `401`, `403`, `500` | `app/api/v1/patients/me/family-members/route.ts` |
| `POST` | `/api/v1/patients/me/family-members` | `pasien` | `UR-P11` | `201`, `400`, `401`, `403`, `422`, `500` | `app/api/v1/patients/me/family-members/route.ts` |
| `PATCH` | `/api/v1/patients/me/family-members/[id]` | `pasien` | `UR-P11` | `200`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/patients/me/family-members/[id]/route.ts` |
| `DELETE` | `/api/v1/patients/me/family-members/[id]` | `pasien` | `UR-P11` | `204`, `400`, `401`, `403`, `404`, `500` | `app/api/v1/patients/me/family-members/[id]/route.ts` |

### F. Tiket Kendala & Sengketa Data
| Metode | Path | Peran | ID Kebutuhan | Kode Status | Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/trouble-tickets` | Semua (scoped) | `UR-P08`, `UR-A05` | `200`, `401`, `422`, `500` | `app/api/v1/trouble-tickets/route.ts` |
| `POST` | `/api/v1/trouble-tickets` | Semua | `UR-P08` | `201`, `400`, `401`, `422`, `500` | `app/api/v1/trouble-tickets/route.ts` |
| `GET` | `/api/v1/trouble-tickets/[id]` | Pemilik / `admin` | `UR-P08`, `UR-A05` | `200`, `400`, `401`, `403`, `404`, `500` | `app/api/v1/trouble-tickets/[id]/route.ts` |
| `PATCH` | `/api/v1/trouble-tickets/[id]` | `admin` | `UR-A05` | `200`, `400`, `401`, `403`, `404`, `422`, `500` | `app/api/v1/trouble-tickets/[id]/route.ts` |
| `DELETE` | `/api/v1/trouble-tickets/[id]` | Pemilik / `admin` | `UR-P08` | `204`, `400`, `401`, `403`, `404`, `409`, `500` | `app/api/v1/trouble-tickets/[id]/route.ts` |

---

## 3. Backlog Endpoint Sesi Berikutnya (Phase B — Next Session)

> **Catatan Arsitektur Direktori `/api` vs `/api/v1`**:
> - `GET /api/health` **sengaja dipertahankan di root `/api/health`** sebagai endpoint infrastruktur/monitoring (`Dockerfile HEALTHCHECK`), sehingga tidak perlu di-versioning.
> - Tiga endpoint lama di `app/api/` (`auth/session`, `sync/outbox`, `attachments`) dibiarkan tetap aktif pada `v0.3.5` demi kompatibilitas UI & tes Fase 1–3, dan dijadwalkan untuk diselaraskan ke `/api/v1/*` (RFC 9457) pada sesi berikutnya (`B-01`, `B-05`, `B-06`) dengan rute lama menjadi *alias/re-export* tipis atau dimigrasikan seluruh pemanggilnya.

Endpoint berikut telah dipetakan secara arsitektural dan dijadwalkan untuk tahap pengembangan berikutnya:

| Prioritas | Metode | Path Target `/api/v1/...` | Peran | ID Kebutuhan | Catatan Rencana Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-01** | `GET`, `POST`, `DELETE` | `/api/v1/auth/session` | Semua | Auth & RBAC | Penyelarasan `/api/auth/session` ke RFC 9457 (`400`/`401`/`403`/`429` + `Retry-After`) sambil menjaga alias lama. |
| **B-02** | `GET`, `PATCH` | `/api/v1/patients/me` | `pasien` | `UR-P08` | Endpoint REST terpisah untuk pembaruan biodata mandiri, kontak darurat, dan daftar alergi pasien. |
| **B-03** | `POST` | `/api/v1/break-glass` | `nakes` | `UR-T08`, `UR-A07` | Akses darurat IGD dengan alasan klinis wajib + penerbitan grant darurat sementara + alarm SIEM `CRITICAL`. |
| **B-04** | `GET`, `POST`, `PATCH` | `/api/v1/referrals` & `/referrals/[id]` | `nakes`, `staf`, `pasien` | `UR-S04`, `UR-T06` | Siklus rujukan digital antar faskes (penerbitan DPJP, persetujuan pasien, penerimaan staf faskes tujuan). |
| **B-05** | `GET`, `POST` | `/api/v1/medical-records/[id]/attachments` & `/attachments/[id]` | `pasien`, `nakes` | `UR-P12`, `UR-T07` | Migrasi `/api/attachments` ke jalur RESTful berversi dengan `await context.params` dan RFC 9457. |
| **B-06** | `POST` | `/api/v1/sync/outbox` | `nakes`, `staf` | `UR-T05`, `UR-T06` | Migrasi `/api/sync/outbox` ke `/api/v1/sync/outbox` dengan RFC 9457 untuk error HMAC/Karantina. |
| **B-07** | `GET`, `PATCH` | `/api/v1/verifications/kyc` & `/kyc/[id]` | `admin` | `UR-A01`, `UR-A06` | Antrean dan keputusan verifikasi e-KYC (`VERIFIED`/`REJECTED` + alasan penolakan wajib saat ditolak). |
| **B-08** | `GET`, `PATCH` | `/api/v1/verifications/kyd` & `/kyd/[id]` | `admin` | `UR-A02`, `UR-A06` | Antrean dan keputusan verifikasi lisensi dokter STR/SIP (KYD). |
| **B-09** | `GET` | `/api/v1/audit-logs` | `pasien`, `admin` | `UR-P07`, `UR-A04` | Audit trail pribadi pasien (`?action=`) dan SIEM global untuk Admin (`?severity=&action=&limit=`). |
| **B-10** | `GET` | `/api/v1/openapi.json` | Publik / Dev | Dokumentasi API | Spesifikasi OpenAPI 3.1 terotomasi untuk seluruh endpoint `/api/v1/*`. |
