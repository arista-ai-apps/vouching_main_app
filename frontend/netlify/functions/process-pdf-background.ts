import { prisma } from '../../src/lib/prisma';
import { extractInvoiceData } from '../../src/lib/services/extraction';
import { reconcileSingleInvoice } from '../../src/lib/services/reconciliation';

// Robust helper to extract ID from Netlify event path or query parameters
function extractIdFromEvent(event: any): number | null {
  // 1. Try to read from query params
  if (event.queryStringParameters?.fileId) {
    return parseInt(event.queryStringParameters.fileId);
  }
  // 2. Try to match from client request URL path (event.path or custom headers)
  const pathToSearch = event.path || event.headers?.['x-nf-request-uri'] || '';
  console.log(`[NETLIFY-FUNCTION] Parsing fileId from path: "${pathToSearch}"`);
  
  // Matches any digits between /files/ and /process or at the end
  const fileIdMatch = pathToSearch.match(/\/files\/(\d+)\/process/) || pathToSearch.match(/\/(\d+)\/process/) || pathToSearch.match(/\/(\d+)\/?$/);
  if (fileIdMatch) {
    return parseInt(fileIdMatch[1]);
  }
  return null;
}

// Standalone Netlify Function for fire-and-forget async PDF processing.
// Triggered via CDN rewrite from POST /api/v1/files/[id]/process.
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Parse fileId using robust path parsing helper
  const fileId = extractIdFromEvent(event);
  if (!fileId || isNaN(fileId)) {
    console.error(`[NETLIFY-FUNCTION] ERROR: Could not parse fileId. Path: "${event.path}", Headers: ${JSON.stringify(event.headers)}, Query: ${JSON.stringify(event.queryStringParameters)}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing or invalid fileId parameter' }),
    };
  }

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
