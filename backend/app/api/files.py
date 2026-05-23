import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core.database import get_db, SessionLocal
from ..core.config import settings
from ..models import models
from ..schemas import schemas
from ..services import extraction, reconciliation, tax_validator

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/summary/{engagement_id}")
def get_engagement_summary(engagement_id: int, db: Session = Depends(get_db)):
    """Return aggregated stats for the verification report."""
    from sqlalchemy import func

    # Total files
    total = db.query(models.UploadedFile).filter(
        models.UploadedFile.engagement_id == engagement_id
    ).count()

    # Matched count  
    matched = db.query(models.ReconciliationResult).join(
        models.ExtractedInvoice, models.ReconciliationResult.invoice_id == models.ExtractedInvoice.id
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "matched"
    ).count()

    # Exceptions
    missing_in_2b_itc = db.query(models.ReconciliationResult).join(
        models.ExtractedInvoice, models.ReconciliationResult.invoice_id == models.ExtractedInvoice.id
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "missing_in_2b_itc_review"
    ).count()

    missing_only_from_pr = db.query(models.ReconciliationResult).join(
        models.ExtractedInvoice, models.ReconciliationResult.invoice_id == models.ExtractedInvoice.id
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "missing_only_from_pr"
    ).count()

    missing_in_2b_and_pr = db.query(models.ReconciliationResult).join(
        models.ExtractedInvoice, models.ReconciliationResult.invoice_id == models.ExtractedInvoice.id
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "missing_in_2b_and_pr"
    ).count()

    not_in_registry = missing_in_2b_itc + missing_only_from_pr + missing_in_2b_and_pr

    # Extraction failures
    failed = db.query(models.UploadedFile).filter(
        models.UploadedFile.engagement_id == engagement_id,
        models.UploadedFile.status == "failed"
    ).count()

    # Total value of all matched invoices
    total_matched_value = db.query(func.sum(models.ExtractedInvoice.total_value)).join(
        models.ReconciliationResult, models.ExtractedInvoice.id == models.ReconciliationResult.invoice_id
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "matched"
    ).scalar() or 0.0

    # Total value of all invoices
    total_value = db.query(func.sum(models.ExtractedInvoice.total_value)).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id
    ).scalar() or 0.0

    # Vendor breakdown (top vendors by invoice count)
    vendor_breakdown = db.query(
        models.ExtractedInvoice.vendor_name,
        func.count(models.ExtractedInvoice.id).label("count"),
        func.sum(models.ExtractedInvoice.total_value).label("total")
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id
    ).group_by(models.ExtractedInvoice.vendor_name).order_by(
        func.count(models.ExtractedInvoice.id).desc()
    ).limit(10).all()

    match_rate = round((matched / total * 100), 1) if total > 0 else 0.0
    quality_score = round(match_rate, 0)

    return {
        "total": total,
        "matched": matched,
        "not_in_registry": not_in_registry,
        "missing_in_2b_itc": missing_in_2b_itc,
        "missing_only_from_pr": missing_only_from_pr,
        "missing_in_2b_and_pr": missing_in_2b_and_pr,
        "failed": failed,
        "pending": total - matched - not_in_registry - failed,
        "match_rate": match_rate,
        "quality_score": quality_score,
        "total_value": round(total_value, 2),
        "total_matched_value": round(total_matched_value, 2),
        "vendor_breakdown": [
            {"vendor": r[0] or "Unknown", "count": r[1], "total": round(r[2] or 0, 2)}
            for r in vendor_breakdown
        ]
    }


