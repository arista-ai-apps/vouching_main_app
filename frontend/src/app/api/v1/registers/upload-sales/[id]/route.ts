import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRegisterFile, mapRowToRegisterRow } from '@/lib/register-parser';

// POST /api/v1/registers/upload-sales/[id]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const engagement = await prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

    const rawRows = await parseRegisterFile(file);
    console.log(`[REGISTERS] Sales: parsed ${rawRows.length} rows from ${file.name}`);

    await prisma.register.deleteMany({ where: { engagementId, registerType: 'sales' } });
    const register = await prisma.register.create({
      data: {
        engagementId,
        registerType: 'sales',
        filename: file.name,
        rows: { create: rawRows.map(mapRowToRegisterRow) },
      },
      include: { _count: { select: { rows: true } } },
    });

    return NextResponse.json({ id: register.id, type: 'sales', rows: register._count.rows }, { status: 201 });
  } catch (error) {
    console.error('[REGISTERS] Sales upload error:', error);
    return NextResponse.json({ error: 'Failed to upload sales register' }, { status: 500 });
  }
}
