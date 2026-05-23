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

    const { reconcileSingleInvoice } = await import('@/lib/services/reconciliation');

    await prisma.reconciliationResult.deleteMany({ where: { engagementId } });

    const invoices = await prisma.extractedInvoice.findMany({
      where: { file: { engagementId } },
    });

    for (const invoice of invoices) {
      try {
        await reconcileSingleInvoice(invoice.id);
      } catch (err) {
        console.error(`Failed to reconcile invoice ${invoice.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, reconciled: invoices.length });
  } catch (error) {
    console.error('[API] POST /files/reconcile/:id error:', error);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
