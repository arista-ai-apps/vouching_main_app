import Busboy from 'busboy';
import { prisma } from '../../src/lib/prisma';
import { parseRegisterFile, mapRowToRegisterRow } from '../../src/lib/register-parser';

// Helper to parse multipart/form-data from Netlify event
function parseMultipartForm(event: any): Promise<{ file?: { filename: string; buffer: Buffer } }> {
  return new Promise((resolve, reject) => {
    const result: { file?: { filename: string; buffer: Buffer } } = {};
    const headers = Object.keys(event.headers).reduce((acc, key) => {
      acc[key.toLowerCase()] = event.headers[key];
      return acc;
    }, {} as Record<string, string>);

    const contentType = headers['content-type'] || '';
    const busboy = Busboy({ headers: { 'content-type': contentType } });

    busboy.on('file', (fieldname, file, info) => {
      const { filename } = info;
      const chunks: Buffer[] = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        result.file = {
          filename,
          buffer: Buffer.concat(chunks),
        };
      });
    });

    busboy.on('finish', () => resolve(result));
    busboy.on('error', (err) => reject(err));

    const encoding = event.isBase64Encoded ? 'base64' : 'binary';
    busboy.write(Buffer.from(event.body, encoding));
    busboy.end();
  });
}

// Robust helper to extract engagementId from Netlify event path or query parameters
function extractEngagementIdFromEvent(event: any): number | null {
  if (event.queryStringParameters?.engagementId) {
    return parseInt(event.queryStringParameters.engagementId);
  }
  const pathToSearch = event.path || event.headers?.['x-nf-request-uri'] || '';
  console.log(`[NETLIFY-FUNCTION] Parsing engagementId from path: "${pathToSearch}"`);
  
  const match = pathToSearch.match(/\/upload-gstr2b\/(\d+)/) || pathToSearch.match(/\/(\d+)\/?$/);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

// Standalone Netlify Function for GSTR-2B Excel upload
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const engagementId = extractEngagementIdFromEvent(event);
  if (!engagementId || isNaN(engagementId)) {
    console.error(`[NETLIFY-FUNCTION] ERROR: Could not parse engagementId. Path: "${event.path}", Headers: ${JSON.stringify(event.headers)}, Query: ${JSON.stringify(event.queryStringParameters)}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing or invalid engagementId' }),
    };
  }

  try {
    const { file } = await parseMultipartForm(event);
    if (!file) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file provided' }),
      };
    }

    const engagement = await prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Engagement not found' }),
      };
    }

    // Call our universal parser
    const rawRows = await parseRegisterFile({ name: file.filename, buffer: file.buffer });
    console.log(`[NETLIFY-FUNCTION] GSTR-2B upload: parsed ${rawRows.length} rows`);

    await prisma.register.deleteMany({ where: { engagementId, registerType: 'gstr2b' } });
    const register = await prisma.register.create({
      data: {
        engagementId,
        registerType: 'gstr2b',
        filename: file.filename,
        rows: { create: rawRows.map(mapRowToRegisterRow) },
      },
      include: { _count: { select: { rows: true } } },
    });

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: register.id, type: 'gstr2b', rows: register._count.rows }),
    };

  } catch (error: any) {
    console.error('[NETLIFY-FUNCTION] GSTR-2B upload error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to upload GSTR-2B register', details: error.message }),
    };
  }
}
