import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/v1/registers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { engagement_id, register_type, filename, rows } = body;

    if (!engagement_id || !register_type) {
      return NextResponse.json(
        { error: 'engagement_id and register_type are required' },
        { status: 400 }
      );
    }

    // Verify engagement exists
    const engagement = await prisma.engagement.findUnique({
      where: { id: parseInt(engagement_id) },
    });

    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    // Create register
    const register = await prisma.register.create({
      data: {
        engagementId: parseInt(engagement_id),
        registerType: register_type,
        filename: filename || `${register_type}_register`,
        rows: {
          create: rows || [],
        },
      },
      include: {
        rows: true,
      },
    });

    return NextResponse.json(register, { status: 201 });
  } catch (error) {
    console.error('[API] POST /registers error:', error);
    return NextResponse.json(
      { error: 'Failed to create register' },
      { status: 500 }
    );
  }
}

// GET /api/v1/registers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const engagementId = searchParams.get('engagement_id');
    const registerType = searchParams.get('register_type');

    const where: any = {};
    if (engagementId) {
      where.engagementId = parseInt(engagementId);
    }
    if (registerType) {
      where.registerType = registerType;
    }

    const registers = await prisma.register.findMany({
      where,
      include: {
        rows: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    return NextResponse.json(registers);
  } catch (error) {
    console.error('[API] GET /registers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registers' },
      { status: 500 }
    );
  }
}
