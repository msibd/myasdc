import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authorization";

export const dynamic = "force-dynamic";

const validNumber = (value: unknown, min = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min ? number : null;
};
const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const isSerializationConflict = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");

export async function GET(request: Request) {
  const permission = await requirePermission(request, "inventory", ["list"]);
  if (permission.response) return permission.response;
  try {
    const today = day(new Date());
    const alertWindow = new Date(today);
    alertWindow.setDate(alertWindow.getDate() + 90);
    const [items, suppliers, tests, movements, receipts, purchaseOrders, consumption, supplierReceiptTotals] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { isActive: true }, orderBy: [{ quantity: "asc" }, { name: "asc" }],
        include: { supplier: true, batches: { where: { quantityOnHand: { gt: 0 } }, orderBy: { expiresAt: "asc" } }, mappings: { include: { diagnosticTest: true } } },
      }),
      prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.diagnosticTest.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.inventoryMovement.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { item: true, batch: true, diagnosticTest: true } }),
      prisma.goodsReceipt.findMany({ take: 50, orderBy: { receivedAt: "desc" }, include: { supplier: true, lines: { include: { item: true, batch: true } }, payments: { orderBy: { paidAt: "desc" } } } }),
      prisma.purchaseOrder.findMany({ take: 30, orderBy: { orderedAt: "desc" }, include: { supplier: true, lines: { include: { item: true } } } }),
      prisma.inventoryMovement.groupBy({ by: ["testId", "itemId"], where: { kind: "test_consumption", testId: { not: null } }, _sum: { quantity: true } }),
      prisma.goodsReceipt.groupBy({ by: ["supplierId"], _sum: { payableAmount: true, paidAmount: true } }),
    ]);
    const serializedItems = items.map((item) => ({
      ...item, quantity: Number(item.quantity), reorderLevel: Number(item.reorderLevel),
      batches: item.batches.map((batch) => ({ ...batch, quantityOnHand: Number(batch.quantityOnHand), quantityReceived: Number(batch.quantityReceived), purchasePrice: Number(batch.purchasePrice) })),
      mappings: item.mappings.map((mapping) => ({ ...mapping, quantityPerTest: Number(mapping.quantityPerTest) })),
    }));
    const lotReconciliation = serializedItems
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        unit: item.unit,
        untrackedQuantity: Math.max(0, item.quantity - item.batches.reduce((total, batch) => total + batch.quantityOnHand, 0)),
      }))
      .filter((item) => item.untrackedQuantity > 0);
    const serializedReceipts = receipts.map((receipt) => {
      const payableAmount = Number(receipt.payableAmount);
      const paidAmount = Number(receipt.paidAmount);
      return {
        ...receipt,
        payableAmount,
        paidAmount,
        dueAmount: Math.max(0, payableAmount - paidAmount),
        payments: receipt.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
      };
    });
    const serializedPurchaseOrders = purchaseOrders.map((order) => {
      const payableAmount = Number(order.payableAmount);
      const paidAmount = Number(order.paidAmount);
      return {
        ...order,
        payableAmount,
        paidAmount,
        dueAmount: Math.max(0, payableAmount - paidAmount),
        lines: order.lines.map((line) => ({ ...line, quantityOrdered: Number(line.quantityOrdered), quantityReceived: Number(line.quantityReceived), unitPrice: Number(line.unitPrice) })),
      };
    });
    const supplierBalances = suppliers.map((supplier) => {
      const totals = supplierReceiptTotals.find((row) => row.supplierId === supplier.id)?._sum;
      const invoiced = Number(totals?.payableAmount ?? 0);
      const paid = Number(totals?.paidAmount ?? 0);
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        invoiced,
        paid,
        due: Math.max(0, invoiced - paid),
      };
    }).filter((supplier) => supplier.invoiced > 0 || supplier.due > 0);
    const nearExpiry = serializedItems.flatMap((item) => item.batches.filter((batch) => batch.expiresAt <= alertWindow).map((batch) => ({ itemName: item.name, sku: item.sku, unit: item.unit, ...batch })));
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      items: serializedItems, suppliers, tests,
      alerts: {
        lowStock: serializedItems.filter((item) => item.quantity <= item.reorderLevel),
        expired: nearExpiry.filter((batch) => new Date(batch.expiresAt) < today),
        nearExpiry: nearExpiry.filter((batch) => new Date(batch.expiresAt) >= today),
      },
      movements: movements.map((movement) => ({ ...movement, quantity: Number(movement.quantity) })),
      receipts: serializedReceipts, purchaseOrders: serializedPurchaseOrders, supplierBalances, lotReconciliation,
      consumptionByTest: consumption.map((row) => {
        const test = tests.find((candidate) => candidate.id === row.testId);
        const item = items.find((candidate) => candidate.id === row.itemId);
        return { testId: row.testId, testName: test?.name ?? "Deleted test", department: test?.department ?? "—", itemName: item?.name ?? "Deleted item", unit: item?.unit ?? "", quantity: Math.abs(Number(row._sum.quantity ?? 0)) };
      }),
      valuation: serializedItems.reduce((sum, item) => sum + item.batches.reduce((batchSum, batch) => batchSum + batch.quantityOnHand * batch.purchasePrice, 0), 0),
    });
  } catch (error) {
    console.error("Inventory read failed", error);
    return NextResponse.json({ error: "Inventory data is unavailable. Apply the inventory migration and retry." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const action = String(body.action ?? "create");
  const requiredAction = action === "supplier_payment" ? "update" : ["issue", "adjust"].includes(action) ? "adjust" : "create";
  const permission = await requirePermission(request, "inventory", [requiredAction]);
  if (permission.response || !permission.session) return permission.response;

  try {
    if (action === "supplier") {
      if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Supplier name is required." }, { status: 422 });
      const supplier = await prisma.supplier.create({ data: { name: body.name.trim(), contactPerson: String(body.contactPerson ?? "") || null, phone: String(body.phone ?? "") || null, email: String(body.email ?? "") || null, address: String(body.address ?? "") || null } });
      return NextResponse.json(supplier, { status: 201 });
    }

    if (action === "create") {
      if (typeof body.name !== "string" || !body.name.trim() || typeof body.sku !== "string" || !body.sku.trim()) return NextResponse.json({ error: "Item name and SKU are required." }, { status: 422 });
      if (!(["reagent", "consumable", "film_paper", "kit", "stationery"].includes(String(body.category ?? "consumable")))) return NextResponse.json({ error: "Select a valid inventory category." }, { status: 422 });
      const reorderLevel = validNumber(body.reorderLevel ?? 0);
      if (reorderLevel === null) return NextResponse.json({ error: "Reorder level must be a non-negative number." }, { status: 422 });
      const item = await prisma.inventoryItem.create({ data: { name: body.name.trim(), sku: body.sku.trim(), category: String(body.category ?? "consumable"), reorderLevel, unit: String(body.unit ?? "pcs"), packSize: String(body.packSize ?? "") || null, storageCondition: String(body.storageCondition ?? "") || null, supplierId: String(body.supplierId ?? "") || null } });
      return NextResponse.json(item, { status: 201 });
    }

    if (action === "purchase") {
      if (typeof body.supplierId !== "string" || !Array.isArray(body.lines) || body.lines.length === 0) return NextResponse.json({ error: "Supplier and at least one purchase line are required." }, { status: 422 });
      const lines = body.lines.map((line) => {
        const row = line as Record<string, unknown>;
        return { itemId: String(row.itemId ?? ""), quantityOrdered: validNumber(row.quantity), unitPrice: validNumber(row.unitPrice) };
      });
      if (lines.some((line) => !line.itemId || !line.quantityOrdered || line.unitPrice === null)) return NextResponse.json({ error: "Each purchase line needs an item, positive quantity and valid unit price." }, { status: 422 });
      const payableAmount = lines.reduce((sum, line) => sum + (line.quantityOrdered ?? 0) * (line.unitPrice ?? 0), 0);
      const purchaseOrder = await prisma.purchaseOrder.create({ data: {
        orderNumber: `PO-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`, supplierId: body.supplierId,
        expectedAt: body.expectedAt ? new Date(String(body.expectedAt)) : null, payableAmount, createdBy: permission.session.user.id,
        lines: { create: lines.map((line) => ({ itemId: line.itemId, quantityOrdered: line.quantityOrdered!, unitPrice: line.unitPrice! })) },
      }, include: { supplier: true, lines: { include: { item: true } } } });
      return NextResponse.json(purchaseOrder, { status: 201 });
    }

    if (action === "receive") {
      const quantity = validNumber(body.quantity, 0.001);
      const unitPrice = validNumber(body.unitPrice);
      if (typeof body.itemId !== "string" || typeof body.supplierId !== "string" || typeof body.batchNumber !== "string" || !body.batchNumber.trim() || !body.expiresAt || quantity === null || unitPrice === null) return NextResponse.json({ error: "Item, supplier, batch number, future expiry, positive quantity and purchase price are required." }, { status: 422 });
      const expiresAt = new Date(String(body.expiresAt));
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= day(new Date())) return NextResponse.json({ error: "Expired stock cannot be received." }, { status: 422 });
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: body.itemId as string } });
        let purchaseOrderId = String(body.purchaseOrderId ?? "") || null;
        if (body.purchaseOrderLineId) {
          const line = await tx.purchaseOrderLine.findUnique({ where: { id: String(body.purchaseOrderLineId) }, include: { purchaseOrder: true } });
          if (!line || line.itemId !== item.id || line.purchaseOrder.supplierId !== body.supplierId) throw new Error("PO_LINE_MISMATCH");
          if (Number(line.quantityReceived) + quantity > Number(line.quantityOrdered)) throw new Error("PO_QTY_EXCEEDED");
          purchaseOrderId = line.purchaseOrderId;
        }
        const receipt = await tx.goodsReceipt.create({ data: { grnNumber: `GRN-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`, supplierId: body.supplierId as string, purchaseOrderId, invoiceNumber: String(body.invoiceNumber ?? "") || null, payableAmount: quantity * unitPrice, createdBy: permission.session!.user.id } });
        const batchNumber = (body.batchNumber as string).trim();
        const existingBatch = await tx.inventoryBatch.findUnique({ where: { itemId_batchNumber: { itemId: item.id, batchNumber } } });
        if (existingBatch && (existingBatch.expiresAt.getTime() !== expiresAt.getTime() || Number(existingBatch.purchasePrice) !== unitPrice)) throw new Error("BATCH_METADATA_MISMATCH");
        const batch = existingBatch
          ? await tx.inventoryBatch.update({ where: { id: existingBatch.id }, data: { quantityReceived: { increment: quantity }, quantityOnHand: { increment: quantity } } })
          : await tx.inventoryBatch.create({ data: { itemId: item.id, batchNumber, manufacturedAt: body.manufacturedAt ? new Date(String(body.manufacturedAt)) : null, expiresAt, purchasePrice: unitPrice, quantityReceived: quantity, quantityOnHand: quantity } });
        await tx.goodsReceiptLine.create({ data: { goodsReceiptId: receipt.id, itemId: item.id, batchId: batch.id, quantity, unitPrice } });
        await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: { increment: quantity }, supplierId: body.supplierId as string } });
        await tx.inventoryMovement.create({ data: { itemId: item.id, batchId: batch.id, kind: "stock_in", quantity, reference: receipt.grnNumber, reason: "Goods received", actorId: permission.session!.user.id } });
        if (body.purchaseOrderLineId) {
          const line = await tx.purchaseOrderLine.update({ where: { id: String(body.purchaseOrderLineId) }, data: { quantityReceived: { increment: quantity } } });
          const orderLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: line.purchaseOrderId } });
          const complete = orderLines.every((row) => Number(row.quantityReceived) >= Number(row.quantityOrdered));
          await tx.purchaseOrder.update({ where: { id: line.purchaseOrderId }, data: { status: complete ? "received" : "partially_received", invoiceNumber: String(body.invoiceNumber ?? "") || undefined } });
        }
        return { item, batch, receipt };
      }, { isolationLevel: "Serializable" });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "supplier_payment") {
      const amount = validNumber(body.amount, 0.01);
      const goodsReceiptId = body.goodsReceiptId;
      if (typeof goodsReceiptId !== "string" || amount === null) return NextResponse.json({ error: "Goods receipt and a positive payment amount are required." }, { status: 422 });
      const result = await prisma.$transaction(async (tx) => {
        const receipt = await tx.goodsReceipt.findUniqueOrThrow({ where: { id: goodsReceiptId } });
        const dueAmount = Number(receipt.payableAmount) - Number(receipt.paidAmount);
        if (amount > dueAmount) throw new Error("PAYMENT_EXCEEDS_DUE");
        const payment = await tx.supplierPayment.create({ data: { goodsReceiptId: receipt.id, amount, reference: String(body.reference ?? "") || null, note: String(body.note ?? "") || null, actorId: permission.session!.user.id } });
        const updatedReceipt = await tx.goodsReceipt.update({ where: { id: receipt.id }, data: { paidAmount: { increment: amount } } });
        if (receipt.purchaseOrderId) {
          await tx.purchaseOrder.update({ where: { id: receipt.purchaseOrderId }, data: { paidAmount: { increment: amount } } });
        }
        return { payment, receipt: updatedReceipt };
      }, { isolationLevel: "Serializable" });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "issue" || action === "adjust") {
      const quantity = validNumber(body.quantity ?? body.amount, 0.001);
      const reason = String(body.reason ?? "").trim();
      if (typeof body.itemId !== "string" || quantity === null || !reason) return NextResponse.json({ error: "Item, positive quantity and a reason are required." }, { status: 422 });
      const isIssue = action === "issue";
      const adjustmentKinds = ["damage", "expired", "spillage", "qc_calibration", "stock_count_correction"];
      const adjustmentIn = !isIssue && body.direction === "in";
      if (!isIssue && !adjustmentKinds.includes(String(body.kind))) return NextResponse.json({ error: "Select a valid adjustment reason." }, { status: 422 });
      if (isIssue && typeof body.department !== "string") return NextResponse.json({ error: "Department is required for stock issue." }, { status: 422 });
      if (adjustmentIn && (typeof body.batchNumber !== "string" || !body.batchNumber.trim() || !body.expiresAt || validNumber(body.unitPrice) === null)) return NextResponse.json({ error: "Positive count corrections require a lot number, expiry date and unit valuation." }, { status: 422 });
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: body.itemId as string } });
        if (adjustmentIn) {
          const expiresAt = new Date(String(body.expiresAt));
          if (Number.isNaN(expiresAt.getTime()) || expiresAt <= day(new Date())) throw new Error("INVALID_EXPIRY");
          const batch = await tx.inventoryBatch.upsert({
            where: { itemId_batchNumber: { itemId: item.id, batchNumber: String(body.batchNumber).trim() } },
            create: { itemId: item.id, batchNumber: String(body.batchNumber).trim(), manufacturedAt: body.manufacturedAt ? new Date(String(body.manufacturedAt)) : null, expiresAt, purchasePrice: Number(body.unitPrice), quantityReceived: quantity, quantityOnHand: quantity },
            update: { quantityReceived: { increment: quantity }, quantityOnHand: { increment: quantity } },
          });
          await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: { increment: quantity } } });
          await tx.inventoryMovement.create({ data: { itemId: item.id, batchId: batch.id, kind: String(body.kind), quantity, reason, actorId: permission.session!.user.id } });
          return { success: true, itemId: item.id, adjusted: quantity };
        }
        if (Number(item.quantity) < quantity) throw new Error("INSUFFICIENT_STOCK");
        let remaining = quantity;
        const today = day(new Date());
        const batches = await tx.inventoryBatch.findMany({
          where: {
            itemId: item.id,
            quantityOnHand: { gt: 0 },
            ...(isIssue ? { expiresAt: { gt: today } } : String(body.kind) === "expired" ? { expiresAt: { lte: today } } : {}),
          },
          orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
        });
        for (const batch of batches) {
          if (remaining <= 0) break;
          const available = Number(batch.quantityOnHand);
          const taken = Math.min(available, remaining);
          const update = await tx.inventoryBatch.updateMany({ where: { id: batch.id, quantityOnHand: { gte: taken } }, data: { quantityOnHand: { decrement: taken } } });
          if (update.count !== 1) throw new Error("STOCK_CONFLICT");
          await tx.inventoryMovement.create({ data: { itemId: item.id, batchId: batch.id, kind: isIssue ? "issue" : String(body.kind), quantity: -taken, reason, department: String(body.department ?? "") || null, actorId: permission.session!.user.id } });
          remaining -= taken;
        }
        if (remaining > 0) throw new Error(String(body.kind) === "expired" ? "INSUFFICIENT_EXPIRED_STOCK" : "BATCH_STOCK_MISMATCH");
        const updated = await tx.inventoryItem.updateMany({ where: { id: item.id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
        if (updated.count !== 1) throw new Error("STOCK_CONFLICT");
        return { success: true, itemId: item.id, issued: quantity, issueMethod: "FEFO" };
      }, { isolationLevel: "Serializable" });
      return NextResponse.json(result);
    }

    if (action === "map") {
      const quantityPerTest = validNumber(body.quantityPerTest, 0.001);
      if (typeof body.testId !== "string" || typeof body.itemId !== "string" || quantityPerTest === null) return NextResponse.json({ error: "Test, inventory item and positive quantity per test are required." }, { status: 422 });
      return NextResponse.json(await prisma.testInventoryMapping.upsert({ where: { diagnosticTestId_inventoryItemId: { diagnosticTestId: body.testId, inventoryItemId: body.itemId } }, create: { diagnosticTestId: body.testId, inventoryItemId: body.itemId, quantityPerTest }, update: { quantityPerTest } }));
    }

    return NextResponse.json({ error: "Unknown inventory action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return NextResponse.json({ error: "Insufficient available stock." }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_EXPIRY") return NextResponse.json({ error: "Expiry date is invalid." }, { status: 422 });
    if (error instanceof Error && error.message === "PO_LINE_MISMATCH") return NextResponse.json({ error: "Selected purchase order line, item and supplier do not match." }, { status: 422 });
    if (error instanceof Error && error.message === "PO_QTY_EXCEEDED") return NextResponse.json({ error: "Receipt quantity is more than the remaining purchase order quantity." }, { status: 422 });
    if (error instanceof Error && error.message === "BATCH_METADATA_MISMATCH") return NextResponse.json({ error: "This lot already exists with a different expiry date or purchase price. Review the batch record before receiving it." }, { status: 422 });
    if (error instanceof Error && error.message === "PAYMENT_EXCEEDS_DUE") return NextResponse.json({ error: "Payment cannot be greater than the outstanding supplier due." }, { status: 422 });
    if (error instanceof Error && error.message === "INSUFFICIENT_EXPIRED_STOCK") return NextResponse.json({ error: "There is not enough expired lot stock available for this disposal." }, { status: 409 });
    if (isSerializationConflict(error)) return NextResponse.json({ error: "Inventory changed concurrently. Refresh and retry the operation." }, { status: 409 });
    if (error instanceof Error && error.message === "BATCH_STOCK_MISMATCH") return NextResponse.json({ error: "The requested quantity is not available in tracked lots. Receive or reconcile the item into a valid lot before issuing it." }, { status: 409 });
    if (error instanceof Error && error.message === "STOCK_CONFLICT") return NextResponse.json({ error: "Stock changed concurrently. Refresh and retry the operation." }, { status: 409 });
    console.error("Inventory action failed", error);
    return NextResponse.json({ error: "Unable to complete the inventory operation. Check item, supplier and batch details." }, { status: 500 });
  }
}
