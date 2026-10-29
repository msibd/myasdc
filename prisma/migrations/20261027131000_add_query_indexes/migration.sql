-- CreateIndex
CREATE INDEX "Appointment_date_time_idx" ON "Appointment"("date", "time");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_idx" ON "Appointment"("doctorId", "date" DESC);

-- CreateIndex
CREATE INDEX "DiagnosticTest_isActive_department_name_idx" ON "DiagnosticTest"("isActive", "department", "name");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedAt_idx" ON "GoodsReceipt"("receivedAt" DESC);

-- CreateIndex
CREATE INDEX "InventoryItem_isActive_quantity_name_idx" ON "InventoryItem"("isActive", "quantity", "name");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "InvoicePayment_paidAt_idx" ON "InvoicePayment"("paidAt");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_paidAt_idx" ON "InvoicePayment"("invoiceId", "paidAt" DESC);

-- CreateIndex
CREATE INDEX "LabOrder_createdAt_idx" ON "LabOrder"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "LabOrder_patientId_createdAt_idx" ON "LabOrder"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Patient_isActive_createdAt_idx" ON "Patient"("isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderedAt_idx" ON "PurchaseOrder"("orderedAt" DESC);

-- CreateIndex
CREATE INDEX "Supplier_isActive_name_idx" ON "Supplier"("isActive", "name");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "user"("createdAt" DESC);
