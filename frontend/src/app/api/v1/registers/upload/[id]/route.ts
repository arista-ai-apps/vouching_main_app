import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRegisterFile, mapRowToRegisterRow } from '@/lib/register-parser';

// POST /api/v1/registers/upload/[id]  — Upload Purchase Register
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
    console.log(`[REGISTERS] Purchase: parsed ${rawRows.length} rows from ${file.name}`);

    await prisma.register.deleteMany({ where: { engagementId, registerType: 'purchase' } });
    const register = await prisma.register.create({
      data: {
        engagementId,
        registerType: 'purchase',
        filename: file.name,
        rows: { create: rawRows.map(mapRowToRegisterRow) },
      },
      include: { _count: { select: { rows: true } } },
    });

    return NextResponse.json({ id: register.id, type: 'purchase', rows: register._count.rows }, { status: 201 });
  } catch (error) {
    console.error('[REGISTERS] Purchase upload error:', error);
    return NextResponse.json({ error: 'Failed to upload register' }, { status: 500 });
  }
}
