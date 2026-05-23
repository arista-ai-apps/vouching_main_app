import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/files/upload
// 1. Reads the PDF buffer
// 2. Creates a DB record with status 'processing'
// 3. Fire-and-forgets extraction via /api/v1/files/[id]/process (passes buffer as base64)
// 4. Returns immediately — client polls for status updates
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const engagementId = formData.get('engagement_id') as string;

    if (!file || !engagementId) {
      return NextResponse.json(
        { error: 'file and engagement_id are required' },
        { status: 400 }
      );
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: parseInt(engagementId) },
    });
    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    // Read buffer now — must happen before responding
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create DB record — filePath is empty since we no longer store PDFs
    const dbFile = await prisma.uploadedFile.create({
      data: {
        engagementId: parseInt(engagementId),
        filename: file.name,
        filePath: '',
        status: 'processing',
      },
    });

    // Fire-and-forget: pass buffer as base64 to the process route.
    // We do NOT await this — response goes back to the client immediately.
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/v1/files/${dbFile.id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engagement_id: parseInt(engagementId),
        buffer_b64: buffer.toString('base64'),
      }),
    }).catch(err =>
      console.error(`[UPLOAD] Failed to trigger processing for file ${dbFile.id}:`, err)
    );

    console.log(`[UPLOAD] File ${dbFile.id} (${file.name}) queued — responding immediately.`);

    return NextResponse.json({
      id: dbFile.id,
      filename: dbFile.filename,
      status: 'processing',
      created_at: dbFile.createdAt,
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
