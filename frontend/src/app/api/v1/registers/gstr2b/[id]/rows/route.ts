import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/registers/gstr2b/[id]/rows
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    const registers = await prisma.register.findMany({
      where: { engagementId, registerType: 'gstr2b' },
    });

    if (registers.length === 0) return NextResponse.json([]);

    const rows = await prisma.registerRow.findMany({
      where: { registerId: { in: registers.map(r => r.id) } },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(rows.map(r => ({
      id: r.id,
      invoice_number: r.invoiceNumber,
      invoice_date: r.invoiceDate?.toISOString() ?? null,
      vendor_name: r.vendorName,
      vendor_gstin: r.vendorGstin,
      taxable_value: r.taxableValue,
      total_value: r.totalValue,
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch GSTR-2B rows' }, { status: 500 });
  }
}
