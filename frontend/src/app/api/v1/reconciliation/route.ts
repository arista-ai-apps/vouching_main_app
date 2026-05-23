import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runFullReconciliation } from '@/lib/services/reconciliation';

// POST /api/v1/reconciliation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { engagement_id } = body;

    if (!engagement_id) {
      return NextResponse.json(
        { error: 'engagement_id is required' },
        { status: 400 }
      );
    }

    // Verify engagement exists
    const engagement = await prisma.engagement.findUnique({
      where: { id: parseInt(engagement_id) },
    });

    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    // Run reconciliation
    await runFullReconciliation(parseInt(engagement_id));

    // Get results
    const results = await prisma.reconciliationResult.findMany({
      where: { engagementId: parseInt(engagement_id) },
    });

    return NextResponse.json({
      status: 'success',
      message: 'Reconciliation completed',
      total_processed: results.length,
      matched_count: results.filter((r) => r.matchStatus === 'matched').length,
    });
  } catch (error) {
    console.error('[API] POST /reconciliation error:', error);
    return NextResponse.json(
      { error: 'Failed to run reconciliation' },
      { status: 500 }
    );
  }
}

// GET /api/v1/reconciliation
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

    const results = await prisma.reconciliationResult.findMany({
      where: { engagementId: parseInt(engagementId) },
      include: {
        invoice: true,
        registerRow: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('[API] GET /reconciliation error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation results' },
      { status: 500 }
    );
  }
}
