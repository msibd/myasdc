-- Add traceable diagnostic order, specimen, result, approval, and delivery workflow.
-- Existing records are preserved; newly introduced foreign keys are optional.

ALTER TABLE "Invoice" ADD COLUMN "labOrderId" TEXT;

ALTER TABLE "LabOrder"
  ADD COLUMN "doctorId" TEXT,
  ADD COLUMN "sampleBarcode" TEXT,
  ADD COLUMN "sampleCollectedAt" TIMESTAMP(3),
  ADD COLUMN "sampleCollectedById" TEXT,
  ADD COLUMN "sampleStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "specimenType" TEXT,
  ADD COLUMN "technicianAssignedAt" TIMESTAMP(3),
  ADD COLUMN "technicianId" TEXT,
  ADD COLUMN "testPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ALTER COLUMN "status" SET DEFAULT 'awaiting_sample';

ALTER TABLE "TestReport"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "enteredById" TEXT,
  ADD COLUMN "resultEnteredAt" TIMESTAMP(3),
  ADD COLUMN "resultText" TEXT,
  ADD COLUMN "verifiedById" TEXT;

CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_labOrderId_key" ON "Invoice"("labOrderId");
CREATE UNIQUE INDEX "LabOrder_sampleBarcode_key" ON "LabOrder"("sampleBarcode");
CREATE INDEX "LabOrder_status_createdAt_idx" ON "LabOrder"("status", "createdAt" DESC);
CREATE INDEX "LabOrder_technicianId_status_idx" ON "LabOrder"("technicianId", "status");
CREATE INDEX "TestReport_status_resultEnteredAt_idx" ON "TestReport"("status", "resultEnteredAt");
CREATE INDEX "WorkflowEvent_labOrderId_createdAt_idx" ON "WorkflowEvent"("labOrderId", "createdAt");
CREATE INDEX "WorkflowEvent_actorId_createdAt_idx" ON "WorkflowEvent"("actorId", "createdAt");

ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_sampleCollectedById_fkey"
  FOREIGN KEY ("sampleCollectedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_technicianId_fkey"
  FOREIGN KEY ("technicianId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestReport" ADD CONSTRAINT "TestReport_enteredById_fkey"
  FOREIGN KEY ("enteredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestReport" ADD CONSTRAINT "TestReport_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestReport" ADD CONSTRAINT "TestReport_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_labOrderId_fkey"
  FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_labOrderId_fkey"
  FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
