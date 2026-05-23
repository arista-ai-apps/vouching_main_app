import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/engagements/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const engagementId = parseInt(params.id);

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
        files: true,
        registers: true,
      },
    });

    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(engagement);
  } catch (error) {
    console.error('[API] GET /engagements/:id error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/engagements/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const engagementId = parseInt(params.id);
    const body = await request.json();
    const { period_start, period_end, status } = body;

    const engagement = await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        periodStart: period_start ? new Date(period_start) : undefined,
        periodEnd: period_end ? new Date(period_end) : undefined,
        status: status || undefined,
      },
      include: {
        client: true,
      },
    });

    return NextResponse.json(engagement);
  } catch (error) {
    console.error('[API] PUT /engagements/:id error:', error);
    return NextResponse.json(
      { error: 'Failed to update engagement' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/engagements/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const engagementId = parseInt(params.id);

    await prisma.engagement.delete({
      where: { id: engagementId },
    });

    return NextResponse.json({ message: 'Engagement deleted successfully' });
  } catch (error) {
    console.error('[API] DELETE /engagements/:id error:', error);
    return NextResponse.json(
      { error: 'Failed to delete engagement' },
      { status: 500 }
    );
  }
}
