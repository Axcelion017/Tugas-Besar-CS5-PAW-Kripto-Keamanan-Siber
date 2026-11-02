-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('pasien', 'nakes', 'staf', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('VERIFIED', 'PENDING', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FaskesType" AS ENUM ('Rumah Sakit', 'Klinik Pratama', 'Puskesmas');

-- CreateEnum
CREATE TYPE "FaskesStatus" AS ENUM ('ACTIVE', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "FamilyRelation" AS ENUM ('Anak', 'Orang Tua', 'Pasangan', 'Wali');

-- CreateEnum
CREATE TYPE "TriaseLevel" AS ENUM ('HIJAU', 'KUNING', 'MERAH');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_ARRIVAL', 'WAITING_TRIAGE', 'WAITING_DOCTOR', 'IN_EXAMINATION', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImageType" AS ENUM ('RONTGEN', 'USG', 'LAB', 'EKG', 'FOTO_KLINIS');

-- CreateEnum
CREATE TYPE "GrantEntityType" AS ENUM ('DOKTER', 'FASKES');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'VIEW_RME', 'WRITE_RME', 'IDOR_BLOCKED', 'HMAC_VERIFIED', 'HMAC_MISMATCH', 'REVOKE_CONSENT', 'QUARANTINE_FASKES', 'BREAK_GLASS_ACCESS', 'CHECK_IN_TRIAGE', 'ASSIGN_DPJP');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BUG', 'SYNC_FAIL', 'DATA_MISMATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(36) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faskes" (
    "id" VARCHAR(32) NOT NULL,
    "kode_faskes" VARCHAR(50) NOT NULL,
    "nama" VARCHAR(150) NOT NULL,
    "tipe" "FaskesType" NOT NULL,
    "alamat" TEXT NOT NULL,
    "kota" VARCHAR(100) NOT NULL,
    "kontak" VARCHAR(50) NOT NULL,
    "spesialisasi_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kategori_penyakit" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "FaskesStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faskes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" VARCHAR(32) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "nik" CHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "blood_type" VARCHAR(5) NOT NULL,
    "mrn" VARCHAR(30) NOT NULL,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergency_contact_name" VARCHAR(120) NOT NULL,
    "emergency_contact_relation" VARCHAR(50) NOT NULL,
    "emergency_contact_phone" VARCHAR(20) NOT NULL,
    "encryption_key_hex" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" VARCHAR(32) NOT NULL,
    "patient_id" VARCHAR(32) NOT NULL,
    "nik" CHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "relation" "FamilyRelation" NOT NULL,
    "birth_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" VARCHAR(32) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "faskes_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "str_number" VARCHAR(50) NOT NULL,
    "sip_number" VARCHAR(50) NOT NULL,
    "specialty" VARCHAR(100) NOT NULL,
    "kuota_harian" INTEGER NOT NULL DEFAULT 30,
    "foto_profil_url" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" VARCHAR(32) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "faskes_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nip" VARCHAR(50) NOT NULL,
    "posisi" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" VARCHAR(32) NOT NULL,
    "patient_id" VARCHAR(32) NOT NULL,
    "faskes_id" VARCHAR(32) NOT NULL,
    "doctor_id" VARCHAR(32) NOT NULL,
    "dpjp_id" VARCHAR(32),
    "tanggal" DATE NOT NULL,
    "jam" VARCHAR(20) NOT NULL,
    "poli" VARCHAR(100) NOT NULL,
    "keluhan_awal" TEXT NOT NULL,
    "consent_active" BOOLEAN NOT NULL DEFAULT true,
    "consent_pin" CHAR(6),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING_ARRIVAL',
    "check_in_time" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triage_assessments" (
    "id" VARCHAR(32) NOT NULL,
    "appointment_id" VARCHAR(32) NOT NULL,
    "staff_id" VARCHAR(32) NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "heart_rate" INTEGER NOT NULL,
    "temperature" DECIMAL(4,1) NOT NULL,
    "respiratory_rate" INTEGER NOT NULL,
    "spo2" INTEGER NOT NULL,
    "berat_badan" DECIMAL(5,2),
    "tinggi_badan" DECIMAL(5,2),
    "triase_level" "TriaseLevel" NOT NULL,
    "catatan_perawat" TEXT,
    "assessed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triage_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" VARCHAR(32) NOT NULL,
    "patient_id" VARCHAR(32) NOT NULL,
    "doctor_id" VARCHAR(32) NOT NULL,
    "faskes_id" VARCHAR(32) NOT NULL,
    "appointment_id" VARCHAR(32),
    "parent_record_id" VARCHAR(32),
    "primary_icd10" VARCHAR(20) NOT NULL,
    "diagnosis_short" VARCHAR(255) NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "iv_hex" CHAR(24) NOT NULL,
    "hmac_digest" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "addendum_reason" TEXT,
    "is_break_glass" BOOLEAN NOT NULL DEFAULT false,
    "break_glass_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_images" (
    "id" VARCHAR(32) NOT NULL,
    "medical_record_id" VARCHAR(32) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "type" "ImageType" NOT NULL,
    "encrypted_blob_hex" TEXT NOT NULL,
    "iv_hex" CHAR(24) NOT NULL,
    "hmac_digest" CHAR(64) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" VARCHAR(32) NOT NULL,
    "patient_id" VARCHAR(32) NOT NULL,
    "entity_id" VARCHAR(36) NOT NULL,
    "entity_name" VARCHAR(150) NOT NULL,
    "entity_type" "GrantEntityType" NOT NULL,
    "scope" VARCHAR(100) NOT NULL DEFAULT 'READ_RME',
    "valid_until" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ,
    "is_break_glass" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_encounters" (
    "id" VARCHAR(32) NOT NULL,
    "appointment_id" VARCHAR(32) NOT NULL,
    "patient_id" VARCHAR(32) NOT NULL,
    "doctor_id" VARCHAR(32) NOT NULL,
    "encounter_token" VARCHAR(128) NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "active_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" VARCHAR(36) NOT NULL,
    "actor_id" VARCHAR(36),
    "actor_name" VARCHAR(120) NOT NULL,
    "actor_role" "UserRole" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "target_resource" VARCHAR(150) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "detail" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_submissions" (
    "id" VARCHAR(32) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "nik" CHAR(16) NOT NULL,
    "nama_lengkap" VARCHAR(120) NOT NULL,
    "birth_date" DATE NOT NULL,
    "alamat" TEXT NOT NULL,
    "ktp_url" VARCHAR(255) NOT NULL,
    "selfie_url" VARCHAR(255) NOT NULL,
    "watermark_text" VARCHAR(255) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "alasan_penolakan" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ,

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyd_submissions" (
    "id" VARCHAR(32) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "nik" CHAR(16) NOT NULL,
    "nama_lengkap" VARCHAR(120) NOT NULL,
    "str_number" VARCHAR(50) NOT NULL,
    "sip_number" VARCHAR(50) NOT NULL,
    "spesialisasi" VARCHAR(100) NOT NULL,
    "dokumen_str_url" VARCHAR(255) NOT NULL,
    "surat_tugas_url" VARCHAR(255),
    "watermark_text" VARCHAR(255) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "alasan_penolakan" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ,

    CONSTRAINT "kyd_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trouble_tickets" (
    "id" VARCHAR(32) NOT NULL,
    "reporter_id" VARCHAR(36),
    "reporter_name" VARCHAR(120) NOT NULL,
    "reporter_role" "UserRole" NOT NULL,
    "faskes_id" VARCHAR(32),
    "kategori" "TicketCategory" NOT NULL,
    "judul" VARCHAR(150) NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "trouble_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "faskes_kode_faskes_key" ON "faskes"("kode_faskes");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_nik_key" ON "patients"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "patients"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_str_number_key" ON "doctors"("str_number");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_sip_number_key" ON "doctors"("sip_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_user_id_key" ON "staff_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_nip_key" ON "staff_members"("nip");

-- CreateIndex
CREATE INDEX "appointments_faskes_id_tanggal_status_idx" ON "appointments"("faskes_id", "tanggal", "status");

-- CreateIndex
CREATE INDEX "appointments_patient_id_status_idx" ON "appointments"("patient_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "triage_assessments_appointment_id_key" ON "triage_assessments"("appointment_id");

-- CreateIndex
CREATE INDEX "medical_records_patient_id_doctor_id_idx" ON "medical_records"("patient_id", "doctor_id");

-- CreateIndex
CREATE INDEX "medical_records_parent_record_id_idx" ON "medical_records"("parent_record_id");

-- CreateIndex
CREATE INDEX "access_grants_patient_id_entity_id_is_revoked_valid_until_idx" ON "access_grants"("patient_id", "entity_id", "is_revoked", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "active_encounters_appointment_id_key" ON "active_encounters"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_encounters_encounter_token_key" ON "active_encounters"("encounter_token");

-- CreateIndex
CREATE INDEX "active_encounters_patient_id_doctor_id_is_closed_expires_at_idx" ON "active_encounters"("patient_id", "doctor_id", "is_closed", "expires_at");

-- CreateIndex
CREATE INDEX "security_audit_logs_timestamp_severity_idx" ON "security_audit_logs"("timestamp" DESC, "severity");

-- CreateIndex
CREATE INDEX "security_audit_logs_actor_id_action_idx" ON "security_audit_logs"("actor_id", "action");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dpjp_id_fkey" FOREIGN KEY ("dpjp_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_parent_record_id_fkey" FOREIGN KEY ("parent_record_id") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_images" ADD CONSTRAINT "medical_images_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_encounters" ADD CONSTRAINT "active_encounters_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_encounters" ADD CONSTRAINT "active_encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_encounters" ADD CONSTRAINT "active_encounters_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyd_submissions" ADD CONSTRAINT "kyd_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trouble_tickets" ADD CONSTRAINT "trouble_tickets_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trouble_tickets" ADD CONSTRAINT "trouble_tickets_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
