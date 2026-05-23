import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/hsn/status/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    // Find all invoices in this engagement that are missing an HSN code
    const invoices = await prisma.extractedInvoice.findMany({
      where: {
        file: { engagementId },
        OR: [
          { hsnCode: null },
          { hsnCode: '' },
          { hsnCode: 'null' },
          { hsnCode: 'None' },
          { hsnCode: 'missing' },
          { hsnCode: '0000' },
        ],
      },
      include: { file: true },
    });

    // Get any existing HSN recommendations for this engagement
    const recommendations = await prisma.hsnRecommendation.findMany({
      where: { engagementId },
    });

    const rows = invoices.map((invoice) => {
      const rec = recommendations.find((r) => r.fileId === invoice.fileId);
      return {
        file_id: invoice.fileId,
        filename: invoice.file.filename,
        invoice_number: invoice.invoiceNumber,
        vendor_name: invoice.vendorName,
        vendor_gstin: invoice.vendorGstin,
        taxable_value: invoice.taxableValue,
        recommendation: rec ? {
          item_description: rec.itemDescription,
          recommended_hsn: rec.recommendedHsn,
          recommended_hsn_description: rec.recommendedHsnDescription,
          confidence_score: rec.confidenceScore,
          status: rec.status,
          reasoning: rec.reasoning,
          top_alternatives: rec.topAlternatives ? JSON.parse(rec.topAlternatives as string) : [],
          accepted_hsn: rec.acceptedHsn,
          reviewed_by: rec.reviewedBy,
        } : null,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[API] GET /hsn/status/:id error:', error);
    return NextResponse.json({ error: 'Failed to fetch HSN status' }, { status: 500 });
  }
}
