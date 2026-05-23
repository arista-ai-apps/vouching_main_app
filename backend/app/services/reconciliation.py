from sqlalchemy.orm import Session
from ..models import models
from typing import List


def _levenshtein(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if s1 == s2:
        return 0
    if not s1:
        return len(s2)
    if not s2:
        return len(s1)
    m, n = len(s1), len(s2)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            temp = dp[j]
            if s1[i - 1] == s2[j - 1]:
                dp[j] = prev
            else:
                dp[j] = 1 + min(prev, dp[j], dp[j - 1])
            prev = temp
    return dp[n]


def _gstin_match(inv_gstin: str, reg_gstin: str):
    """
    Returns (is_match, match_quality).
    Allows up to 2 character differences to handle OCR transcription errors.
    """
    inv = (inv_gstin or "").strip().upper()
    reg = (reg_gstin or "").strip().upper()

    if not inv or not reg:
        return False, "missing"
    if inv == reg:
        return True, "exact"
    dist = _levenshtein(inv, reg)
    if dist <= 2:
        return True, "fuzzy"
    return False, "mismatch"


def run_reconciliation(engagement_id: int, db: Session):
    # Get all extracted invoices for this engagement
    invoices = db.query(models.ExtractedInvoice)\
        .join(models.UploadedFile)\
        .filter(models.UploadedFile.engagement_id == engagement_id)\
        .all()

    # Get all purchase register rows
    pr_register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id, 
        models.Register.register_type == "purchase"
    ).first()
    pr_rows = []
    if pr_register:
        pr_rows = db.query(models.RegisterRow).filter(models.RegisterRow.register_id == pr_register.id).all()

    # Get GSTR-2B registry rows
    gstr_register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "gstr2b"
    ).first()
    gstr_rows = []
    if gstr_register:
        gstr_rows = db.query(models.RegisterRow).filter(models.RegisterRow.register_id == gstr_register.id).all()

    # Delete all previous invoice reconciliation results for this engagement
    db.query(models.ReconciliationResult).filter(
        models.ReconciliationResult.engagement_id == engagement_id,
        models.ReconciliationResult.invoice_id.isnot(None)
    ).delete()

    for invoice in invoices:
        # Check existence in PR
        pr_found = False
        pr_matched_row = None
        pr_score = 0.0
        for row in pr_rows:
            inv_no_match = str(invoice.invoice_number or "").strip().lower() == str(row.invoice_number or "").strip().lower()
            gstin_ok, gstin_quality = _gstin_match(invoice.vendor_gstin, row.vendor_gstin)
            if inv_no_match and gstin_ok:
                pr_found = True
                pr_matched_row = row
                if abs(float(invoice.total_value or 0) - float(row.total_value or 0)) < 0.01:
                    pr_score = 1.0
                else:
                    pr_score = 0.5
                break

        # Check existence in GSTR-2B
        gstr_found = False
        for row in gstr_rows:
            inv_no_match = str(invoice.invoice_number or "").strip().lower() == str(row.invoice_number or "").strip().lower()
            gstin_ok, gstin_quality = _gstin_match(invoice.vendor_gstin, row.vendor_gstin)
            if inv_no_match and gstin_ok:
                gstr_found = True
                break

        # Determine match status based on required rules
        if pr_found and gstr_found:
            match_status = "matched"
        elif pr_found and not gstr_found:
            match_status = "missing_in_2b_itc_review"
        elif not pr_found and gstr_found:
            match_status = "missing_only_from_pr"
        else:
            match_status = "missing_in_2b_and_pr"
        
        row_id_to_link = pr_matched_row.id if pr_matched_row else None

        result = models.ReconciliationResult(
            engagement_id=engagement_id,
            invoice_id=invoice.id,
            register_row_id=row_id_to_link,
            match_status=match_status,
            match_score=pr_score if pr_found else 0.0,
            remarks=f"PR Found: {pr_found}, GSTR-2B Found: {gstr_found}"
        )
        db.add(result)
        
        if match_status != "matched":
            exc = models.ExceptionLog(
                engagement_id=engagement_id,
                type=match_status,
                details=f"Invoice {invoice.invoice_number} from {invoice.vendor_name} resulted in: {match_status}",
                status="open"
            )
            db.add(exc)

    db.commit()
    return {"status": "completed"}


