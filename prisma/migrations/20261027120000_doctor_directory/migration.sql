ALTER TABLE "Doctor"
  ADD COLUMN "qualification" TEXT,
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "consultationFee" DECIMAL(10,2),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Doctor_registrationNumber_key" ON "Doctor"("registrationNumber");
CREATE INDEX "Doctor_isActive_name_idx" ON "Doctor"("isActive", "name");
