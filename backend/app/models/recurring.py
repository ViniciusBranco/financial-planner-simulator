from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, Enum, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.models.transaction import Base, TransactionType

class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    category_legacy = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    day_of_month = Column(Integer, default=1, nullable=False)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    source_type = Column(String, default="XP_ACCOUNT", nullable=False)
    
    category_rel = relationship("Category")

    def __repr__(self):
        return f"<RecurringTransaction(desc={self.description}, amount={self.amount})>"
