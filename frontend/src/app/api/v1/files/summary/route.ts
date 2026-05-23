import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/files/summary?engagement_id=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const engagementId = searchParams.get('engagement_id');

    if (!engagementId) {
      return NextResponse.json(
        { error: 'engagement_id is required' },
        { status: 400 }
      );
    }

    const engagementIdNum = parseInt(engagementId);

    // Total files
    const total = await prisma.uploadedFile.count({
      where: { engagementId: engagementIdNum },
    });

    // Files by status
    const statusCounts = await prisma.uploadedFile.groupBy({
      by: ['status'],
      where: { engagementId: engagementIdNum },
      _count: true,
    });

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((item) => {
      statusMap[item.status] = item._count;
    });

    // Matched invoices
    const matched = await prisma.reconciliationResult.count({
      where: {
        engagement: { id: engagementIdNum },
        matchStatus: 'matched',
      },
    });

    // Get all reconciliation results for exception counting
    const reconciliationResults = await prisma.reconciliationResult.findMany({
      where: { engagementId: engagementIdNum },
    });

    const exceptionMap: Record<string, number> = {};
    reconciliationResults.forEach((result) => {
      if (result.matchStatus !== 'matched') {
        exceptionMap[result.matchStatus] = (exceptionMap[result.matchStatus] || 0) + 1;
      }
    });

    // Total value of invoices
    const totalValueResult = await prisma.extractedInvoice.aggregate({
      where: {
        file: {
          engagementId: engagementIdNum,
        },
      },
      _sum: {
        totalValue: true,
      },
    });

    const totalValue = totalValueResult._sum.totalValue || 0;

    // Matched value
    const matchedValueResult = await prisma.extractedInvoice.aggregate({
      where: {
        file: {
          engagementId: engagementIdNum,
        },
        reconciliationResults: {
          some: {
            matchStatus: 'matched',
          },
        },
      },
      _sum: {
        totalValue: true,
      },
    });

    const totalMatchedValue = matchedValueResult._sum.totalValue || 0;

    // Vendor breakdown
    const vendorBreakdown = await prisma.extractedInvoice.groupBy({
      by: ['vendorName'],
      where: {
        file: {
          engagementId: engagementIdNum,
        },
      },
      _count: true,
      _sum: {
        totalValue: true,
      },
      orderBy: {
        _count: {
          vendorName: 'desc',
        },
      },
      take: 10,
    });

    const matchRate = total > 0 ? Math.round((matched / total) * 100 * 10) / 10 : 0;

    return NextResponse.json({
      total,
      matched,
      not_in_registry: reconciliationResults.length - matched,
      failed: statusMap['failed'] || 0,
      pending: total - matched - (statusMap['failed'] || 0),
      match_rate: matchRate,
      quality_score: Math.round(matchRate),
      total_value: Math.round(totalValue * 100) / 100,
      total_matched_value: Math.round(totalMatchedValue * 100) / 100,
      vendor_breakdown: vendorBreakdown.map((v) => ({
        vendor: v.vendorName || 'Unknown',
        count: v._count,
        total: Math.round((v._sum.totalValue || 0) * 100) / 100,
      })),
      exceptions: exceptionMap,
    });
  } catch (error) {
    console.error('[API] GET /files/summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
