import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import { OpenAI } from 'openai';
import { prisma } from '../prisma';

// Node.js server: disable web worker (pdfjs runs inline)
pdfjs.GlobalWorkerOptions.workerSrc = '';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a Senior CA Audit Article. Extract invoice data from the provided OCR text blocks into a structured JSON format.
The OCR text was extracted in 'blocks' format, so some table columns may be grouped. Use your expertise to identify the correct values.
The output MUST be a valid JSON object matching this schema:
{
  "invoice_number": string,
  "hsn_code": string (Primary HSN/SAC code if single item. If multiple, provide as comma-separated.),
  "invoice_date": string (ISO format YYYY-MM-DD),
  "vendor_name": string (Supplier),
  "vendor_gstin": string (Supplier GSTIN),
  "buyer_name": string,
  "buyer_gstin": string,
  "shipping_address": string,
  "billing_address": string,
  "place_of_supply": string,
  "description_of_goods": string (A short, unified summary description of products billed),
  "eway_bill_no": string,
  "taxable_value": float (Overall invoice taxable value),
  "discount": float (Overall invoice discount),
  "total_value": float (Grand total),
  "cgst_rate": float (numeric percentage rate, e.g. 9.0),
  "sgst_rate": float (numeric percentage rate),
  "igst_rate": float (numeric percentage rate),
  "cgst": float (amount),
  "sgst": float (amount),
  "igst": float (amount),
  "items": [
    {
      "description": string,
      "hsn_code": string,
      "quantity": float,
      "unit": string (Unit of Measurement, e.g., Nos, Kgs),
      "unit_price": float,
      "discount": float,
      "taxable_value": float
    }
  ],
  "confidence_score": float (0.0 to 1.0)
}
If a field is not found, use null for scalars, and empty array [] for items. Convert rates to flat numeric floats (e.g., 9% -> 9.0).`;

async function getPdfOcrText(fileBuffer: Buffer): Promise<string> {
  try {
    const data = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
    const pdf = await pdfjs.getDocument({ data }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        if ('str' in item) {
          fullText += item.str + ' ';
        }
      }
      fullText += '\n';
    }

    return fullText;
  } catch (error) {
    console.error('[EXTRACTION] PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

export interface ExtractedInvoiceData {
  invoice_number: string | null;
  hsn_code: string | null;
  invoice_date: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  buyer_name: string | null;
  buyer_gstin: string | null;
  shipping_address: string | null;
  billing_address: string | null;
  place_of_supply: string | null;
  description_of_goods: string | null;
  eway_bill_no: string | null;
  taxable_value: number | null;
  discount: number | null;
  total_value: number | null;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  confidence_score: number | null;
  items: Array<{
    description: string | null;
    hsn_code: string | null;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    discount: number | null;
    taxable_value: number | null;
  }>;
}

export async function extractInvoiceData(
  fileBuffer: Buffer,
  fileId: number,
  engagementId: number
): Promise<ExtractedInvoiceData> {
  console.log(`[EXTRACTION] Starting OCR extraction for file_id: ${fileId}`);

  try {
    // Update file status to processing
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'processing' },
    });

    // Extract text from PDF
    console.log('[EXTRACTION] Extracting text from PDF...');
    const ocrText = await getPdfOcrText(fileBuffer);
    console.log(`[EXTRACTION] Text extracted (${ocrText.length} chars). Sending to OpenAI...`);

    // Call OpenAI to extract invoice data
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract details from this invoice OCR text:\n\n${ocrText}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[EXTRACTION] AI raw response:', content.substring(0, 200));
    const extractedData = JSON.parse(content) as ExtractedInvoiceData;

    // Parse date safely
    let invDate: Date | null = null;
    if (extractedData.invoice_date) {
      try {
        const dateStr = String(extractedData.invoice_date).trim();
        const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        invDate = new Date(dateOnly);
        if (isNaN(invDate.getTime())) {
          invDate = null;
        }
      } catch (e) {
        console.warn('[EXTRACTION] Date parsing failed:', e);
        invDate = null;
      }
    }

    // Create ExtractedInvoice record
    const invoice = await prisma.extractedInvoice.create({
      data: {
        fileId,
        invoiceNumber: extractedData.invoice_number,
        hsnCode: extractedData.hsn_code,
        invoiceDate: invDate,
        vendorName: extractedData.vendor_name,
        vendorGstin: extractedData.vendor_gstin,
        buyerName: extractedData.buyer_name,
        buyerGstin: extractedData.buyer_gstin,
        shippingAddress: extractedData.shipping_address,
        billingAddress: extractedData.billing_address,
        placeOfSupply: extractedData.place_of_supply,
        descriptionOfGoods: extractedData.description_of_goods,
        ewayBillNo: extractedData.eway_bill_no,
        taxableValue: extractedData.taxable_value,
        discount: extractedData.discount,
        totalValue: extractedData.total_value,
        cgst: extractedData.cgst,
        sgst: extractedData.sgst,
        igst: extractedData.igst,
        cgstRate: extractedData.cgst_rate,
        sgstRate: extractedData.sgst_rate,
        igstRate: extractedData.igst_rate,
        confidenceScore: extractedData.confidence_score,
        status: 'extracted',
        items: {
          create: extractedData.items?.map((item) => ({
            description: item.description,
            hsnCode: item.hsn_code,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unit_price,
            discount: item.discount,
            taxableValue: item.taxable_value,
          })) || [],
        },
      },
      include: { items: true },
    });

    // Update file status to extracted
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'extracted' },
    });

    console.log(`[EXTRACTION] Invoice extraction complete: ${invoice.invoiceNumber}`);
    return extractedData;
  } catch (error) {
    console.error('[EXTRACTION] Error:', error);

    // Update file status to failed
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'failed' },
    });

    throw error;
  }
}
