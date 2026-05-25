import { NextRequest, NextResponse } from 'next/server';
import { extractInvoiceData } from '@/lib/services/extraction';

export async function POST(request: NextRequest) {
  try {
    const { buffer_b64 } = await request.json();
    const buffer = Buffer.from(buffer_b64, 'base64');
    
    console.log('[TEST] Starting extraction...');
    const result = await extractInvoiceData(buffer, 999, 12);
    
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[TEST] Error:', error);
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}
