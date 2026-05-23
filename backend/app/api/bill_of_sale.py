import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..core.database import get_db, SessionLocal
from ..core.config import settings
from ..models import models
from ..schemas import schemas
from ..services import extraction, reconciliation

router = APIRouter(prefix="/bill-of-sale", tags=["bill-of-sale"])


async def process_bill_of_sale(file_id: int):
    db = SessionLocal()
    print(f"[BOS-PROCESS] Starting background task for file_id: {file_id}")
    try:
        db_file = db.query(models.BillOfSaleFile).filter(models.BillOfSaleFile.id == file_id).first()
        if not db_file:
            print(f"[BOS-PROCESS] File ID {file_id} not found.")
            return

        # 1. Clean up existing extraction if this is a retry
        existing_bos = db.query(models.ExtractedBillOfSale).filter(models.ExtractedBillOfSale.file_id == file_id).first()
        if existing_bos:
            db.query(models.ReconciliationResult).filter(models.ReconciliationResult.bill_of_sale_id == existing_bos.id).delete()
            db.delete(existing_bos)
            db.commit()

        db_file.status = "processing"
        db.commit()
        await extraction.extract_bill_of_sale_data(db_file.file_path, db, file_id)

        # 2. Get the newly extracted BOS
        bos = db.query(models.ExtractedBillOfSale).filter(models.ExtractedBillOfSale.file_id == file_id).first()
        if bos:
            # 3. Reconciliation
            print(f"[BOS-PROCESS] Starting reconciliation for: {bos.sale_number}")
            reconciliation.reconcile_single_bill_of_sale(bos, db)
            print(f"[BOS-PROCESS] Reconciliation complete.")
        else:
            print(f"[BOS-WARNING] No data extracted for file_id: {file_id}")
    except Exception as e:
        print(f"[BOS-PROCESS] CRITICAL ERROR for file {file_id}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


@router.post("/upload/{engagement_id}", response_model=schemas.BillOfSaleFile)
async def upload_bill_of_sale(
    engagement_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    engagement_dir = os.path.join(settings.STORAGE_DIR, str(engagement_id), "bills_of_sale")
    os.makedirs(engagement_dir, exist_ok=True)

    file_path = os.path.join(engagement_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_file = models.BillOfSaleFile(
        engagement_id=engagement_id,
        filename=file.filename,
        file_path=file_path,
        status="uploaded"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    background_tasks.add_task(process_bill_of_sale, db_file.id)
    return db_file


@router.get("/{engagement_id}", response_model=List[schemas.BillOfSaleDetail])
def list_bills_of_sale(engagement_id: int, db: Session = Depends(get_db)):
    results = db.query(
        models.BillOfSaleFile,
        models.ExtractedBillOfSale,
        models.ReconciliationResult
    ).outerjoin(
        models.ExtractedBillOfSale, models.BillOfSaleFile.id == models.ExtractedBillOfSale.file_id
    ).outerjoin(
        models.ReconciliationResult, models.ExtractedBillOfSale.id == models.ReconciliationResult.bill_of_sale_id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id
    ).all()

    items = []
    for bos_file, extracted, recon in results:
        items.append({
            "id": bos_file.id,
            "filename": bos_file.filename,
            "status": bos_file.status,
            "sale_number": extracted.sale_number if extracted else None,
            "sale_date": extracted.sale_date if extracted else None,
            "buyer_name": extracted.buyer_name if extracted else None,
            "buyer_gstin": extracted.buyer_gstin if extracted else None,
            "taxable_value": extracted.taxable_value if extracted else None,
            "total_value": extracted.total_value if extracted else None,
            "cgst": extracted.cgst if extracted else None,
            "sgst": extracted.sgst if extracted else None,
            "igst": extracted.igst if extracted else None,
            "confidence_score": extracted.confidence_score if extracted else None,
            "match_status": recon.match_status if recon else None
        })
    return items


@router.delete("/{file_id}")
def delete_bill_of_sale(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(models.BillOfSaleFile).filter(models.BillOfSaleFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    db.query(models.ExtractedBillOfSale).filter(
        models.ExtractedBillOfSale.file_id == file_id
    ).delete(synchronize_session=False)

    if os.path.exists(db_file.file_path):
        try:
            os.remove(db_file.file_path)
        except Exception as e:
            print(f"Error deleting file {db_file.file_path}: {e}")

    db.delete(db_file)
    db.commit()
    return {"message": "Bill of Sale deleted successfully"}


@router.post("/retry/{file_id}")
async def retry_bill_of_sale(
    file_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_file = db.query(models.BillOfSaleFile).filter(models.BillOfSaleFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    db_file.status = "processing"
    db.commit()
    background_tasks.add_task(process_bill_of_sale, file_id)
    return {"message": "Retry started"}


@router.post("/retry-all/{engagement_id}")
async def retry_all_failed(
    engagement_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    failed_files = db.query(models.BillOfSaleFile).filter(
        models.BillOfSaleFile.engagement_id == engagement_id,
        models.BillOfSaleFile.status == "failed"
    ).all()
    
    count = 0
    for db_file in failed_files:
        db_file.status = "processing"
        count += 1
        background_tasks.add_task(process_bill_of_sale, db_file.id)
    
    db.commit()
    return {"message": f"Retry started for {count} files"}


@router.get("/summary/{engagement_id}")
def get_bos_summary(engagement_id: int, db: Session = Depends(get_db)):
    total = db.query(models.BillOfSaleFile).filter(
        models.BillOfSaleFile.engagement_id == engagement_id
    ).count()

    extracted_count = db.query(models.BillOfSaleFile).filter(
        models.BillOfSaleFile.engagement_id == engagement_id,
        models.BillOfSaleFile.status == "extracted"
    ).count()

    failed = db.query(models.BillOfSaleFile).filter(
        models.BillOfSaleFile.engagement_id == engagement_id,
        models.BillOfSaleFile.status == "failed"
    ).count()

    total_value = db.query(func.sum(models.ExtractedBillOfSale.total_value)).join(
        models.BillOfSaleFile, models.ExtractedBillOfSale.file_id == models.BillOfSaleFile.id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id
    ).scalar() or 0.0

    total_taxable = db.query(func.sum(models.ExtractedBillOfSale.taxable_value)).join(
        models.BillOfSaleFile, models.ExtractedBillOfSale.file_id == models.BillOfSaleFile.id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id
    ).scalar() or 0.0

    # Matched count & value
    matched_count = db.query(models.ReconciliationResult).join(
        models.ExtractedBillOfSale, models.ReconciliationResult.bill_of_sale_id == models.ExtractedBillOfSale.id
    ).join(
        models.BillOfSaleFile, models.ExtractedBillOfSale.file_id == models.BillOfSaleFile.id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "matched"
    ).count()

    total_matched_value = db.query(func.sum(models.ExtractedBillOfSale.total_value)).join(
        models.ReconciliationResult, models.ExtractedBillOfSale.id == models.ReconciliationResult.bill_of_sale_id
    ).join(
        models.BillOfSaleFile, models.ExtractedBillOfSale.file_id == models.BillOfSaleFile.id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "matched"
    ).scalar() or 0.0

    not_in_registry = db.query(models.ReconciliationResult).join(
        models.ExtractedBillOfSale, models.ReconciliationResult.bill_of_sale_id == models.ExtractedBillOfSale.id
    ).join(
        models.BillOfSaleFile, models.ExtractedBillOfSale.file_id == models.BillOfSaleFile.id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id,
        models.ReconciliationResult.match_status == "not_in_sales_register"
    ).count()

    buyer_breakdown = db.query(
        models.ExtractedBillOfSale.buyer_name,
        func.count(models.ExtractedBillOfSale.id).label("count"),
        func.sum(models.ExtractedBillOfSale.total_value).label("total")
    ).join(
        models.BillOfSaleFile, models.ExtractedBillOfSale.file_id == models.BillOfSaleFile.id
    ).filter(
        models.BillOfSaleFile.engagement_id == engagement_id
    ).group_by(models.ExtractedBillOfSale.buyer_name).order_by(
        func.count(models.ExtractedBillOfSale.id).desc()
    ).limit(10).all()

    extraction_rate = round((extracted_count / total * 100), 1) if total > 0 else 0.0

    return {
        "total": total,
        "extracted": extracted_count,
        "matched": matched_count,
        "not_in_registry": not_in_registry,
        "failed": failed,
        "pending": total - extracted_count - failed,
        "extraction_rate": extraction_rate,
        "total_value": round(total_value, 2),
        "total_matched_value": round(total_matched_value, 2),
        "total_taxable": round(total_taxable, 2),
        "buyer_breakdown": [
            {"buyer": r[0] or "Unknown", "count": r[1], "total": round(r[2] or 0, 2)}
            for r in buyer_breakdown
        ]
    }
