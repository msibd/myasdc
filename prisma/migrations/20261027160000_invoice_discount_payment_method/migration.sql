ALTER TABLE "Invoice"
  ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cash';

UPDATE "Invoice"
SET "subtotal" = "total";

ALTER TABLE "InvoicePayment"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cash';