def reconcile_single_invoice(invoice: models.ExtractedInvoice, db: Session):
    db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == invoice.file_id).first()
    engagement_id = db_file.engagement_id

    db.query(models.ReconciliationResult).filter(models.ReconciliationResult.invoice_id == invoice.id).delete()

    # Get purchase register rows
    pr_register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id, 
        models.Register.register_type == "purchase"
    ).first()
    pr_rows = []
    if pr_register:
        pr_rows = db.query(models.RegisterRow).filter(models.RegisterRow.register_id == pr_register.id).all()

    # Get GSTR-2B registry rows
    gstr_register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "gstr2b"
    ).first()
    gstr_rows = []
    if gstr_register:
        gstr_rows = db.query(models.RegisterRow).filter(models.RegisterRow.register_id == gstr_register.id).all()

    # Check existence in PR
    pr_found = False
    pr_matched_row = None
    pr_score = 0.0
    for row in pr_rows:
        inv_no_match = str(invoice.invoice_number or "").strip().lower() == str(row.invoice_number or "").strip().lower()
        gstin_ok, gstin_quality = _gstin_match(invoice.vendor_gstin, row.vendor_gstin)
        if inv_no_match and gstin_ok:
            pr_found = True
            pr_matched_row = row
            if abs(float(invoice.total_value or 0) - float(row.total_value or 0)) < 0.01:
                pr_score = 1.0
            else:
                pr_score = 0.5
            break

    # Check existence in GSTR-2B
    gstr_found = False
    for row in gstr_rows:
        inv_no_match = str(invoice.invoice_number or "").strip().lower() == str(row.invoice_number or "").strip().lower()
        gstin_ok, gstin_quality = _gstin_match(invoice.vendor_gstin, row.vendor_gstin)
        if inv_no_match and gstin_ok:
            gstr_found = True
            break

    # Determine match status based on required rules
    if pr_found and gstr_found:
        match_status = "matched"
    elif pr_found and not gstr_found:
        match_status = "missing_in_2b_itc_review"
    elif not pr_found and gstr_found:
        match_status = "missing_only_from_pr"
    else:
        match_status = "missing_in_2b_and_pr"
    
    # Use PR match row id if available, else None
    row_id_to_link = pr_matched_row.id if pr_matched_row else None

    result = models.ReconciliationResult(
        engagement_id=engagement_id,
        invoice_id=invoice.id,
        register_row_id=row_id_to_link,
        match_status=match_status,
        match_score=pr_score if pr_found else 0.0,
        remarks=f"PR Found: {pr_found}, GSTR-2B Found: {gstr_found}"
    )
    db.add(result)
    
    if match_status != "matched":
        exc = models.ExceptionLog(
            engagement_id=engagement_id,
            type=match_status,
            details=f"Invoice {invoice.invoice_number} from {invoice.vendor_name} resulted in: {match_status}",
            status="open"
        )
        db.add(exc)

    db.commit()
    return {"status": "completed", "match_status": result.match_status if result else "unknown"}



def reconcile_single_bill_of_sale(bos: models.ExtractedBillOfSale, db: Session):
    # Get engagement id from the file
    db_file = db.query(models.BillOfSaleFile).filter(models.BillOfSaleFile.id == bos.file_id).first()
    engagement_id = db_file.engagement_id

    # Clear existing reconciliation results for this Bill of Sale
    db.query(models.ReconciliationResult).filter(models.ReconciliationResult.bill_of_sale_id == bos.id).delete()

    # Get all sales register rows for this engagement
    registers = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "sales"
    ).all()
    register_ids = [r.id for r in registers]
    register_rows = db.query(models.RegisterRow).filter(models.RegisterRow.register_id.in_(register_ids)).all()

    match_found = False
    result = None
    for row in register_rows:
        # Match by sale number
        # Note: Bill of Sale PDF uses 'sale_number' and Register row uses 'invoice_number' (generalized column)
        sale_no_match = str(bos.sale_number or "").strip().lower() == str(row.invoice_number or "").strip().lower()
        # Match by GSTIN
        gstin_ok, gstin_quality = _gstin_match(bos.buyer_gstin, row.vendor_gstin)

        if sale_no_match and gstin_ok:
            if abs(float(bos.total_value or 0) - float(row.total_value or 0)) < 0.01:
                score = 1.0
                match_status = "matched"
            else:
                score = 0.5
                match_status = "partial_match"

            result = models.ReconciliationResult(
                engagement_id=engagement_id,
                bill_of_sale_id=bos.id,
                register_row_id=row.id,
                match_status=match_status,
                match_score=score,
                remarks=f"Matched by sale number {bos.sale_number} (GSTIN {gstin_quality})"
            )
            db.add(result)
            match_found = True
            break

    if not match_found:
        result = models.ReconciliationResult(
            engagement_id=engagement_id,
            bill_of_sale_id=bos.id,
            register_row_id=None,
            match_status="not_in_sales_register",
            match_score=0.0,
            remarks="GSTIN or Sale Number not found in sales register"
        )
        db.add(result)

        exc = models.ExceptionLog(
            engagement_id=engagement_id,
            type="not_in_sales_register",
            details=f"Bill of Sale {bos.sale_number} to {bos.buyer_name} not found in sales register",
            status="open"
        )
        db.add(exc)

    db.commit()
    return {"status": "completed", "match_status": result.match_status if result else "unknown"}
