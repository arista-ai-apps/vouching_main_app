import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/files/tax-mismatches/[id]?status=MISMATCH|NEEDS_REVIEW
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = { engagementId };
    if (status === 'MISMATCH') where.isMismatch = 1;
    else if (status === 'NEEDS_REVIEW') where.status = 'NEEDS_REVIEW';

    const mismatches = await prisma.taxTypeMismatch.findMany({
      where,
      include: { invoice: { include: { file: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const rows = mismatches.map((m) => ({
      invoice_id: m.invoiceId,
      invoice_number: m.invoice.invoiceNumber,
      vendor_name: m.invoice.vendorName,
      determined_supply_type: m.determinedSupplyType ?? '',
      expected_tax_type: m.expectedTaxType ?? '',
      actual_tax_type: m.actualTaxType ?? '',
      reason: m.reason ?? '',
      suggestion: m.suggestion ?? '',
      status: m.status,
      filename: m.invoice.file.filename,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[API] GET /files/tax-mismatches/:id error:', error);
    return NextResponse.json({ error: 'Failed to fetch tax mismatches' }, { status: 500 });
  }
}
