import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/files/reconcile/[id]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    const { runFullReconciliation } = await import('@/lib/services/reconciliation');
    await runFullReconciliation(engagementId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] POST /files/reconcile/:id error:', error);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
