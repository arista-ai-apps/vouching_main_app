import { prisma } from '../../src/lib/prisma';
import { extractInvoiceData } from '../../src/lib/services/extraction';
import { reconcileSingleInvoice } from '../../src/lib/services/reconciliation';

// Standalone Netlify Function for fire-and-forget async PDF processing.
// Triggered via CDN rewrite from POST /api/v1/files/[id]/process.
export async function handler(event: any) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Parse fileId from query parameters passed by CDN rewrite
  const fileIdStr = event.queryStringParameters?.fileId;
  if (!fileIdStr) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing fileId parameter' }),
    };
  }
  const fileId = parseInt(fileIdStr);

  try {
    const body = JSON.parse(event.body || '{}');
    const { engagement_id, buffer_b64 } = body;

    if (!buffer_b64) {
      await prisma.uploadedFile.update({ where: { id: fileId }, data: { status: 'failed' } }).catch(() => {});
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No buffer provided' }),
      };
    }

    const buffer = Buffer.from(buffer_b64, 'base64');
    console.log(`[NETLIFY-FUNCTION] Extracting file ${fileId} (${(buffer.length / 1024).toFixed(0)}KB)...`);

    await extractInvoiceData(buffer, fileId, parseInt(engagement_id));

    const invoice = await prisma.extractedInvoice.findFirst({ where: { fileId } });
    if (invoice) {
      console.log(`[NETLIFY-FUNCTION] Reconciling invoice ${invoice.id}...`);
      await reconcileSingleInvoice(invoice.id);
    }

    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'completed' },
    });

    console.log(`[NETLIFY-FUNCTION] File ${fileId} complete.`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };

  } catch (error: any) {
    console.error(`[NETLIFY-FUNCTION] Failed for file ${fileId}:`, error);
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'failed' },
    }).catch(() => {});

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Processing failed', details: error.message }),
    };
  }
}
