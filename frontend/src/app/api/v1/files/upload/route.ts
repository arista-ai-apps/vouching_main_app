import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadPDF } from '@/lib/cloudinary';
import { extractInvoiceData } from '@/lib/services/extraction';
import { reconcileSingleInvoice } from '@/lib/services/reconciliation';

// POST /api/v1/files/upload
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

    // Verify engagement exists
    const engagement = await prisma.engagement.findUnique({
      where: { id: parseInt(engagementId) },
    });

    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 50MB)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Cloudinary
    console.log(`[API] Uploading ${file.name} to Cloudinary...`);
    const cloudinaryResult = await uploadPDF(buffer, file.name, parseInt(engagementId));

    // Create database record
    const dbFile = await prisma.uploadedFile.create({
      data: {
        engagementId: parseInt(engagementId),
        filename: file.name,
        filePath: cloudinaryResult.secure_url,
        status: 'uploaded',
      },
    });

    // Trigger extraction in the background
    // Note: In production, use Trigger.dev or a similar service
    // For now, we'll do it synchronously
    try {
      console.log(`[API] Starting extraction for file ${dbFile.id}...`);
      await extractInvoiceData(buffer, dbFile.id, parseInt(engagementId));

      // Reconcile after extraction
      const invoice = await prisma.extractedInvoice.findFirst({
        where: { fileId: dbFile.id },
      });

      if (invoice) {
        await reconcileSingleInvoice(invoice.id);
      }

      // Update file status to completed
      await prisma.uploadedFile.update({
        where: { id: dbFile.id },
        data: { status: 'completed' },
      });
    } catch (error) {
      console.error('[API] Background processing error:', error);
      // File was already marked as failed by extraction service
    }

    return NextResponse.json({
      id: dbFile.id,
      filename: dbFile.filename,
      status: dbFile.status,
      created_at: dbFile.createdAt,
    });
  } catch (error) {
    console.error('[API] POST /files/upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
