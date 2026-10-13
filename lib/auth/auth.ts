export interface UserSession {
  id: string;
  name: string;
  username: string;
  role: "doctor" | "patient" | "admin";
  specialization?: string;
}

// Data Pengguna Demo
export const DEMO_USERS: any = [
  {
    id: "DOC-01",
    name: "dr. Andi Pratama, Sp.PD",
    username: "dr_andi",
    password: "doctor123",
    role: "doctor" as const,
    specialization: "Spesialis Penyakit Dalam",
  },
  {
    id: "P-101",
    name: "Budi Santoso",
    username: "budi",
    password: "patient123",
    role: "patient" as const,
  },
  {
    id: "ADM-01",
    name: "Administrator Utama",
    username: "admin",
    password: "admin123",
    role: "admin" as const,
  },
];

// Mendukung pemanggilan DEMO_USERS.doctor atau DEMO_USERS.patient
DEMO_USERS.doctor = DEMO_USERS[0];
DEMO_USERS.patient = DEMO_USERS[1];
DEMO_USERS.admin = DEMO_USERS[2];

export const MOCK_USERS = DEMO_USERS;

// Menyimpan sesi secara manual (diperlukan app/login/page.tsx)
export function saveSession(session: UserSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("resilio_session", JSON.stringify(session));
  }
}

// Login otomatis dengan verifikasi kredensial
export function loginUser(username: string, password: string): boolean {
  const user = DEMO_USERS.find(
    (u: any) => u.username?.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!user) return false;

  const session: UserSession = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    specialization: user.specialization,
  };

  saveSession(session);
  return true;
}

// Pengambilan sesi (mendukung getUserSession dan getSession)
export function getUserSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("resilio_session");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserSession;
  } catch {
    return null;
  }
}

export const getSession = getUserSession;

// Menghapus sesi saat logout (mendukung logoutUser, clearSession, logout)
export function logoutUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("resilio_session");
  }
}

export const clearSession = logoutUser;
export const logout = logoutUser;