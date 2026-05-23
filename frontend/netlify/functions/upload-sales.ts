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

// Standalone Netlify Function for Sales Excel upload
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const engagementIdStr = event.queryStringParameters?.engagementId;
  if (!engagementIdStr) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing engagementId' }),
    };
  }
  const engagementId = parseInt(engagementIdStr);

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
    console.log(`[NETLIFY-FUNCTION] Sales upload: parsed ${rawRows.length} rows`);

    await prisma.register.deleteMany({ where: { engagementId, registerType: 'sales' } });
    const register = await prisma.register.create({
      data: {
        engagementId,
        registerType: 'sales',
        filename: file.filename,
        rows: { create: rawRows.map(mapRowToRegisterRow) },
      },
      include: { _count: { select: { rows: true } } },
    });

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: register.id, type: 'sales', rows: register._count.rows }),
    };

  } catch (error: any) {
    console.error('[NETLIFY-FUNCTION] Sales upload error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to upload sales register', details: error.message }),
    };
  }
}
