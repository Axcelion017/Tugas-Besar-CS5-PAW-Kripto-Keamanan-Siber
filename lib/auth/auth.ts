export type UserRole = "doctor" | "patient" | "admin" | "nakes" | "pasien" | "staf";

export interface UserSession {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  nik?: string;
  strNumber?: string;
  sipNumber?: string;
  specialization?: string;
  faskesId?: string;
  faskesName?: string;
  status?: "VERIFIED" | "PENDING" | "REJECTED";
  allergies?: string[];
  bloodType?: string;
  phone?: string;
  encryptionKeyHex?: string;
  posisiStaf?: "Perawat Triase" | "Staf Admisi" | "Kepala Ruangan";
}

export interface DemoUserAccount extends UserSession {
  password: string;
  email: string;
}

export interface DemoUserCollection extends Array<DemoUserAccount> {
  doctor: DemoUserAccount;
  patient: DemoUserAccount;
  admin: DemoUserAccount;
  nakes: DemoUserAccount;
  pasien: DemoUserAccount;
  staf: DemoUserAccount;
}

// Data Pengguna Demo Terstandarisasi 4-Role
const BASE_USERS: DemoUserAccount[] = [
  {
    id: "DOC-01",
    name: "dr. Andi Pratama, Sp.PD",
    username: "dr_andi",
    email: "dr.andi@resilio.id",
    password: "doctor123",
    role: "nakes",
    nik: "3171011102830001",
    strNumber: "31.1.1.100.2.22.123456",
    sipNumber: "446/SIP-D/2023/001",
    specialization: "Spesialis Penyakit Dalam (DPJP)",
    faskesId: "FAS-01",
    faskesName: "RSUP Dr. Sardjito",
    status: "VERIFIED",
  },
  {
    id: "P-101",
    name: "Budi Santoso",
    username: "budi",
    email: "budi.santoso@gmail.com",
    password: "patient123",
    role: "pasien",
    nik: "3171012304800001",
    bloodType: "O+",
    allergies: ["Penicillin", "Aspirin"],
    phone: "081234567890",
    status: "VERIFIED",
    encryptionKeyHex: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  },
  {
    id: "ADM-01",
    name: "Administrator Utama",
    username: "admin",
    email: "admin.regulator@kemkes.go.id",
    password: "admin123",
    role: "admin",
    nik: "3171099901850099",
    status: "VERIFIED",
  },
  {
    id: "STF-01",
    name: "Ners Maya Kartika, S.Kep",
    username: "suster_maya",
    email: "maya.nurse@sardjito.id",
    password: "nurse123",
    role: "staf",
    nik: "3171028809930005",
    strNumber: "31.2.2.400.1.21.776655",
    posisiStaf: "Perawat Triase",
    faskesId: "FAS-01",
    faskesName: "RSUP Dr. Sardjito",
    status: "VERIFIED",
  },
];

const demoArray = [...BASE_USERS] as DemoUserCollection;
demoArray.doctor = demoArray[0];
demoArray.patient = demoArray[1];
demoArray.admin = demoArray[2];
demoArray.nakes = demoArray[0];
demoArray.pasien = demoArray[1];
demoArray.staf = demoArray[3];

export const DEMO_USERS: DemoUserCollection = demoArray;
export const MOCK_USERS = DEMO_USERS;

// Menyimpan sesi secara manual di localStorage dan cookie peramban
export function saveSession(session: UserSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("resilio_session", JSON.stringify(session));
    document.cookie = `resilio_user_role=${normalizeRole(session.role)}; path=/; max-age=14400; SameSite=Lax`;
    document.cookie = `resilio_session_active=true; path=/; max-age=14400; SameSite=Lax`;
  }
}

// Normalisasi Peran untuk kemudahan routing Next.js
export function normalizeRole(role: UserRole): "nakes" | "pasien" | "admin" | "staf" {
  if (role === "doctor" || role === "nakes") return "nakes";
  if (role === "patient" || role === "pasien") return "pasien";
  if (role === "staf") return "staf";
  return "admin";
}

// Login otomatis dengan verifikasi kredensial
export function loginUser(identifier: string, password: string): UserSession | null {
  const cleanId = identifier.trim().toLowerCase();
  
  const user = DEMO_USERS.find(
    (u) =>
      (u.username.toLowerCase() === cleanId ||
       u.email.toLowerCase() === cleanId ||
       (u.nik && u.nik === cleanId)) &&
      u.password === password
  );

  if (!user) return null;

  const session: UserSession = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    nik: user.nik,
    strNumber: user.strNumber,
    sipNumber: user.sipNumber,
    specialization: user.specialization,
    faskesId: user.faskesId,
    faskesName: user.faskesName,
    status: user.status,
    allergies: user.allergies,
    bloodType: user.bloodType,
    phone: user.phone,
    encryptionKeyHex: user.encryptionKeyHex,
    posisiStaf: user.posisiStaf,
  };

  saveSession(session);
  return session;
}

// Pengambilan sesi aktif (Resilient: mendeteksi localStorage dan self-healing via cookie)
export function getUserSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("resilio_session");
  if (stored) {
    try {
      return JSON.parse(stored) as UserSession;
    } catch {
      // lanjut fallback
    }
  }

  // Self-healing fallback: jika localStorage kosong, pulihkan dari cookie peran aktif
  try {
    const match = document.cookie.match(/resilio_user_role=([^;]+)/);
    if (match && match[1]) {
      const activeRole = match[1].trim();
      const demo = DEMO_USERS.find((u) => normalizeRole(u.role) === activeRole);
      if (demo) {
        const recovered: UserSession = {
          id: demo.id,
          name: demo.name,
          username: demo.username,
          role: demo.role,
          nik: demo.nik,
          strNumber: demo.strNumber,
          sipNumber: demo.sipNumber,
          specialization: demo.specialization,
          faskesId: demo.faskesId,
          faskesName: demo.faskesName,
          status: demo.status,
          allergies: demo.allergies,
          bloodType: demo.bloodType,
          phone: demo.phone,
          encryptionKeyHex: demo.encryptionKeyHex,
          posisiStaf: demo.posisiStaf,
        };
        localStorage.setItem("resilio_session", JSON.stringify(recovered));
        return recovered;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export const getSession = getUserSession;

// Menghapus sesi saat logout
export function logoutUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("resilio_session");
    document.cookie = "resilio_user_role=; path=/; max-age=0";
    document.cookie = "resilio_session_active=; path=/; max-age=0";
  }
}

export const clearSession = logoutUser;
export const logout = logoutUser;
