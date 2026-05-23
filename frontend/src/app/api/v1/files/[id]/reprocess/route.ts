import { NextRequest, NextResponse } from 'next/server';

// POST /api/v1/files/[id]/reprocess
// PDFs are no longer stored — reprocessing requires re-uploading the file.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Reprocessing is not available. Please re-upload the original PDF file.' },
    { status: 410 }
  );
}
