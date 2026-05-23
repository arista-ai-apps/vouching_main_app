from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter(prefix="/engagements", tags=["engagements"])

@router.post("/", response_model=schemas.Engagement)
def create_engagement(engagement: schemas.EngagementCreate, db: Session = Depends(get_db)):
    db_engagement = models.Engagement(**engagement.dict())
    db.add(db_engagement)
    db.commit()
    db.refresh(db_engagement)
    return db_engagement

@router.get("/", response_model=List[schemas.Engagement])
def read_engagements(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    engagements = db.query(models.Engagement).offset(skip).limit(limit).all()
    return engagements

@router.get("/{engagement_id}", response_model=schemas.Engagement)
def read_engagement(engagement_id: int, db: Session = Depends(get_db)):
    db_engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if db_engagement is None:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return db_engagement
