import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/registers/[id]/rows  — Get all purchase register rows for engagement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    const registers = await prisma.register.findMany({
      where: { engagementId, registerType: 'purchase' },
    });

    if (registers.length === 0) return NextResponse.json([]);

    const rows = await prisma.registerRow.findMany({
      where: { registerId: { in: registers.map(r => r.id) } },
      orderBy: { id: 'asc' },
    });

    // Serialize for frontend
    const serialized = rows.map(r => ({
      id: r.id,
      invoice_number: r.invoiceNumber,
      invoice_date: r.invoiceDate?.toISOString() ?? null,
      vendor_name: r.vendorName,
      vendor_gstin: r.vendorGstin,
      taxable_value: r.taxableValue,
      total_value: r.totalValue,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[REGISTERS] GET purchase rows error:', error);
    return NextResponse.json({ error: 'Failed to fetch rows' }, { status: 500 });
  }
}
