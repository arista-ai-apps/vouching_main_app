from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional
from ..models.models import UserRole

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    role: UserRole

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

# Client Schemas
class ClientBase(BaseModel):
    name: str
    pan: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    id: int
    class Config:
        from_attributes = True

# Engagement Schemas
class EngagementBase(BaseModel):
    client_id: int
    period_start: datetime
    period_end: datetime
    status: str = "active"

class EngagementCreate(EngagementBase):
    pass

class Engagement(EngagementBase):
    id: int
    class Config:
        from_attributes = True

# Uploaded File Schemas
class UploadedFileBase(BaseModel):
    filename: str
    status: str
    created_at: datetime

class UploadedFile(UploadedFileBase):
    id: int
    engagement_id: int
    class Config:
        from_attributes = True

# Extracted Invoice Schemas
class ExtractedInvoiceBase(BaseModel):
    invoice_number: Optional[str] = None
    hsn_code: Optional[str] = None
    invoice_date: Optional[datetime] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    shipping_address: Optional[str] = None
    billing_address: Optional[str] = None
    place_of_supply: Optional[str] = None
    description_of_goods: Optional[str] = None
    eway_bill_no: Optional[str] = None
    taxable_value: Optional[float] = None
    discount: Optional[float] = None
    total_value: Optional[float] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    confidence_score: Optional[float] = None
    status: str = "pending_review"

class ExtractedInvoiceUpdate(ExtractedInvoiceBase):
    pass

class ExtractedInvoice(ExtractedInvoiceBase):
    id: int
    file_id: int
    class Config:
        from_attributes = True

# Reconciliation Schemas
class ReconciliationResultBase(BaseModel):
    engagement_id: int
    invoice_id: int
    register_row_id: Optional[int] = None
    match_status: str
    match_score: float
    remarks: Optional[str] = None

class ReconciliationResult(ReconciliationResultBase):
    id: int
    class Config:
        from_attributes = True

# Exception Schemas
class ExceptionLogBase(BaseModel):
    engagement_id: int
    type: str
    details: str
    status: str = "open"
    remarks: Optional[str] = None

class ExceptionLog(ExceptionLogBase):
    id: int
    class Config:
        from_attributes = True
class VoucherDetail(BaseModel):
    id: int
    filename: str
    status: str
    invoice_number: Optional[str] = None
    hsn_code: Optional[str] = None
    invoice_date: Optional[datetime] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    shipping_address: Optional[str] = None
    billing_address: Optional[str] = None
    place_of_supply: Optional[str] = None
    eway_bill_no: Optional[str] = None
    description_of_goods: Optional[str] = None
    taxable_value: Optional[float] = None
    discount: Optional[float] = None
    total_value: Optional[float] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    confidence_score: Optional[float] = None
    match_status: Optional[str] = None
    
    class Config:
        from_attributes = True

# Bill of Sale Schemas
class BillOfSaleFile(BaseModel):
    id: int
    engagement_id: int
    filename: str
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class BillOfSaleDetail(BaseModel):
    id: int
    filename: str
    status: str
    sale_number: Optional[str] = None
    sale_date: Optional[datetime] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    taxable_value: Optional[float] = None
    total_value: Optional[float] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None
    confidence_score: Optional[float] = None
    match_status: Optional[str] = None
    class Config:
        from_attributes = True


class TaxTypeMismatchBase(BaseModel):
    invoice_id: int
    engagement_id: int
    is_mismatch: bool
    determined_supply_type: str
    expected_tax_type: str
    actual_tax_type: str
    reason: str
    suggestion: str
    status: str

class TaxTypeMismatch(TaxTypeMismatchBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TaxTypeMismatchSummary(BaseModel):
    invoice_id: int
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    determined_supply_type: str
    expected_tax_type: str
    actual_tax_type: str
    reason: str
    suggestion: str
    status: str
    filename: Optional[str] = None

    class Config:
        from_attributes = True
