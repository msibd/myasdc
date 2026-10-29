import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function bootstrapAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;
  const result = await auth.api.signUpEmail({ body: { name: "System Administrator", email, password } });
  if (result.user) await prisma.user.update({ where: { id: result.user.id }, data: { role: "superadmin" } });
}

async function main() {
  await bootstrapAdmin();
  if ((await prisma.patient.count()) === 0) {
    await prisma.patient.createMany({
      data: [
        { name: "Ayesha Rahman", phone: "+880 1712-345678", email: "ayesha@example.com", age: 32, gender: "Female", bloodGroup: "O+" },
        { name: "Tanvir Ahmed", phone: "+880 1812-987654", email: "tanvir@example.com", age: 45, gender: "Male", bloodGroup: "B+" },
        { name: "Nusrat Sultana", phone: "+880 1911-123456", email: "nusrat@example.com", age: 28, gender: "Female", bloodGroup: "A+" },
        { name: "Md. Imran Khan", phone: "+880 1611-222333", age: 54, gender: "Male", bloodGroup: "AB+" },
      ],
    });
  }

  if ((await prisma.doctor.count()) === 0) {
    await prisma.doctor.createMany({ data: [
      { name: "Dr. Saif Hasan", specialty: "Medicine", phone: "+880 1711-111111" },
      { name: "Dr. Nusrat Jahan", specialty: "Pathology", phone: "+880 1811-222222" },
      { name: "Dr. Arif Rahman", specialty: "Radiology", phone: "+880 1911-333333" },
    ] });
  }

  if ((await prisma.diagnosticTest.count()) === 0) {
    await prisma.diagnosticTest.createMany({ data: [
      { name: "Complete Blood Count", department: "Hematology", price: 650 },
      { name: "Lipid Profile", department: "Biochemistry", price: 850 },
      { name: "Thyroid Function Test", department: "Hormones", price: 1200 },
      { name: "Ultrasonography", department: "Radiology", price: 1500 },
    ] });
  }

  if ((await prisma.inventoryItem.count()) === 0) {
    await prisma.inventoryItem.createMany({ data: [
      { name: "EDTA Blood Collection Tube", sku: "LAB-EDTA-001", quantity: 240, reorderLevel: 50, unit: "boxes" },
      { name: "Urine Container", sku: "LAB-URI-001", quantity: 38, reorderLevel: 50, unit: "packs" },
      { name: "Surgical Gloves", sku: "LAB-GLV-001", quantity: 18, reorderLevel: 30, unit: "boxes" },
    ] });
  }

  if ((await prisma.appointment.count()) === 0) {
    const [patient, secondPatient, doctor, secondDoctor] = await Promise.all([
      prisma.patient.findFirstOrThrow({ where: { name: "Ayesha Rahman" } }),
      prisma.patient.findFirstOrThrow({ where: { name: "Tanvir Ahmed" } }),
      prisma.doctor.findFirstOrThrow({ where: { name: "Dr. Saif Hasan" } }),
      prisma.doctor.findFirstOrThrow({ where: { name: "Dr. Nusrat Jahan" } }),
    ]);
    const today = new Date();
    await prisma.appointment.createMany({ data: [
      { patientId: patient.id, doctorId: doctor.id, date: today, time: "09:30 AM", status: "scheduled" },
      { patientId: secondPatient.id, doctorId: secondDoctor.id, date: today, time: "10:15 AM", status: "scheduled" },
    ] });
  }

  if ((await prisma.labOrder.count()) === 0) {
    const [ayesha, tanvir] = await Promise.all([
      prisma.patient.findFirstOrThrow({ where: { name: "Ayesha Rahman" } }),
      prisma.patient.findFirstOrThrow({ where: { name: "Tanvir Ahmed" } }),
    ]);
    const [cbc, lipid] = await Promise.all([
      prisma.diagnosticTest.findFirstOrThrow({ where: { name: "Complete Blood Count" } }),
      prisma.diagnosticTest.findFirstOrThrow({ where: { name: "Lipid Profile" } }),
    ]);
    const verifiedOrder = await prisma.labOrder.create({ data: { patientId: ayesha.id, diagnosticTestId: cbc.id, status: "ready" } });
    const draftOrder = await prisma.labOrder.create({ data: { patientId: tanvir.id, diagnosticTestId: lipid.id, status: "processing" } });
    await prisma.testReport.createMany({ data: [
      { labOrderId: verifiedOrder.id, status: "verified", verifiedAt: new Date() },
      { labOrderId: draftOrder.id, status: "draft" },
    ] });
  }

  if ((await prisma.testReport.count()) === 0) {
    const order = await prisma.labOrder.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    await prisma.testReport.create({ data: { labOrderId: order.id, status: "draft" } });
  }

  if ((await prisma.invoice.count()) === 0) {
    const [ayesha, tanvir] = await Promise.all([
      prisma.patient.findFirstOrThrow({ where: { name: "Ayesha Rahman" } }),
      prisma.patient.findFirstOrThrow({ where: { name: "Tanvir Ahmed" } }),
    ]);
    await prisma.invoice.create({ data: { patientId: ayesha.id, total: 2450, paid: 2450, status: "paid", payments: { create: { amount: 2450 } } } });
    await prisma.invoice.create({ data: { patientId: tanvir.id, total: 1850, paid: 850, status: "partial", payments: { create: { amount: 850 } } } });
  }

  console.log("Diagnostic Centre seed data is ready.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
