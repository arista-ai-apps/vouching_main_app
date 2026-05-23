import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractInvoiceData } from '@/lib/services/extraction';
import { reconcileSingleInvoice } from '@/lib/services/reconciliation';

// POST /api/v1/files/[id]/process
// Called internally (fire-and-forget) by the upload route.
// Receives the PDF buffer as base64, runs extraction + reconciliation, updates status.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);

  try {
    const body = await request.json();
    const { engagement_id, buffer_b64 } = body;

    if (!buffer_b64) {
      await prisma.uploadedFile.update({ where: { id: fileId }, data: { status: 'failed' } }).catch(() => {});
      return NextResponse.json({ error: 'No buffer provided' }, { status: 400 });
    }

    const buffer = Buffer.from(buffer_b64, 'base64');
    console.log(`[PROCESS] Extracting file ${fileId} (${(buffer.length / 1024).toFixed(0)}KB)...`);

    await extractInvoiceData(buffer, fileId, parseInt(engagement_id));

    const invoice = await prisma.extractedInvoice.findFirst({ where: { fileId } });
    if (invoice) {
      console.log(`[PROCESS] Reconciling invoice ${invoice.id}...`);
      await reconcileSingleInvoice(invoice.id);
    }

    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'completed' },
    });

    console.log(`[PROCESS] File ${fileId} complete.`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(`[PROCESS] Failed for file ${fileId}:`, error);
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'failed' },
    }).catch(() => {});
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
