from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, JSON, Text
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    ARTICLE = "article"
    MANAGER = "manager"
    PARTNER = "partner"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.ARTICLE)

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    pan = Column(String)
    gstin = Column(String)
    address = Column(String)
    engagements = relationship("Engagement", back_populates="client")

class Engagement(Base):
    __tablename__ = "engagements"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    status = Column(String, default="active")
    client = relationship("Client", back_populates="engagements")
    files = relationship("UploadedFile", back_populates="engagement")
    bill_of_sale_files = relationship("BillOfSaleFile", back_populates="engagement")

class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"))
    filename = Column(String)
    file_path = Column(String)
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)
    engagement = relationship("Engagement", back_populates="files")
    invoices = relationship("ExtractedInvoice", back_populates="file")

class ExtractedInvoice(Base):
    __tablename__ = "extracted_invoices"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("uploaded_files.id"))
    invoice_number = Column(String)
    hsn_code = Column(String)
    invoice_date = Column(DateTime)
    vendor_name = Column(String)
    vendor_gstin = Column(String)
    buyer_name = Column(String)
    buyer_gstin = Column(String)
    shipping_address = Column(String)
    billing_address = Column(String)
    place_of_supply = Column(String)
    description_of_goods = Column(String)
    eway_bill_no = Column(String)
    taxable_value = Column(Float)
    discount = Column(Float)
    total_value = Column(Float)
    cgst = Column(Float)
    sgst = Column(Float)
    igst = Column(Float)
    cgst_rate = Column(Float)
    sgst_rate = Column(Float)
    igst_rate = Column(Float)
    confidence_score = Column(Float)
    status = Column(String, default="pending_review")
    file = relationship("UploadedFile", back_populates="invoices")
    items = relationship("ExtractedInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

class ExtractedInvoiceItem(Base):
    __tablename__ = "extracted_invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("extracted_invoices.id"))
    description = Column(String)
    hsn_code = Column(String)
    quantity = Column(Float)
    unit = Column(String)
    unit_price = Column(Float)
    discount = Column(Float)
    taxable_value = Column(Float)
    invoice = relationship("ExtractedInvoice", back_populates="items")

class Register(Base):
    __tablename__ = "registers"
    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"))
    register_type = Column(String) # purchase or sales
    filename = Column(String)
    file_path = Column(String)
    rows = relationship("RegisterRow", back_populates="register")

class RegisterRow(Base):
    __tablename__ = "register_rows"
    id = Column(Integer, primary_key=True, index=True)
    register_id = Column(Integer, ForeignKey("registers.id"))
    invoice_number = Column(String)
    invoice_date = Column(DateTime)
    vendor_name = Column(String)
    vendor_gstin = Column(String)
    taxable_value = Column(Float)
    total_value = Column(Float)
    register = relationship("Register", back_populates="rows")

class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"
    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"))
    invoice_id = Column(Integer, ForeignKey("extracted_invoices.id"), nullable=True)
    bill_of_sale_id = Column(Integer, ForeignKey("extracted_bills_of_sale.id"), nullable=True)
    register_row_id = Column(Integer, ForeignKey("register_rows.id"), nullable=True)
    match_status = Column(String)
    match_score = Column(Float)
    remarks = Column(String)

class ExceptionLog(Base):
    __tablename__ = "exceptions"
    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"))
    type = Column(String)
    details = Column(String)
    status = Column(String, default="open")
    remarks = Column(String)


class BillOfSaleFile(Base):
    __tablename__ = "bill_of_sale_files"
    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"))
    filename = Column(String)
    file_path = Column(String)
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)
    engagement = relationship("Engagement", back_populates="bill_of_sale_files")
    extracted = relationship("ExtractedBillOfSale", back_populates="file", uselist=False)


class ExtractedBillOfSale(Base):
    __tablename__ = "extracted_bills_of_sale"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("bill_of_sale_files.id"))
    sale_number = Column(String)
    sale_date = Column(DateTime)
    buyer_name = Column(String)
    buyer_gstin = Column(String)
    taxable_value = Column(Float)
    total_value = Column(Float)
    cgst = Column(Float)
    sgst = Column(Float)
    igst = Column(Float)
    confidence_score = Column(Float)
    status = Column(String, default="pending_review")
    file = relationship("BillOfSaleFile", back_populates="extracted")


class HsnRecommendation(Base):
    """Stores AI-generated HSN recommendations for invoices with missing HSN codes."""
    __tablename__ = "hsn_recommendations"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("uploaded_files.id"), unique=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"), index=True)
    item_description = Column(Text)          # The input text used for matching
    recommended_hsn = Column(String)         # Best HSN code from master
    recommended_hsn_description = Column(Text)  # Matched description from master
    confidence_score = Column(Float, default=0.0)
    status = Column(String, default="NEEDS_REVIEW")  # AUTO / REVIEW / NEEDS_REVIEW
    top_alternatives = Column(Text)          # JSON string of [{hsn_cd, description, score}]
    reasoning = Column(Text)                 # One-line AI explanation
    accepted_hsn = Column(String, nullable=True)    # Set when reviewer accepts
    reviewed_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=__import__('datetime').datetime.utcnow)
    updated_at = Column(DateTime, default=__import__('datetime').datetime.utcnow, onupdate=__import__('datetime').datetime.utcnow)


class TaxTypeMismatch(Base):
    __tablename__ = "tax_type_mismatches"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("extracted_invoices.id"), unique=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id"), index=True)
    is_mismatch = Column(Integer, default=0)  # 0: No, 1: Yes
    determined_supply_type = Column(String)  # INTRA_STATE, INTER_STATE, UNKNOWN
    expected_tax_type = Column(String)       # CGST+SGST, IGST, UNKNOWN
    actual_tax_type = Column(String)         # CGST+SGST, IGST, BOTH, NONE
    reason = Column(Text)                    # Detailed explanation
    suggestion = Column(Text)                # Correction logic
    status = Column(String, default="CLEARED")  # CLEARED, MISMATCH, NEEDS_REVIEW
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoice = relationship("ExtractedInvoice")
