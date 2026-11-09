-- AlterTable
ALTER TABLE "medical_images" ADD COLUMN     "binary_hmac" VARCHAR(128),
ADD COLUMN     "file_size_bytes" BIGINT;

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "claim_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "vital_signs_trend" JSONB;
