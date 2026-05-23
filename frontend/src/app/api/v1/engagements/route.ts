import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/engagements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    const where: any = {};
    if (clientId) {
      where.clientId = parseInt(clientId);
    }

    const engagements = await prisma.engagement.findMany({
      where,
      include: {
        client: true,
        files: true,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });

    return NextResponse.json(engagements);
  } catch (error) {
    console.error('[API] GET /engagements error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagements' },
      { status: 500 }
    );
  }
}

// POST /api/v1/engagements
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, period_start, period_end, status } = body;

    if (!client_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'client_id, period_start, and period_end are required' },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: parseInt(client_id) },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const engagement = await prisma.engagement.create({
      data: {
        clientId: parseInt(client_id),
        periodStart: new Date(period_start),
        periodEnd: new Date(period_end),
        status: status || 'active',
      },
      include: {
        client: true,
      },
    });

    return NextResponse.json(engagement, { status: 201 });
  } catch (error) {
    console.error('[API] POST /engagements error:', error);
    return NextResponse.json(
      { error: 'Failed to create engagement' },
      { status: 500 }
    );
  }
}
