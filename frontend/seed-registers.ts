import './load-env';
import { prisma } from './src/lib/prisma';

async function seed() {
  console.log("====================================================");
  console.log("🌱 SEEDING PURCHASE REGISTER TO TURSO");
  console.log("====================================================");

  try {
    const engagement = await prisma.engagement.findFirst({
      orderBy: { id: 'desc' }
    });

    if (!engagement) {
      console.error("No engagement found.");
      return;
    }

    const engagementId = engagement.id;
    console.log(`Using Engagement ID: ${engagementId}`);

    // Create a Register
    const register = await prisma.register.create({
      data: {
        engagementId,
        registerType: 'purchase',
        filename: 'purchase_register_rb_systems.xlsx'
      }
    });

    console.log(`Created Register: ${register.id}`);

        // Create Register Rows
    const row = await prisma.registerRow.create({
      data: {
        registerId: register.id,
        invoiceNumber: 'CORRECT-TAX-001',
        invoiceDate: new Date('2026-04-04'),
        vendorName: 'Mumbai Logistics Services',
        vendorGstin: '27SUPPL1234F1Z1',
        taxableValue: 10000,
        totalValue: 11800
      }
    });

    console.log(`Created Register Row ID: ${row.id} for Invoice CORRECT-TAX-001`);
    console.log("✅ Seeding complete!");

  } catch (err: any) {
    console.error("Seeding failed:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
