import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/registers/[id]  — Get purchase register for engagement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);
    const registers = await prisma.register.findMany({
      where: { engagementId, registerType: 'purchase' },
      orderBy: { id: 'desc' },
    });
    return NextResponse.json(registers);
  } catch (error) {
    console.error('[REGISTERS] GET purchase error:', error);
    return NextResponse.json({ error: 'Failed to fetch register' }, { status: 500 });
  }
}

// DELETE /api/v1/registers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.register.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
