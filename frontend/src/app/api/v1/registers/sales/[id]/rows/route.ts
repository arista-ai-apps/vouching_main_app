import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/registers/sales/[id]/rows
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    const registers = await prisma.register.findMany({
      where: { engagementId, registerType: 'sales' },
    });

    if (registers.length === 0) return NextResponse.json([]);

    const rows = await prisma.registerRow.findMany({
      where: { registerId: { in: registers.map(r => r.id) } },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(rows.map(r => ({
      id: r.id,
      sale_number: r.invoiceNumber,
      sale_date: r.invoiceDate?.toISOString() ?? null,
      buyer_name: r.vendorName,
      buyer_gstin: r.vendorGstin,
      taxable_value: r.taxableValue,
      total_value: r.totalValue,
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sales rows' }, { status: 500 });
  }
}
