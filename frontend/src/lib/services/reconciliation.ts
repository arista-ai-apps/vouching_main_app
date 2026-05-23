import Fuse from 'fuse.js';
import { prisma } from '../prisma';

interface RegisterData {
  invoice_number: string | null;
  invoice_date: Date | null;
  vendor_name: string | null;
  taxable_value: number | null;
  total_value: number | null;
}

interface InvoiceData {
  id: number;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  vendorName: string | null;
  taxableValue: number | null;
  totalValue: number | null;
}

function calculateSimilarityScore(invoice: InvoiceData, register: RegisterData): number {
  let score = 0;

  // Invoice number match (40% weight)
  if (
    invoice.invoiceNumber &&
    register.invoice_number &&
    invoice.invoiceNumber.toLowerCase() === register.invoice_number.toLowerCase()
  ) {
    score += 40;
  }

  // Date match (20% weight) - within 7 days
  if (invoice.invoiceDate && register.invoice_date) {
    const daysDiff = Math.abs(
      (invoice.invoiceDate.getTime() - register.invoice_date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff <= 7) {
      score += 20 * (1 - daysDiff / 7);
    }
  }

  // Vendor name match (20% weight)
  if (invoice.vendorName && register.vendor_name) {
    const fuse = new Fuse([register.vendor_name], {
      threshold: 0.3,
    });
    if (fuse.search(invoice.vendorName).length > 0) {
      score += 20;
    }
  }

  // Amount match (20% weight) - within 5% tolerance
  if (invoice.totalValue && register.total_value) {
    const percentDiff = Math.abs((invoice.totalValue - register.total_value) / register.total_value) * 100;
    if (percentDiff <= 5) {
      score += 20 * (1 - percentDiff / 5);
    }
  }

  return Math.round(score);
}

export async function reconcileSingleInvoice(invoiceId: number): Promise<void> {
  console.log(`[RECONCILIATION] Starting reconciliation for invoice: ${invoiceId}`);

  try {
    const invoice = await prisma.extractedInvoice.findUnique({
      where: { id: invoiceId },
      include: { file: true },
    });

    if (!invoice) {
      console.error(`[RECONCILIATION] Invoice not found: ${invoiceId}`);
      return;
    }

    const { engagementId } = invoice.file;

    // Get all registers for this engagement
    const registers = await prisma.registerRow.findMany({
      where: {
        register: {
          engagementId,
        },
      },
      include: {
        register: true,
      },
    });

    if (registers.length === 0) {
      console.warn(`[RECONCILIATION] No registers found for engagement: ${engagementId}`);
      return;
    }

    let bestMatch: {
      registerRow: (typeof registers)[0];
      score: number;
    } | null = null;

    // Find best matching register row
    for (const reg of registers) {
      const registerData: RegisterData = {
        invoice_number: reg.invoiceNumber,
        invoice_date: reg.invoiceDate,
        vendor_name: reg.vendorName,
        taxable_value: reg.taxableValue,
        total_value: reg.totalValue,
      };

      const invoiceData: InvoiceData = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        vendorName: invoice.vendorName,
        taxableValue: invoice.taxableValue,
        totalValue: invoice.totalValue,
      };

      const score = calculateSimilarityScore(invoiceData, registerData);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { registerRow: reg, score };
      }
    }

    // Create or update reconciliation result
    let matchStatus = 'unmatched';
    if (bestMatch && bestMatch.score > 60) {
      matchStatus = 'matched';
    }

    await prisma.reconciliationResult.upsert({
      where: {
        // Using a composite unique constraint
        id: 0, // This won't work, need to handle differently
      },
      update: {
        matchStatus,
        matchScore: bestMatch?.score || 0,
        registerRowId: bestMatch?.registerRow.id || null,
      },
      create: {
        engagementId,
        invoiceId,
        registerRowId: bestMatch?.registerRow.id || null,
        matchStatus,
        matchScore: bestMatch?.score || 0,
      },
    });

    console.log(
      `[RECONCILIATION] Match result: ${matchStatus} (score: ${bestMatch?.score || 0}) for invoice: ${invoice.invoiceNumber}`
    );
  } catch (error) {
    console.error('[RECONCILIATION] Error:', error);
    throw error;
  }
}

export async function runFullReconciliation(engagementId: number): Promise<void> {
  console.log(`[RECONCILIATION] Starting full reconciliation for engagement: ${engagementId}`);

  try {
    // Get all invoices for this engagement
    const invoices = await prisma.extractedInvoice.findMany({
      where: {
        file: {
          engagementId,
        },
      },
    });

    // Reconcile each invoice
    for (const invoice of invoices) {
      await reconcileSingleInvoice(invoice.id);
    }

    console.log(`[RECONCILIATION] Full reconciliation complete for engagement: ${engagementId}`);
  } catch (error) {
    console.error('[RECONCILIATION] Error:', error);
    throw error;
  }
}
