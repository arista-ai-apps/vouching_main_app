import os
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..models import models
from ..schemas import schemas
from datetime import datetime

router = APIRouter(prefix="/registers", tags=["registers"])

@router.post("/upload/{engagement_id}")
async def upload_register(
    engagement_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    # Verify engagement exists
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    
    try:
        # Read Excel
        contents = await file.read()
        import io
        df = pd.read_excel(io.BytesIO(contents))
        
        # Mapping (for POC, we use hardcoded or guessed mapping)
        # In a real app, we'd use the frontend mapping provided
        
        # Clear existing register for this engagement
        old_registers = db.query(models.Register).filter(models.Register.engagement_id == engagement_id).all()
        for reg in old_registers:
            db.query(models.RegisterRow).filter(models.RegisterRow.register_id == reg.id).delete()
            db.delete(reg)
        
        # Create new Register
        db_register = models.Register(
            engagement_id=engagement_id,
            filename=file.filename,
            register_type="purchase"
        )
        db.add(db_register)
        db.commit()
        db.refresh(db_register)
        
        # Helper to safely get float
        def safe_float(val):
            try:
                if pd.isna(val): return 0.0
                return float(val)
            except:
                return 0.0

        # Bulk insert rows
        rows = []
        for _, row in df.iterrows():
            # Try to find columns by name (common variations)
            inv_no = row.get("Invoice Number") or row.get("Inv_No") or row.get("Invoice No") or row.get("Serial No")
            inv_date = row.get("Date") or row.get("Invoice Date")
            vendor = row.get("Vendor Name") or row.get("Supplier") or row.get("Party Name")
            gstin = row.get("GSTIN") or row.get("Supplier GSTIN")
            taxable = safe_float(row.get("Taxable Value") or row.get("Taxable Amt"))
            total = safe_float(row.get("Total Value") or row.get("Gross Amount") or row.get("Total"))

            # Parse date if possible
            row_date = None
            if inv_date:
                try:
                    if isinstance(inv_date, datetime):
                        row_date = inv_date
                    else:
                        row_date = pd.to_datetime(inv_date)
                except:
                    row_date = None

            db_row = models.RegisterRow(
                register_id=db_register.id,
                invoice_number=str(inv_no) if inv_no else "UNKNOWN",
                invoice_date=row_date,
                vendor_name=str(vendor) if vendor else "UNKNOWN",
                vendor_gstin=str(gstin) if gstin else None,
                taxable_value=taxable,
                total_value=total
            )
            rows.append(db_row)
        
        db.bulk_save_objects(rows)
        db.commit()
        
        return {"filename": file.filename, "rows": len(rows), "id": db_register.id}
    
    except Exception as e:
        print(f"Register upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{engagement_id}")
def get_registers(engagement_id: int, db: Session = Depends(get_db)):
    return db.query(models.Register).filter(models.Register.engagement_id == engagement_id).all()

@router.get("/{engagement_id}/rows")
def get_register_rows(engagement_id: int, db: Session = Depends(get_db)):
    # Get all rows for the purchase register of this engagement
    register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "purchase"
    ).first()
    if not register:
        return []
    return db.query(models.RegisterRow).filter(models.RegisterRow.register_id == register.id).all()


@router.post("/upload-sales/{engagement_id}")
async def upload_sales_register(
    engagement_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    try:
        contents = await file.read()
        import io
        df = pd.read_excel(io.BytesIO(contents))

        # Clear existing sales register for this engagement
        old_registers = db.query(models.Register).filter(
            models.Register.engagement_id == engagement_id,
            models.Register.register_type == "sales"
        ).all()
        for reg in old_registers:
            db.query(models.RegisterRow).filter(models.RegisterRow.register_id == reg.id).delete()
            db.delete(reg)

        db_register = models.Register(
            engagement_id=engagement_id,
            filename=file.filename,
            register_type="sales"
        )
        db.add(db_register)
        db.commit()
        db.refresh(db_register)

        def safe_float(val):
            try:
                if pd.isna(val): return 0.0
                return float(val)
            except:
                return 0.0

        rows = []
        for _, row in df.iterrows():
            sale_no   = row.get("Sale Number") or row.get("Sale No") or row.get("Invoice Number") or row.get("Serial No")
            sale_date = row.get("Date") or row.get("Sale Date")
            buyer     = row.get("Buyer Name") or row.get("Customer") or row.get("Party Name")
            gstin     = row.get("Buyer GSTIN") or row.get("GSTIN") or row.get("Customer GSTIN")
            taxable   = safe_float(row.get("Taxable Value") or row.get("Taxable Amt"))
            total     = safe_float(row.get("Total Value") or row.get("Gross Amount") or row.get("Total"))

            row_date = None
            if sale_date:
                try:
                    if isinstance(sale_date, datetime):
                        row_date = sale_date
                    else:
                        row_date = pd.to_datetime(sale_date)
                except:
                    row_date = None

            db_row = models.RegisterRow(
                register_id=db_register.id,
                invoice_number=str(sale_no) if sale_no else "UNKNOWN",
                invoice_date=row_date,
                vendor_name=str(buyer) if buyer else "UNKNOWN",
                vendor_gstin=str(gstin) if gstin else None,
                taxable_value=taxable,
                total_value=total
            )
            rows.append(db_row)

        db.bulk_save_objects(rows)
        db.commit()
        return {"filename": file.filename, "rows": len(rows), "id": db_register.id}

    except Exception as e:
        print(f"Sales register upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales/{engagement_id}")
def get_sales_registers(engagement_id: int, db: Session = Depends(get_db)):
    return db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "sales"
    ).all()


