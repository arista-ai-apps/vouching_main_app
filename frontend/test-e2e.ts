import './load-env'; // MUST BE FIRST IMPORT
import * as fs from 'fs';
import * as path from 'path';

import { prisma } from './src/lib/prisma';
import { extractInvoiceData } from './src/lib/services/extraction';
import { runFullReconciliation } from './src/lib/services/reconciliation';

async function main() {
  console.log("================================================================");
  console.log("🚀 STARTING TS E2E INTEGRATION TEST (PDF EXTRACTION + RECONCILE)");
  console.log("================================================================");

  try {
    // Check environment variables
    const openaiKey = process.env.OPENAI_API_KEY;
    const dbUrl = process.env.TURSO_DATABASE_URL;

    if (!openaiKey || !dbUrl) {
      console.error("❌ ERROR: OPENAI_API_KEY or TURSO_DATABASE_URL not set in .env.local");
      process.exit(1);
    }

    console.log("✅ Environment check complete.");
    console.log("🔗 Turso Database URL:", dbUrl);

    // Get the latest engagement
    const engagement = await prisma.engagement.findFirst({
      orderBy: { id: 'desc' },
      include: {
        registers: {
          include: {
            rows: true
          }
        }
      }
    });

    if (!engagement) {
      console.error("❌ ERROR: No engagement found. Run seed or create an engagement first.");
      process.exit(1);
    }

    const engagementId = engagement.id;
    console.log(`✅ Using Engagement ID: ${engagementId}`);
    console.log(`✅ Registers associated: ${engagement.registers.length}`);
    for (const r of engagement.registers) {
      console.log(`   - Register ID: ${r.id}, Type: ${r.registerType}, Rows: ${r.rows.length}`);
    }

    // Load PDF file
    const pdfPath = path.resolve('../temp/tax_intra_correct.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ ERROR: Sample PDF not found at "${pdfPath}"`);
      process.exit(1);
    }

    console.log(`✅ Located PDF file: "${pdfPath}"`);
    const fileBuffer = fs.readFileSync(pdfPath);

    // Create a new UploadedFile record in the database
    console.log("📁 Creating UploadedFile record...");
    const dbFile = await prisma.uploadedFile.create({
      data: {
        engagementId,
        filename: 'tax_intra_correct.pdf',
        filePath: '',
        status: 'processing'
      }
    });
    console.log(`✅ File record created. ID: ${dbFile.id}`);

    // Call OCR Extraction Service
    console.log("🧠 Invoking extractInvoiceData (PDF extraction + OpenAI GPT-4o-mini)...");
    const startTime = Date.now();
    const extracted = await extractInvoiceData(fileBuffer, dbFile.id, engagementId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Extraction complete in ${duration} seconds!`);
    console.log("📊 Extracted Invoice details:");
    console.log(`   - Invoice Number: ${extracted.invoice_number}`);
    console.log(`   - Vendor Name: ${extracted.vendor_name}`);
    console.log(`   - Total Value: ${extracted.total_value}`);
    console.log(`   - Taxable Value: ${extracted.taxable_value}`);

    // Call reconciliation service
    console.log("🔄 Running Bulk Reconciliation on the engagement...");
    await runFullReconciliation(engagementId);
    console.log("✅ Reconciliation finished!");

    // Fetch the result from the database to verify
    const invoice = await prisma.extractedInvoice.findFirst({
      where: { fileId: dbFile.id },
      include: {
        reconciliationResults: {
          include: {
            registerRow: true
          }
        }
      }
    });

    if (!invoice) {
      console.error("❌ ERROR: ExtractedInvoice record was not saved in the database.");
      process.exit(1);
    }

    console.log("\n================================================================");
    console.log("✨ E2E INTEGRATION TEST RESULT: SUCCESS!");
    console.log("================================================================");
    console.log(`File ID: ${invoice.fileId}`);
    console.log(`Invoice Number: ${invoice.invoiceNumber}`);
    console.log(`Vendor Name: ${invoice.vendorName}`);
    console.log(`Total Value: ${invoice.totalValue}`);
    console.log(`Reconciliation Result count: ${invoice.reconciliationResults.length}`);
    for (const r of invoice.reconciliationResults) {
      console.log(`   - Match Status: [ ${r.matchStatus.toUpperCase()} ]`);
      console.log(`   - Match Score: ${r.matchScore}%`);
      if (r.registerRow) {
        console.log(`   - Matched Register Row ID: ${r.registerRow.id}`);
        console.log(`     Register Invoice Number: ${r.registerRow.invoiceNumber}`);
        console.log(`     Register Vendor Name: ${r.registerRow.vendorName}`);
      } else {
        console.log("   - Matched Register Row: NONE");
      }
    }
    console.log("================================================================");

  } catch (error) {
    console.error("❌ E2E Integration test failed with error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
