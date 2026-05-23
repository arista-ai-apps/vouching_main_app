import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/clients
export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        engagements: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error('[API] GET /clients error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// POST /api/v1/clients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, pan, gstin, address } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name,
        pan: pan || null,
        gstin: gstin || null,
        address: address || null,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('[API] POST /clients error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
