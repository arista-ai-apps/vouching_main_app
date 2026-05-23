import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/registers/gstr2b/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);
    const registers = await prisma.register.findMany({
      where: { engagementId, registerType: 'gstr2b' },
      orderBy: { id: 'desc' },
    });
    return NextResponse.json(registers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch GSTR-2B register' }, { status: 500 });
  }
}
