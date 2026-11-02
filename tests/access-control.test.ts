import { describe, test, expect } from "vitest";
import { normalizeRole, UserRole } from "../lib/auth/auth";

// Matriks Hak Akses Peran Resilio-Health (Role-Based Access Control - RBAC)
const RBAC_PERMISSIONS: Record<string, string[]> = {
  pasien: [
    "/pasien",
    "/pasien/profil",
    "/pasien/faskes",
    "/pasien/booking",
    "/pasien/rekam-medis",
    "/pasien/consent",
    "/pasien/audit-log",
    "/pasien/tiket-kendala",
  ],
  nakes: [
    "/nakes",
    "/nakes/periksa",
    "/nakes/pasien-lookup",
    "/nakes/rujukan",
    "/nakes/offline-sync",
  ],
  staf: [
    "/staf",
    "/staf/triase",
    "/staf/assign-dpjp",
    "/staf/rujukan",
  ],
  admin: [
    "/admin",
    "/admin/verifikasi-kyc",
    "/admin/verifikasi-kyd",
    "/admin/faskes",
    "/admin/siem-monitor",
    "/admin/incident-center",
  ],
};

function checkAccess(role: UserRole, targetPath: string): boolean {
  const normRole = normalizeRole(role);
  const allowed = RBAC_PERMISSIONS[normRole] || [];
  return allowed.some((prefix) => targetPath.startsWith(prefix));
}

describe("Resilio-Health RBAC & Access Control Tests (Sub-CPMK 3 KKS)", () => {
  // Sesuai ketentuan KKS: Uji akses negatif sama banyaknya dengan uji akses positif (4 positif vs 4 negatif)

  // 1. Uji Akses Positif (Akses yang Diizinkan Sesuai Hak Peran)
  test("1. Positif: Pasien diizinkan membuka portal pasien & consent kedaulatan", () => {
    expect(checkAccess("pasien", "/pasien")).toBe(true);
    expect(checkAccess("pasien", "/pasien/consent")).toBe(true);
  });

  test("2. Positif: Dokter DPJP diizinkan mengakses stasiun nakes & SOAP periksa", () => {
    expect(checkAccess("doctor", "/nakes")).toBe(true);
    expect(checkAccess("doctor", "/nakes/periksa/APT-2026-001")).toBe(true);
  });

  test("3. Positif: Staf Nakes diizinkan mengakses loket admisi & form triase", () => {
    expect(checkAccess("staf", "/staf")).toBe(true);
    expect(checkAccess("staf", "/staf/triase")).toBe(true);
  });

  test("4. Positif: Admin Regulator Kemenkes diizinkan membuka konsol verifikasi e-KYC", () => {
    expect(checkAccess("admin", "/admin/verifikasi-kyc")).toBe(true);
    expect(checkAccess("admin", "/admin/siem-monitor")).toBe(true);
  });

  // 2. Uji Akses Negatif (Akses Tidak Sah Tertolak Keras / Fail-Closed)
  test("5. Negatif: Pasien dilarang keras mengakses konsol regulator Admin (403 Forbidden)", () => {
    expect(checkAccess("pasien", "/admin")).toBe(false);
    expect(checkAccess("pasien", "/admin/verifikasi-kyc")).toBe(false);
  });

  test("6. Negatif: Pasien dilarang keras membuka stasiun kerja dokter DPJP", () => {
    expect(checkAccess("pasien", "/nakes")).toBe(false);
    expect(checkAccess("pasien", "/nakes/periksa/APT-001")).toBe(false);
  });

  test("7. Negatif: Dokter DPJP dilarang mengakses konsol audit SIEM & Kill-Switch Admin", () => {
    expect(checkAccess("doctor", "/admin/faskes")).toBe(false);
    expect(checkAccess("doctor", "/admin/siem-monitor")).toBe(false);
  });

  test("8. Negatif: Staf Admisi Loket dilarang menandatangani SOAP medis DPJP", () => {
    expect(checkAccess("staf", "/nakes/periksa")).toBe(false);
    expect(checkAccess("staf", "/admin")).toBe(false);
  });
});
