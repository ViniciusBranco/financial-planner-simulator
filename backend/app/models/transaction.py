import uuid
import enum
from sqlalchemy import Column, String, Numeric, Date, Enum, JSON, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"

class CategoryEnum(str, enum.Enum):
    HOUSING = "Moradia"
    DOGS = "Dogs"
    FOOD = "Alimentação"
    TRANSPORT = "Transporte"
    HEALTH = "Saúde"
    LEISURE = "Lazer"
    STREAMING = "Streaming"
    SUBSCRIPTIONS = "Assinaturas"
    SHOPPING = "Compras"
    EDUCATION = "Educação"
    FINANCIAL = "Serviços Financeiros"
    DIVERSIFIED = "Serviços Diversos"
    INVESTMENTS = "Investimentos"
    SALARY = "Salário"
    REVENUE = "Receita"
    UNCATEGORIZED = "Não Categorizado"

class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=True)

    transactions = relationship("Transaction", back_populates="category_rel")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    
    # We keep the old category column for now to avoid breaking the app immediately, 
    # but the new relational structure is category_id.
    category_legacy = Column("category", String, nullable=True) 
    
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    
    type = Column(Enum(TransactionType), nullable=False)
    
    # New fields for detailed tracking
    payment_method = Column(String, nullable=True) # e.g. "Flash", "Alelo", "CC"
    manual_tag = Column(String, nullable=True) # e.g. "Classif" from CSV
    is_recurring = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    raw_data = Column("metadata", JSON, nullable=True) 

    # XP / Import Fields
    cardholder = Column(String, nullable=True)
    installment_current = Column("installment_n", Integer, nullable=True)
    installment_total = Column("installment_total", Integer, nullable=True)
    source_type = Column(String, default="MANUAL", nullable=False) # XP_CARD, XP_ACCOUNT, MANUAL 
    reference_date = Column(Date, nullable=False) 

    category_rel = relationship("Category", back_populates="transactions")

    def __repr__(self):
        return f"<Transaction(date={self.date}, desc={self.description}, amount={self.amount})>"