@router.get("/sales/{engagement_id}/rows")
def get_sales_register_rows(engagement_id: int, db: Session = Depends(get_db)):
    register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "sales"
    ).first()
    if not register:
        return []
    return db.query(models.RegisterRow).filter(models.RegisterRow.register_id == register.id).all()


@router.post("/upload-gstr2b/{engagement_id}")
async def upload_gstr2b_register(
    engagement_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    engagement = db.query(models.Engagement).filter(models.Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    try:
        contents = await file.read()
        import io
        df = pd.read_excel(io.BytesIO(contents))

        # Clear existing GSTR-2B register for this engagement
        old_registers = db.query(models.Register).filter(
            models.Register.engagement_id == engagement_id,
            models.Register.register_type == "gstr2b"
        ).all()
        for reg in old_registers:
            db.query(models.RegisterRow).filter(models.RegisterRow.register_id == reg.id).delete()
            db.delete(reg)

        db_register = models.Register(
            engagement_id=engagement_id,
            filename=file.filename,
            register_type="gstr2b"
        )
        db.add(db_register)
        db.commit()
        db.refresh(db_register)

        def safe_float(val):
            try:
                if pd.isna(val): return 0.0
                return float(val)
            except:
                return 0.0

        rows = []
        for _, row in df.iterrows():
            inv_no = row.get("Invoice Number") or row.get("Inv_No") or row.get("Invoice No") or row.get("Serial No")
            inv_date = row.get("Date") or row.get("Invoice Date")
            vendor = row.get("Vendor Name") or row.get("Supplier") or row.get("Party Name") or row.get("Vendor")
            gstin = row.get("GSTIN") or row.get("Supplier GSTIN")
            taxable = safe_float(row.get("Taxable Value") or row.get("Taxable Amt"))
            total = safe_float(row.get("Total Value") or row.get("Gross Amount") or row.get("Total"))

            row_date = None
            if inv_date:
                try:
                    if isinstance(inv_date, datetime):
                        row_date = inv_date
                    else:
                        row_date = pd.to_datetime(inv_date)
                except:
                    row_date = None

            db_row = models.RegisterRow(
                register_id=db_register.id,
                invoice_number=str(inv_no) if inv_no else "UNKNOWN",
                invoice_date=row_date,
                vendor_name=str(vendor) if vendor else "UNKNOWN",
                vendor_gstin=str(gstin) if gstin else None,
                taxable_value=taxable,
                total_value=total
            )
            rows.append(db_row)

        db.bulk_save_objects(rows)
        db.commit()
        return {"filename": file.filename, "rows": len(rows), "id": db_register.id}

    except Exception as e:
        print(f"GSTR-2B upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/gstr2b/{engagement_id}")
def get_gstr2b_registers(engagement_id: int, db: Session = Depends(get_db)):
    return db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "gstr2b"
    ).all()


@router.get("/gstr2b/{engagement_id}/rows")
def get_gstr2b_register_rows(engagement_id: int, db: Session = Depends(get_db)):
    register = db.query(models.Register).filter(
        models.Register.engagement_id == engagement_id,
        models.Register.register_type == "gstr2b"
    ).first()
    if not register:
        return []
    return db.query(models.RegisterRow).filter(models.RegisterRow.register_id == register.id).all()

