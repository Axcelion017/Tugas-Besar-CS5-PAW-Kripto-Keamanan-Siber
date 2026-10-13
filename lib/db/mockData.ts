export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "L" | "P";
  mrn: string;
  lastVisit: string;
  hasAccess: boolean;
}

export interface AuthorizedDoctor {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  accessStatus: "ACTIVE" | "REVOKED";
  lastAccess: string;
}

export const MOCK_PATIENTS: Patient[] = [
  { id: "P-101", name: "Budi Santoso", age: 45, gender: "L", mrn: "MRN-2026-0081", lastVisit: "2026-10-01", hasAccess: true },
  { id: "P-102", name: "Siti Rahmawati", age: 34, gender: "P", mrn: "MRN-2026-0082", lastVisit: "2026-09-28", hasAccess: true },
  { id: "P-103", name: "Arman Patel", age: 29, gender: "L", mrn: "MRN-2026-0083", lastVisit: "2026-09-25", hasAccess: true },
  { id: "P-104", name: "Dewi Lestari", age: 52, gender: "P", mrn: "MRN-2026-0084", lastVisit: "2026-09-18", hasAccess: false },
];

export const MOCK_DOCTORS: AuthorizedDoctor[] = [
  { id: "DOC-01", name: "dr. Hendra Sp.PD", specialty: "Spesialis Penyakit Dalam", hospital: "RSUP Dr. Sardjito", accessStatus: "ACTIVE", lastAccess: "2026-10-01 10:14 WIB" },
  { id: "DOC-02", name: "dr. Sarah Sp.A", specialty: "Spesialis Anak", hospital: "Klinik Pratama Sehat", accessStatus: "ACTIVE", lastAccess: "2026-09-20 14:30 WIB" },
  { id: "DOC-03", name: "dr. Rian Sp.JP", specialty: "Spesialis Jantung", hospital: "RS Harapan Sehat", accessStatus: "REVOKED", lastAccess: "2026-08-12 09:15 WIB" },
];
