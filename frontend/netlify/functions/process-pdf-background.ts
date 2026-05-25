import { prisma } from '../../src/lib/prisma';
import { extractInvoiceDataFromText } from '../../src/lib/services/extraction';
import { runFullReconciliation } from '../../src/lib/services/reconciliation';

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
    const { engagement_id, ocr_text } = body;

    if (!ocr_text) {
      await prisma.uploadedFile.update({ where: { id: fileId }, data: { status: 'failed' } }).catch(() => {});
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No ocr_text provided — browser must extract PDF text before calling this function' }),
      };
    }

    console.log(`[NETLIFY-FUNCTION] Processing file ${fileId} — received ${ocr_text.length} chars of OCR text from browser...`);

    await extractInvoiceDataFromText(ocr_text, fileId, parseInt(engagement_id));

    // Bulk-reconcile all invoices in the engagement (4 queries, in-memory matching)
    console.log(`[NETLIFY-FUNCTION] Running bulk reconciliation for engagement ${engagement_id}...`);
    await runFullReconciliation(parseInt(engagement_id));

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
