import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractInvoiceData } from '@/lib/services/extraction';
import { reconcileSingleInvoice } from '@/lib/services/reconciliation';

// POST /api/v1/files/[id]/reprocess
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);

    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    await prisma.uploadedFile.update({ where: { id: fileId }, data: { status: 'uploaded' } });

    const oldInvoices = await prisma.extractedInvoice.findMany({ where: { fileId } });
    for (const inv of oldInvoices) {
      await prisma.reconciliationResult.deleteMany({ where: { invoiceId: inv.id } });
    }
    await prisma.extractedInvoice.deleteMany({ where: { fileId } });

    const pdfResp = await fetch(file.filePath);
    if (!pdfResp.ok) throw new Error('Failed to fetch PDF from storage');
    const buffer = Buffer.from(await pdfResp.arrayBuffer());

    await extractInvoiceData(buffer, fileId, file.engagementId);

    const invoice = await prisma.extractedInvoice.findFirst({ where: { fileId } });
    if (invoice) await reconcileSingleInvoice(invoice.id);

    await prisma.uploadedFile.update({ where: { id: fileId }, data: { status: 'completed' } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] POST /files/:id/reprocess error:', error);
    return NextResponse.json({ error: 'Reprocess failed' }, { status: 500 });
  }
}
