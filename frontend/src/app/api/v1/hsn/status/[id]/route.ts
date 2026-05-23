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

    const files = await prisma.uploadedFile.findMany({
      where: { engagementId, status: { in: ['extracted', 'completed'] } },
      include: {
        invoices: { include: { hsnRecommendations: true } },
      },
    });

    const missingHsnRows = [];
    for (const file of files) {
      for (const invoice of file.invoices) {
        const hsn = invoice.hsnCode;
        const isMissing = !hsn || hsn === 'null' || hsn === 'None' || hsn === 'missing' || hsn === '0000';
        if (!isMissing) continue;

        const rec = invoice.hsnRecommendations?.[0];
        missingHsnRows.push({
          file_id: file.id,
          filename: file.filename,
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
            top_alternatives: rec.topAlternatives ? JSON.parse(rec.topAlternatives) : [],
            accepted_hsn: rec.acceptedHsn,
            reviewed_by: rec.reviewedBy,
          } : null,
        });
      }
    }

    return NextResponse.json(missingHsnRows);
  } catch (error) {
    console.error('[API] GET /hsn/status/:id error:', error);
    return NextResponse.json({ error: 'Failed to fetch HSN status' }, { status: 500 });
  }
}
