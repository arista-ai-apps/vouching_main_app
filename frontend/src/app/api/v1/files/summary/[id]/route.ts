import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/files/summary/[id]  — engagement ID as path param
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementIdNum = parseInt(id);

    if (isNaN(engagementIdNum)) {
      return NextResponse.json({ error: 'Invalid engagement id' }, { status: 400 });
    }

    const total = await prisma.uploadedFile.count({ where: { engagementId: engagementIdNum } });

    const statusCounts = await prisma.uploadedFile.groupBy({
      by: ['status'],
      where: { engagementId: engagementIdNum },
      _count: true,
    });
    const statusMap: Record<string, number> = {};
    statusCounts.forEach(item => { statusMap[item.status] = item._count; });

    const matched = await prisma.reconciliationResult.count({
      where: { engagementId: engagementIdNum, matchStatus: 'matched' },
    });

    const reconciliationResults = await prisma.reconciliationResult.findMany({
      where: { engagementId: engagementIdNum },
    });

    const exceptionMap: Record<string, number> = {};
    reconciliationResults.forEach(r => {
      if (r.matchStatus !== 'matched') {
        exceptionMap[r.matchStatus] = (exceptionMap[r.matchStatus] || 0) + 1;
      }
    });

    const totalValueResult = await prisma.extractedInvoice.aggregate({
      where: { file: { engagementId: engagementIdNum } },
      _sum: { totalValue: true },
    });
    const totalValue = totalValueResult._sum.totalValue || 0;

    const matchedValueResult = await prisma.extractedInvoice.aggregate({
      where: {
        file: { engagementId: engagementIdNum },
        reconciliationResults: { some: { matchStatus: 'matched' } },
      },
      _sum: { totalValue: true },
    });
    const totalMatchedValue = matchedValueResult._sum.totalValue || 0;

    const vendorBreakdown = await prisma.extractedInvoice.groupBy({
      by: ['vendorName'],
      where: { file: { engagementId: engagementIdNum } },
      _count: true,
      _sum: { totalValue: true },
      orderBy: { _count: { vendorName: 'desc' } },
      take: 10,
    });

    const matchRate = total > 0 ? Math.round((matched / total) * 100 * 10) / 10 : 0;

    // Count exception categories for report page
    const noReg = reconciliationResults.filter(r => r.matchStatus === 'no_register').length;
    const unmatched = reconciliationResults.filter(r => r.matchStatus === 'unmatched').length;

    return NextResponse.json({
      total,
      matched,
      not_in_registry: unmatched,
      missing_only_from_pr: unmatched,
      missing_in_2b_itc: 0,
      missing_in_2b_and_pr: 0,
      failed: statusMap['failed'] || 0,
      pending: total - (statusMap['completed'] || 0) - (statusMap['failed'] || 0),
      match_rate: matchRate,
      quality_score: Math.round(matchRate),
      total_value: Math.round(totalValue * 100) / 100,
      total_matched_value: Math.round(totalMatchedValue * 100) / 100,
      vendor_breakdown: vendorBreakdown.map(v => ({
        vendor: v.vendorName || 'Unknown',
        count: v._count,
        total: Math.round((v._sum.totalValue || 0) * 100) / 100,
      })),
      exceptions: exceptionMap,
    });
  } catch (error) {
    console.error('[API] GET /files/summary/:id error:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
