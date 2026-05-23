import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/files/[id]  — list all vouchers for an engagement (id = engagementId)
// DELETE /api/v1/files/[id] — delete a single uploaded file (id = fileId)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagementId = parseInt(id);

    const results = await prisma.uploadedFile.findMany({
      where: { engagementId },
      include: {
        invoices: { include: { items: true, reconciliationResults: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    interface Voucher {
      id: number;
      filename: string;
      status: string;
      invoice_number: string | null;
      hsn_code: string | null;
      invoice_date: Date | null;
      vendor_name: string | null;
      vendor_gstin: string | null;
      buyer_name: string | null;
      buyer_gstin: string | null;
      shipping_address: string | null;
      billing_address: string | null;
      place_of_supply: string | null;
      eway_bill_no: string | null;
      description_of_goods: string | null;
      taxable_value: number | null;
      discount: number | null;
      total_value: number | null;
      cgst: number | null;
      sgst: number | null;
      igst: number | null;
      cgst_rate: number | null;
      sgst_rate: number | null;
      igst_rate: number | null;
      confidence_score: number | null;
      match_status: string | null;
    }

    const vouchers = results.flatMap((file): Voucher[] => {
      if (file.invoices.length === 0) {
        return [{
          id: file.id, filename: file.filename, status: file.status,
          invoice_number: null, hsn_code: null, invoice_date: null,
          vendor_name: null, vendor_gstin: null, buyer_name: null,
          buyer_gstin: null, shipping_address: null, billing_address: null,
          place_of_supply: null, eway_bill_no: null, description_of_goods: null,
          taxable_value: null, discount: null, total_value: null,
          cgst: null, sgst: null, igst: null, cgst_rate: null,
          sgst_rate: null, igst_rate: null, confidence_score: null, match_status: null,
        }];
      }
      return file.invoices.map((invoice) => ({
        id: file.id, filename: file.filename, status: file.status,
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
        cgst: invoice.cgst, sgst: invoice.sgst, igst: invoice.igst,
        cgst_rate: invoice.cgstRate, sgst_rate: invoice.sgstRate, igst_rate: invoice.igstRate,
        confidence_score: invoice.confidenceScore,
        match_status: invoice.reconciliationResults[0]?.matchStatus ?? null,
      }));
    });

    return NextResponse.json(vouchers);
  } catch (error) {
    console.error('[API] GET /files/:id error:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id);
    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    await prisma.uploadedFile.delete({ where: { id: fileId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /files/:id error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
