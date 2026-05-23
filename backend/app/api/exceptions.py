from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(prefix="/exceptions", tags=["exceptions"])

@router.get("/{engagement_id}", response_model=List[schemas.ExceptionLog] if hasattr(schemas, 'ExceptionLog') else List[dict])
def list_exceptions(engagement_id: int, db: Session = Depends(get_db)):
    exceptions = db.query(models.ExceptionLog).filter(models.ExceptionLog.engagement_id == engagement_id).all()
    return exceptions

@router.patch("/{exception_id}")
def update_exception(exception_id: int, status: str, remarks: str = None, db: Session = Depends(get_db)):
    db_exception = db.query(models.ExceptionLog).filter(models.ExceptionLog.id == exception_id).first()
    if not db_exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    db_exception.status = status
    if remarks:
        db_exception.remarks = remarks
    
    db.commit()
    return {"message": "Exception updated"}
