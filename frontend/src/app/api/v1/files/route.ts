import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/files?engagement_id=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const engagementId = searchParams.get('engagement_id');

    if (!engagementId) {
      return NextResponse.json(
        { error: 'engagement_id is required' },
        { status: 400 }
      );
    }

    const results = await prisma.uploadedFile.findMany({
      where: { engagementId: parseInt(engagementId) },
      include: {
        invoices: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const vouchers = results.flatMap((file) =>
      file.invoices.map((invoice) => ({
        id: file.id,
        filename: file.filename,
        status: file.status,
        invoice_number: invoice.invoiceNumber,
        hsn_code: invoice.hsnCode,
        invoice_date: invoice.invoiceDate,
        vendor_name: invoice.vendorName,
        vendor_gstin: invoice.vendorGstin,
        buyer_name: invoice.buyerName,
        buyer_gstin: invoice.buyerGstin,
        shipping_address: invoice.shippingAddress,
        billing_address: invoice.billingAddress,
        place_of_supply: invoice.placeOfSupply,
        eway_bill_no: invoice.ewayBillNo,
        description_of_goods: invoice.descriptionOfGoods,
        taxable_value: invoice.taxableValue,
        discount: invoice.discount,
        total_value: invoice.totalValue,
        cgst: invoice.cgst,
        sgst: invoice.sgst,
        igst: invoice.igst,
        cgst_rate: invoice.cgstRate,
        sgst_rate: invoice.sgstRate,
        igst_rate: invoice.igstRate,
        confidence_score: invoice.confidenceScore,
      }))
    );

    return NextResponse.json(vouchers);
  } catch (error) {
    console.error('[API] GET /files error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
