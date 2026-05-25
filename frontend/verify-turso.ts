import './load-env';
import { prisma } from './src/lib/prisma';

async function verifyTurso() {
  console.log("================================================================");
  console.log("🔍 AUDITING TURSO CLOUD DATABASE STORAGE ROWS");
  console.log("================================================================");

  try {
    const dbUrl = process.env.TURSO_DATABASE_URL;
    console.log("🔗 Connecting to:", dbUrl);

    // 1. Files
    const files = await prisma.uploadedFile.findMany({
      orderBy: { id: 'desc' },
      take: 5
    });

    console.log(`\n📂 [UploadedFile] Last 5 records stored on Turso:`);
    for (const f of files) {
      console.log(`   - ID: ${f.id} | Filename: "${f.filename}" | Status: [ ${f.status.toUpperCase()} ] | Created: ${f.createdAt.toISOString()}`);
    }

    // 2. Extracted Invoices
    const invoices = await prisma.extractedInvoice.findMany({
      orderBy: { id: 'desc' },
      take: 5,
      include: {
        file: true
      }
    });

    console.log(`\n🧠 [ExtractedInvoice] Last 5 parsed invoice records on Turso:`);
    for (const inv of invoices) {
      console.log(`   - ID: ${inv.id} | Inv Num: "${inv.invoiceNumber}" | Vendor: "${inv.vendorName}" | Total: ${inv.totalValue} | HSN: "${inv.hsnCode}" | FileId: ${inv.fileId} (${inv.file?.filename || 'no-file'})`);
    }

    // 3. Reconciliation Results
    const results = await prisma.reconciliationResult.findMany({
      orderBy: { id: 'desc' },
      take: 5,
      include: {
        invoice: true,
        registerRow: true
      }
    });

    console.log(`\n🔄 [ReconciliationResult] Last 5 match links stored on Turso:`);
    for (const res of results) {
      console.log(`   - ID: ${res.id} | Match Status: [ ${res.matchStatus.toUpperCase()} ] | Score: ${res.matchScore}%`);
      console.log(`     └─ Extracted Invoice: ID ${res.extractedInvoiceId} ("${res.invoice?.invoiceNumber}" from "${res.invoice?.vendorName}")`);
      if (res.registerRow) {
        console.log(`     └─ Register Row: ID ${res.registerRowId} ("${res.registerRow?.invoiceNumber}" from "${res.registerRow?.vendorName}")`);
      } else {
        console.log(`     └─ Register Row: NONE`);
      }
    }

    // 4. Summary counts
    const fileCount = await prisma.uploadedFile.count();
    const invCount = await prisma.extractedInvoice.count();
    const matchCount = await prisma.reconciliationResult.count();
    const regRowCount = await prisma.registerRow.count();

    const engagements = await prisma.engagement.findMany({
      include: {
        _count: {
          select: { registers: true }
        }
      }
    });
    console.log(`\n💼 [Engagement] List of engagements on Turso:`);
    for (const e of engagements) {
      console.log(`   - ID: ${e.id} | Period: ${e.periodStart} to ${e.periodEnd} | Status: ${e.status} | Registers Count: ${e._count.registers}`);
    }

    console.log("\n================================================================");
    console.log("📊 TURSO DATABASE ROW COUNT STATISTICS");
    console.log("================================================================");
    console.log(`   Total UploadedFiles:       ${fileCount}`);
    console.log(`   Total ExtractedInvoices:   ${invCount}`);
    console.log(`   Total ReconciliationRows:  ${matchCount}`);
    console.log(`   Total RegisterRows:        ${regRowCount}`);
    console.log("================================================================");

  } catch (error: any) {
    console.error("❌ ERROR: Failed to audit Turso rows:", error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTurso();
