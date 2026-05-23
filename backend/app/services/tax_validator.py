from sqlalchemy.orm import Session
from ..models import models
from typing import Optional, Tuple

GST_STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
    "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
    "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
    "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
    "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
    "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
    "99": "Center Jurisdiction"
}

def get_state_code_from_gstin(gstin: Optional[str]) -> Optional[str]:
    if not gstin or len(gstin.strip()) < 2:
        return None
    code = gstin.strip()[:2]
    if code.isdigit() and code in GST_STATE_CODES:
        return code
    return None

def determine_state_from_text(text: Optional[str]) -> Optional[str]:
    """Fallback to find state names in address/place of supply text."""
    if not text:
        return None
    text_upper = text.upper()
    for code, name in GST_STATE_CODES.items():
        if name.upper() in text_upper:
            return code
    return None

def validate_tax_type(invoice: models.ExtractedInvoice, db: Session):
    """
    Validates if the GST tax structure (CGST+SGST vs IGST) matches the transaction type.
    Returns a TaxTypeMismatch database record (not yet committed).
    """
    engagement_id = db.query(models.UploadedFile).filter(models.UploadedFile.id == invoice.file_id).first().engagement_id
    
    # 1. Determine States
    vendor_state = get_state_code_from_gstin(invoice.vendor_gstin)
    buyer_state = get_state_code_from_gstin(invoice.buyer_gstin)
    pos_state = determine_state_from_text(invoice.place_of_supply)
    
    # Use POS state as the primary indicator for supply type if available
    # Place of Supply (POS) usually determines if it is Inter or Intra.
    # If POS state == Supplier state -> Intra (CGST+SGST)
    # If POS state != Supplier state -> Inter (IGST)
    
    # Fallback to Buyer State if POS is missing
    target_state = pos_state if pos_state else buyer_state
    
    determined_supply_type = "UNKNOWN"
    expected_tax_type = "UNKNOWN"
    status = "NEEDS_REVIEW"
    reason = ""
    suggestion = ""
    is_mismatch = 0
    
    if not vendor_state or not target_state:
        status = "NEEDS_REVIEW"
        missing = []
        if not vendor_state: missing.append("Supplier State (from GSTIN)")
        if not target_state: missing.append("Buyer State / Place of Supply")
        reason = f"Insufficient data to determine supply type. Missing: {', '.join(missing)}."
    elif vendor_state == target_state:
        determined_supply_type = "INTRA_STATE"
        expected_tax_type = "CGST+SGST"
    else:
        determined_supply_type = "INTER_STATE"
        expected_tax_type = "IGST"

    # 2. Identify Actual Tax types
    has_cgst_sgst = (invoice.cgst and invoice.cgst > 0) or (invoice.sgst and invoice.sgst > 0)
    has_igst = (invoice.igst and invoice.igst > 0)
    
    actual_tax_type = "NONE"
    if has_cgst_sgst and has_igst:
        actual_tax_type = "BOTH"
    elif has_cgst_sgst:
        actual_tax_type = "CGST+SGST"
    elif has_igst:
        actual_tax_type = "IGST"
        
    # 3. Validation Logic
    if expected_tax_type != "UNKNOWN":
        if actual_tax_type == "BOTH":
            is_mismatch = 1
            status = "MISMATCH"
            reason = f"Both CGST/SGST and IGST are charged, which is invalid for a single supply structure."
            suggestion = f"Verify the correct tax structure. For {determined_supply_type.replace('_', '-').lower()} supply, use {expected_tax_type}."
        elif actual_tax_type == "NONE":
            # Might be exempt or non-GST, but usually flagged for review if amounts exist
            if invoice.taxable_value and invoice.taxable_value > 0:
                is_mismatch = 1
                status = "MISMATCH"
                reason = f"No GST amounts found for a taxable value of ₹{invoice.taxable_value:,.2f}."
                suggestion = f"Ensure the invoice is non-taxable or fix missing tax extraction."
            else:
                status = "CLEARED"
        elif expected_tax_type == "CGST+SGST" and actual_tax_type == "IGST":
            is_mismatch = 1
            status = "MISMATCH"
            reason = f"IGST was charged for an intra-state supply (Supplier: {GST_STATE_CODES[vendor_state]}, POS: {GST_STATE_CODES[target_state]})."
            suggestion = f"Replace IGST with CGST + SGST/UTGST."
        elif expected_tax_type == "IGST" and actual_tax_type == "CGST+SGST":
            is_mismatch = 1
            status = "MISMATCH"
            reason = f"CGST+SGST was charged for an inter-state supply (Supplier: {GST_STATE_CODES[vendor_state]}, POS: {GST_STATE_CODES[target_state]})."
            suggestion = f"Replace CGST + SGST/UTGST with IGST."
        else:
            status = "CLEARED"
            is_mismatch = 0
            
    # Check for GSTIN mismatch with POS state code (only if not already a mismatch)
    if vendor_state and invoice.vendor_gstin and not invoice.vendor_gstin.strip().startswith(vendor_state):
         if status != "MISMATCH":
             status = "NEEDS_REVIEW"
         reason += " | Supplier GSTIN state code conflicts with address/POS."

    # Upsert logic - check if record already exists
    existing = db.query(models.TaxTypeMismatch).filter(models.TaxTypeMismatch.invoice_id == invoice.id).first()
    
    if existing:
        existing.is_mismatch = is_mismatch
        existing.determined_supply_type = determined_supply_type
        existing.expected_tax_type = expected_tax_type
        existing.actual_tax_type = actual_tax_type
        existing.reason = reason
        existing.suggestion = suggestion
        existing.status = status
        return existing
    else:
        new_mismatch = models.TaxTypeMismatch(
            invoice_id=invoice.id,
            engagement_id=engagement_id,
            is_mismatch=is_mismatch,
            determined_supply_type=determined_supply_type,
            expected_tax_type=expected_tax_type,
            actual_tax_type=actual_tax_type,
            reason=reason,
            suggestion=suggestion,
            status=status
        )
        db.add(new_mismatch)
        return new_mismatch
