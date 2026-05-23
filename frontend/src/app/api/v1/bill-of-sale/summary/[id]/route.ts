import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/bill-of-sale/summary/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    if (isNaN(engagementId)) {
      return NextResponse.json({ error: 'Invalid engagement id' }, { status: 400 });
    }

    // Total bills of sale for this engagement
    const total = await prisma.billOfSaleFile.count({ where: { engagementId } });

    const statusCounts = await prisma.billOfSaleFile.groupBy({
      by: ['status'],
      where: { engagementId },
      _count: true,
    });
    const statusMap: Record<string, number> = {};
    statusCounts.forEach(s => { statusMap[s.status] = s._count; });

    // Matched BOS (via reconciliation results linked to billOfSaleId)
    const matchedCount = await prisma.reconciliationResult.count({
      where: { engagementId, matchStatus: 'matched', billOfSaleId: { not: null } },
    });

    // Total & matched values from extracted bill of sale data
    const totalValueResult = await prisma.extractedBillOfSale.aggregate({
      where: { file: { engagementId } },
      _sum: { totalValue: true, taxableValue: true },
    });
    const totalValue = totalValueResult._sum.totalValue || 0;
    const totalTaxable = totalValueResult._sum.taxableValue || 0;

    const matchedValueResult = await prisma.extractedBillOfSale.aggregate({
      where: {
        file: { engagementId },
        reconciliationResults: { some: { matchStatus: 'matched' } },
      },
      _sum: { totalValue: true },
    });
    const totalMatchedValue = matchedValueResult._sum.totalValue || 0;

    // Buyer breakdown
    const buyerBreakdown = await prisma.extractedBillOfSale.groupBy({
      by: ['buyerName'],
      where: { file: { engagementId } },
      _count: true,
      _sum: { totalValue: true },
      orderBy: { _count: { buyerName: 'desc' } },
      take: 10,
    });

    const extracted = statusMap['completed'] || 0;
    const failed = statusMap['failed'] || 0;
    const pending = total - extracted - failed;
    const notInRegistry = extracted - matchedCount > 0 ? extracted - matchedCount : 0;
    const extractionRate = total > 0 ? Math.round((extracted / total) * 100 * 10) / 10 : 0;

    return NextResponse.json({
      total,
      extracted,
      matched: matchedCount,
      not_in_registry: notInRegistry,
      failed,
      pending,
      extraction_rate: extractionRate,
      total_value: Math.round(totalValue * 100) / 100,
      total_taxable: Math.round(totalTaxable * 100) / 100,
      total_matched_value: Math.round(totalMatchedValue * 100) / 100,
      buyer_breakdown: buyerBreakdown.map(b => ({
        buyer: b.buyerName || 'Unknown',
        count: b._count,
        total: Math.round((b._sum.totalValue || 0) * 100) / 100,
      })),
    });
  } catch (error) {
    console.error('[API] GET /bill-of-sale/summary/:id error:', error);
    return NextResponse.json({ error: 'Failed to fetch bill of sale summary' }, { status: 500 });
  }
}
