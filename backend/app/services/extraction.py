import os
import json
import base64
import fitz  # PyMuPDF
from datetime import datetime
from typing import List, Dict, Any
from openai import OpenAI
from ..core.config import settings
from ..models import models
from sqlalchemy.orm import Session

client = OpenAI(api_key=settings.OPENAI_API_KEY)

SYSTEM_PROMPT = """
You are a Senior CA Audit Article. Extract invoice data from the provided OCR text blocks into a structured JSON format.
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
If a field is not found, use null for scalars, and empty array [] for items. Convert rates to flat numeric floats (e.g., 9% -> 9.0).
"""

def get_pdf_ocr_text(file_path: str) -> str:
    """Extracts raw text blocks from a PDF using PyMuPDF."""
    doc = fitz.open(file_path)
    full_text = ""
    for page in doc:
        blocks = page.get_text("blocks")
        # Format blocks into a readable string for the AI
        for b in blocks:
            full_text += f"{b[4]}\n"
    doc.close()
    return full_text

async def extract_invoice_data(file_path: str, db: Session, file_id: int):
    print(f"[EXTRACTION] Starting OCR extraction for file_id: {file_id}, path: {file_path}")
    try:
        # Perform local OCR (Text extraction)
        print(f"[EXTRACTION] Extracting text blocks from PDF...")
        ocr_text = get_pdf_ocr_text(file_path)
        print(f"[EXTRACTION] Text extracted ({len(ocr_text)} chars). Sending to OpenAI...")
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Extract details from this invoice OCR text:\n\n{ocr_text}"
                },
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        print(f"[EXTRACTION] AI raw response: {content}")
        extracted_data = json.loads(content)
        
        # Parse date safely
        inv_date = None
        if extracted_data.get("invoice_date"):
            try:
                # Support YYYY-MM-DD
                date_str = str(extracted_data["invoice_date"]).strip()
                if "T" in date_str:
                    date_str = date_str.split("T")[0]
                inv_date = datetime.strptime(date_str, "%Y-%m-%d")
                print(f"[EXTRACTION] Parsed date: {inv_date}")
            except Exception as de:
                print(f"[EXTRACTION] Date parse error: {de} for input: {extracted_data['invoice_date']}")
                inv_date = None

        hsn = extracted_data.get("hsn_code")
        if hsn is not None:
            hsn_str = str(hsn).strip()
            if hsn_str.lower() in ["null", "none", "", "missing", "0000"]:
                hsn = None
            else:
                hsn = hsn_str

        print(f"[EXTRACTION] Saving extracted data to database...")
        db_invoice = models.ExtractedInvoice(
            file_id=file_id,
            invoice_number=str(extracted_data.get("invoice_number", "")),
            hsn_code=hsn,
            invoice_date=inv_date,
            vendor_name=extracted_data.get("vendor_name"),
            vendor_gstin=extracted_data.get("vendor_gstin"),
            buyer_name=extracted_data.get("buyer_name"),
            buyer_gstin=extracted_data.get("buyer_gstin"),
            shipping_address=extracted_data.get("shipping_address"),
            billing_address=extracted_data.get("billing_address"),
            place_of_supply=extracted_data.get("place_of_supply"),
            description_of_goods=extracted_data.get("description_of_goods"),
            eway_bill_no=extracted_data.get("eway_bill_no"),
            taxable_value=extracted_data.get("taxable_value"),
            discount=extracted_data.get("discount"),
            total_value=extracted_data.get("total_value"),
            cgst_rate=extracted_data.get("cgst_rate"),
            sgst_rate=extracted_data.get("sgst_rate"),
            igst_rate=extracted_data.get("igst_rate"),
            cgst=extracted_data.get("cgst"),
            sgst=extracted_data.get("sgst"),
            igst=extracted_data.get("igst"),
            confidence_score=extracted_data.get("confidence_score", 0.0),
            status="extracted"
        )
        db.add(db_invoice)
        db.flush() # flush to get db_invoice.id for the items

        items_data = extracted_data.get("items", [])
        if isinstance(items_data, list):
            for item in items_data:
                db_item = models.ExtractedInvoiceItem(
                    invoice_id=db_invoice.id,
                    description=item.get("description"),
                    hsn_code=item.get("hsn_code"),
                    quantity=item.get("quantity"),
                    unit=item.get("unit"),
                    unit_price=item.get("unit_price"),
                    discount=item.get("discount"),
                    taxable_value=item.get("taxable_value")
                )
                db.add(db_item)
        
        # Update file status
        db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if db_file:
            db_file.status = "extracted"
        
        db.commit()
        print(f"[EXTRACTION] Database commit successful for file_id: {file_id}")
    except Exception as e:
        print(f"[EXTRACTION] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if db_file:
            db_file.status = "failed"
            db.commit()
            print(f"[EXTRACTION] Set status to 'failed' in database.")
    finally:
        pass


BILL_OF_SALE_PROMPT = """
You are a Senior CA Audit Article. Extract Bill of Sale data from the provided OCR text blocks into a structured JSON format.
The output MUST be a valid JSON object matching this schema:
{
  "sale_number": string,
  "sale_date": string (ISO format YYYY-MM-DD),
  "buyer_name": string,
  "buyer_gstin": string,
  "taxable_value": float,
  "total_value": float,
  "cgst": float,
  "sgst": float,
  "igst": float,
  "confidence_score": float (0.0 to 1.0)
}
If a field is not found, use null.
"""

async def extract_bill_of_sale_data(file_path: str, db: Session, file_id: int):
    print(f"[BOS-EXTRACTION] Starting OCR for file_id: {file_id}, path: {file_path}")
    try:
        ocr_text = get_pdf_ocr_text(file_path)
        print(f"[BOS-EXTRACTION] Text extracted. Sending to OpenAI...")

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": BILL_OF_SALE_PROMPT},
                {
                    "role": "user",
                    "content": f"Extract details from this Bill of Sale OCR text:\n\n{ocr_text}"
                },
            ],
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        print(f"[BOS-EXTRACTION] AI raw response: {content}")
        extracted = json.loads(content)

        sale_date = None
        if extracted.get("sale_date"):
            try:
                date_str = str(extracted["sale_date"]).strip()
                if "T" in date_str:
                    date_str = date_str.split("T")[0]
                sale_date = datetime.strptime(date_str, "%Y-%m-%d")
            except Exception as de:
                print(f"[BOS-EXTRACTION] Date parse error: {de}")

        db_bos = models.ExtractedBillOfSale(
            file_id=file_id,
            sale_number=str(extracted.get("sale_number", "")),
            sale_date=sale_date,
            buyer_name=extracted.get("buyer_name"),
            buyer_gstin=extracted.get("buyer_gstin"),
            taxable_value=extracted.get("taxable_value"),
            total_value=extracted.get("total_value"),
            cgst=extracted.get("cgst"),
            sgst=extracted.get("sgst"),
            igst=extracted.get("igst"),
            confidence_score=extracted.get("confidence_score", 0.0),
            status="extracted"
        )
        db.add(db_bos)

        db_file = db.query(models.BillOfSaleFile).filter(models.BillOfSaleFile.id == file_id).first()
        if db_file:
            db_file.status = "extracted"
        db.commit()
        print(f"[BOS-EXTRACTION] DB commit successful for file_id: {file_id}")
    except Exception as e:
        print(f"[BOS-EXTRACTION] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db_file = db.query(models.BillOfSaleFile).filter(models.BillOfSaleFile.id == file_id).first()
        if db_file:
            db_file.status = "failed"
            db.commit()
    finally:
        pass
