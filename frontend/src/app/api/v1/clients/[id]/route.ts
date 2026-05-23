import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/clients/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = parseInt(params.id);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        engagements: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('[API] GET /clients/:id error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/clients/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = parseInt(params.id);
    const body = await request.json();
    const { name, pan, gstin, address } = body;

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        name: name || undefined,
        pan: pan !== undefined ? pan : undefined,
        gstin: gstin !== undefined ? gstin : undefined,
        address: address !== undefined ? address : undefined,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error('[API] PUT /clients/:id error:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/clients/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = parseInt(params.id);

    await prisma.client.delete({
      where: { id: clientId },
    });

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('[API] DELETE /clients/:id error:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    );
  }
}
