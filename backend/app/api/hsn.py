"""HSN Recommendation API endpoints."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..core.database import get_db
from ..models import models
from ..services import hsn_recommender

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hsn", tags=["hsn"])


@router.get("/status/{engagement_id}")
def get_hsn_status(engagement_id: int, db: Session = Depends(get_db)):
    """
    Returns all vouchers in this engagement that are missing an HSN code,
    along with any existing recommendation data.
    """
    logger.info(f"[HSN] Fetching status for engagement_id: {engagement_id}")
    results = (
        db.query(models.UploadedFile, models.ExtractedInvoice, models.HsnRecommendation)
        .join(models.ExtractedInvoice, models.ExtractedInvoice.file_id == models.UploadedFile.id)
        .outerjoin(models.HsnRecommendation, models.HsnRecommendation.file_id == models.UploadedFile.id)
        .filter(
            models.UploadedFile.engagement_id == engagement_id,
            models.UploadedFile.status == "extracted",
        )
        .filter(
            or_(
                models.ExtractedInvoice.hsn_code == None,
                models.ExtractedInvoice.hsn_code == "",
                models.ExtractedInvoice.hsn_code == "None",
                models.ExtractedInvoice.hsn_code == "null",
                models.ExtractedInvoice.hsn_code == "missing",
                models.ExtractedInvoice.hsn_code == "0000"
            )
        )
        .all()
    )
    logger.info(f"[HSN] Found {len(results)} rows for engagement {engagement_id}")

    rows = []
    for file, invoice, rec in results:
        row = {
            "file_id": file.id,
            "filename": file.filename,
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "vendor_gstin": invoice.vendor_gstin,
            "taxable_value": invoice.taxable_value,
            "recommendation": None,
        }
        if rec:
            row["recommendation"] = {
                "item_description": rec.item_description,
                "recommended_hsn": rec.recommended_hsn,
                "recommended_hsn_description": rec.recommended_hsn_description,
                "confidence_score": rec.confidence_score,
                "status": rec.status,
                "reasoning": rec.reasoning,
                "top_alternatives": json.loads(rec.top_alternatives) if rec.top_alternatives else [],
                "accepted_hsn": rec.accepted_hsn,
                "reviewed_by": rec.reviewed_by,
            }
        rows.append(row)

    return rows


@router.post("/recommend/{engagement_id}")
async def run_recommendations(
    engagement_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger HSN recommendation generation for all missing-HSN vouchers in this engagement."""
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    background_tasks.add_task(
        hsn_recommender.generate_recommendations_for_engagement, engagement_id, db
    )
    return {"message": "HSN recommendations started in background.", "engagement_id": engagement_id}


@router.post("/recommend/single/{file_id}")
def run_single_recommendation(
    file_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger HSN recommendation for a single file."""
    file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    invoice = db.query(models.ExtractedInvoice).filter(
        models.ExtractedInvoice.file_id == file_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="No extracted invoice found for this file")

    def _run_single(fid: int, vendor: str, inv_num: str, desc: str, eng_id: int):
        description_parts = []
        if desc: description_parts.append(desc)
        if vendor: description_parts.append(vendor)
        if inv_num: description_parts.append(inv_num)
        
        item_description = " - ".join(description_parts) or "Unknown"
        rec = hsn_recommender.get_recommendation(item_description, vendor or "")

        from ..core.database import SessionLocal
        fresh_db = SessionLocal()
        try:
            fresh_db.query(models.HsnRecommendation).filter(
                models.HsnRecommendation.file_id == fid
            ).delete(synchronize_session=False)
            import json
            db_rec = models.HsnRecommendation(
                file_id=fid,
                engagement_id=eng_id,
                item_description=item_description,
                recommended_hsn=rec.get("recommended_hsn"),
                recommended_hsn_description=rec.get("recommended_description"),
                confidence_score=rec.get("confidence", 0.0),
                status=rec.get("status", "NEEDS_REVIEW"),
                top_alternatives=json.dumps(rec.get("alternatives", [])),
                reasoning=rec.get("reasoning", ""),
            )
            fresh_db.add(db_rec)
            fresh_db.commit()
            logger.info(f"[HSN] Single recommendation saved for file_id={fid}: {rec.get('recommended_hsn')}")
        except Exception as e:
            logger.error(f"[HSN] Error saving single recommendation for file_id={fid}: {e}")
            fresh_db.rollback()
        finally:
            fresh_db.close()

    background_tasks.add_task(
        _run_single,
        file_id,
        invoice.vendor_name or "",
        invoice.invoice_number or "",
        getattr(invoice, "description_of_goods", ""),
        file.engagement_id,
    )
    return {"message": "Single HSN recommendation started.", "file_id": file_id}


@router.patch("/accept/{file_id}")
def accept_recommendation(
    file_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    """
    Accept an HSN recommendation (or manual override).
    Writes accepted_hsn to both hsn_recommendations and extracted_invoices.hsn_code.
    """
    accepted_hsn = body.get("hsn_code")
    reviewed_by = body.get("reviewed_by", "reviewer")

    if not accepted_hsn:
        raise HTTPException(status_code=400, detail="hsn_code is required in body")

    # Update recommendation record
    rec = db.query(models.HsnRecommendation).filter(
        models.HsnRecommendation.file_id == file_id
    ).first()
    if rec:
        rec.accepted_hsn = accepted_hsn
        rec.reviewed_by = reviewed_by

    # Write back to extracted invoice — this removes the file from Missing HSN tab
    invoice = db.query(models.ExtractedInvoice).filter(
        models.ExtractedInvoice.file_id == file_id
    ).first()
    if invoice:
        invoice.hsn_code = accepted_hsn
    else:
        raise HTTPException(status_code=404, detail="No extracted invoice found for this file")

    db.commit()
    return {"message": "HSN accepted and updated.", "file_id": file_id, "hsn_code": accepted_hsn}
