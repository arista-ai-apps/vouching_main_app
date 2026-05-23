from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..models import models
from ..schemas import schemas
from ..services import reconciliation

router = APIRouter(prefix="/reconcile", tags=["reconciliation"])

@router.post("/{engagement_id}")
def start_reconciliation(engagement_id: int, db: Session = Depends(get_db)):
    result = reconciliation.run_reconciliation(engagement_id, db)
    return result

@router.get("/{engagement_id}/results", response_model=List[schemas.ReconciliationResult] if hasattr(schemas, 'ReconciliationResult') else List[dict])
def get_results(engagement_id: int, db: Session = Depends(get_db)):
    # Note: Need ReconciliationResult schema in schemas.py
    results = db.query(models.ReconciliationResult).filter(models.ReconciliationResult.engagement_id == engagement_id).all()
    return results