async def process_uploaded_file(file_id: int):
    # Create a fresh DB session for the background task
    db = SessionLocal()
    print(f"[PROCESS] Starting background task for file_id: {file_id}")
    try:
        db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not db_file:
            print(f"[ERROR] File ID {file_id} not found in database.")
            return
        
        # Mark as processing
        db_file.status = "processing"
        db.commit()
        db.refresh(db_file)
        print(f"[PROCESS] Status updated to 'processing' for file: {db_file.filename}")
        
        # 1. OCR Extraction (GPT-4o-mini)
        print(f"[PROCESS] Starting AI extraction for {db_file.filename}...")
        await extraction.extract_invoice_data(db_file.file_path, db, file_id)
        
        # Refresh to get updated status/invoice from extraction
        db.refresh(db_file)
        print(f"[PROCESS] Extraction complete. File status: {db_file.status}")

        # 2. Get the extracted invoice
        invoice = db.query(models.ExtractedInvoice).filter(models.ExtractedInvoice.file_id == file_id).first()
        if invoice:
            # 3. Reconciliation
            print(f"[PROCESS] Starting reconciliation for invoice: {invoice.invoice_number}")
            reconciliation.reconcile_single_invoice(invoice, db)
            print(f"[PROCESS] Reconciliation complete.")
            
            # 4. Tax Type Validation
            print(f"[PROCESS] Starting tax type validation for invoice: {invoice.invoice_number}")
            tax_validator.validate_tax_type(invoice, db)
            db.commit() # Save the validation results
            print(f"[PROCESS] Tax type validation complete.")
        else:
            print(f"[WARNING] No invoice extracted for file_id: {file_id}")
            
    except Exception as e:
        print(f"[CRITICAL ERROR] Background processing failed for file {file_id}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print(f"[PROCESS] Background task finished for file_id: {file_id}")

@router.post("/upload/{engagement_id}", response_model=schemas.UploadedFile)
async def upload_file(
    engagement_id: int, 
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    # Verify engagement exists
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    
    # Save file to storage
    engagement_dir = os.path.join(settings.STORAGE_DIR, str(engagement_id))
    os.makedirs(engagement_dir, exist_ok=True)
    
    file_path = os.path.join(engagement_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create DB record
    db_file = models.UploadedFile(
        engagement_id=engagement_id,
        filename=file.filename,
        file_path=file_path,
        status="uploaded"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    # Trigger background OCR/Extraction and Reconciliation
    background_tasks.add_task(process_uploaded_file, db_file.id)
    
    return db_file

@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # 1. Delete associated Reconciliation Results first (deepest relation)
    # Get all invoices for this file
    invoices = db.query(models.ExtractedInvoice).filter(models.ExtractedInvoice.file_id == file_id).all()
    invoice_ids = [inv.id for inv in invoices]
    
    if invoice_ids:
        db.query(models.ReconciliationResult).filter(models.ReconciliationResult.invoice_id.in_(invoice_ids)).delete(synchronize_session=False)
        
    # 2. Delete associated Extracted Invoices
    db.query(models.ExtractedInvoice).filter(models.ExtractedInvoice.file_id == file_id).delete(synchronize_session=False)
    
    # 3. Delete physical file
    if os.path.exists(db_file.file_path):
        try:
            os.remove(db_file.file_path)
        except Exception as e:
            print(f"Error deleting file {db_file.file_path}: {e}")
    
    # 4. Delete DB record for UploadedFile
    db.delete(db_file)
    db.commit()
    return {"message": "File deleted successfully"}

@router.get("/{engagement_id}", response_model=List[schemas.VoucherDetail])
def list_files(engagement_id: int, db: Session = Depends(get_db)):
    # Join UploadedFile with ExtractedInvoice and ReconciliationResult
    results = db.query(
        models.UploadedFile,
        models.ExtractedInvoice,
        models.ReconciliationResult
    ).outerjoin(
        models.ExtractedInvoice, models.UploadedFile.id == models.ExtractedInvoice.file_id
    ).outerjoin(
        models.ReconciliationResult, models.ExtractedInvoice.id == models.ReconciliationResult.invoice_id
    ).filter(
        models.UploadedFile.engagement_id == engagement_id
    ).all()
    
    vouchers = []
    for file, invoice, recon in results:
        v_data = {
            "id": file.id,
            "filename": file.filename,
            "status": file.status,
            "invoice_number": invoice.invoice_number if invoice else None,
            "hsn_code": invoice.hsn_code if invoice else None,
            "invoice_date": invoice.invoice_date if invoice else None,
            "vendor_name": invoice.vendor_name if invoice else None,
            "vendor_gstin": invoice.vendor_gstin if invoice else None,
            "buyer_name": invoice.buyer_name if invoice else None,
            "buyer_gstin": invoice.buyer_gstin if invoice else None,
            "shipping_address": invoice.shipping_address if invoice else None,
            "billing_address": invoice.billing_address if invoice else None,
            "place_of_supply": invoice.place_of_supply if invoice else None,
            "eway_bill_no": invoice.eway_bill_no if invoice else None,
            "description_of_goods": invoice.description_of_goods if invoice else None,
            "taxable_value": invoice.taxable_value if invoice else None,
            "discount": invoice.discount if invoice else None,
            "total_value": invoice.total_value if invoice else None,
            "cgst": invoice.cgst if invoice else None,
            "sgst": invoice.sgst if invoice else None,
            "igst": invoice.igst if invoice else None,
            "cgst_rate": invoice.cgst_rate if invoice else None,
            "sgst_rate": invoice.sgst_rate if invoice else None,
            "igst_rate": invoice.igst_rate if invoice else None,
            "confidence_score": invoice.confidence_score if invoice else None,
            "match_status": recon.match_status if recon else None
        }
        vouchers.append(v_data)
        
    return vouchers

@router.post("/reconcile/{engagement_id}")
def run_reconciliation_endpoint(engagement_id: int, db: Session = Depends(get_db)):
    """Manually trigger reconciliation for all extracted invoices against registers."""
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    
    try:
        reconciliation.run_reconciliation(engagement_id, db)
        return {"status": "success", "message": "Reconciliation completed."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Reconciliation error: {str(e)}")
@router.post("/{file_id}/reprocess")
async def reprocess_file(
    file_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # 1. Delete associated Reconciliation Results
    invoices = db.query(models.ExtractedInvoice).filter(models.ExtractedInvoice.file_id == file_id).all()
    invoice_ids = [inv.id for inv in invoices]
    if invoice_ids:
        db.query(models.ReconciliationResult).filter(models.ReconciliationResult.invoice_id.in_(invoice_ids)).delete(synchronize_session=False)
        
    # 2. Delete associated Extracted Invoices
    db.query(models.ExtractedInvoice).filter(models.ExtractedInvoice.file_id == file_id).delete(synchronize_session=False)
    
    # 3. Reset file status
    db_file.status = "uploaded"
    db.commit()
    db.refresh(db_file)
    
    # 4. Trigger background processing again
    background_tasks.add_task(process_uploaded_file, file_id)
    
    return {"message": "Re-processing started.", "status": "uploaded"}


@router.get("/tax-mismatches/{engagement_id}", response_model=List[schemas.TaxTypeMismatchSummary])
def get_tax_type_mismatches(engagement_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    """Return invoices with tax type mismatches, optionally filtered by status."""
    query = db.query(
        models.TaxTypeMismatch,
        models.ExtractedInvoice,
        models.UploadedFile
    ).join(
        models.ExtractedInvoice, models.TaxTypeMismatch.invoice_id == models.ExtractedInvoice.id
    ).join(
        models.UploadedFile, models.ExtractedInvoice.file_id == models.UploadedFile.id
    ).filter(
        models.TaxTypeMismatch.engagement_id == engagement_id
    )
    
    if status:
        query = query.filter(models.TaxTypeMismatch.status == status)
    else:
        query = query.filter(models.TaxTypeMismatch.status.in_(["MISMATCH", "NEEDS_REVIEW"]))
        
    mismatches = query.all()
    
    results = []
    for m, inv, uf in mismatches:
        results.append({
            "invoice_id": m.invoice_id,
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name,
            "determined_supply_type": m.determined_supply_type,
            "expected_tax_type": m.expected_tax_type,
            "actual_tax_type": m.actual_tax_type,
            "reason": m.reason,
            "suggestion": m.suggestion,
            "status": m.status,
            "filename": uf.filename
        })
    return results
