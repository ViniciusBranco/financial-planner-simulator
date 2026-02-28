from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import date as date_type
from decimal import Decimal
from typing import Optional, Dict, Any, Annotated
from pydantic import BeforeValidator
from uuid import UUID
from app.models.transaction import TransactionType

class TransactionBase(BaseModel):
    model_config = ConfigDict(strict=True)

    date: date_type
    description: str
    amount: Decimal
    category_legacy: Optional[str] = None # Renamed from category to match model
    category_id: Optional[UUID] = None
    type: TransactionType
    
    payment_method: Optional[str] = None
    manual_tag: Optional[str] = None
    is_recurring: bool = False
    is_verified: bool = False
    
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="raw_data")
    
    cardholder: Optional[str] = None
    installment_current: Optional[int] = Field(default=None, alias="installment_n")
    installment_total: Optional[int] = None
    source_type: str = "MANUAL"
    reference_date: Optional[date_type] = None

def parse_date_str(v: Any) -> Any:
    if isinstance(v, str):
        try:
            return date_type.fromisoformat(v)
        except ValueError:
            pass
    return v

def parse_decimal_str(v: Any) -> Any:
    if isinstance(v, (str, float, int)):
        try:
            return Decimal(str(v))
        except Exception:
            pass
    return v

def parse_type_str(v: Any) -> Any:
    if isinstance(v, str):
        try:
            return TransactionType(v)
        except ValueError:
            pass
    return v

class TransactionCreate(TransactionBase):
    date: Annotated[date_type, BeforeValidator(parse_date_str)]
    amount: Annotated[Decimal, BeforeValidator(parse_decimal_str)]
    type: Annotated[TransactionType, BeforeValidator(parse_type_str)]

    @model_validator(mode='after')
    def check_amount_polarity(self):
        if self.type == TransactionType.EXPENSE and self.amount > 0:
            self.amount = -self.amount
        elif self.type == TransactionType.INCOME and self.amount < 0:
            self.amount = abs(self.amount)
        return self

class TransactionUpdate(BaseModel):
    model_config = ConfigDict(strict=True)

    date: Optional[date_type] = None
    amount: Optional[Decimal] = None
    category_legacy: Optional[str] = None
    category_id: Optional[UUID] = None
    description: Optional[str] = None
    type: Optional[TransactionType] = None
    payment_method: Optional[str] = None
    manual_tag: Optional[str] = None
    is_recurring: Optional[bool] = None
    is_verified: Optional[bool] = None

    @model_validator(mode='after')
    def check_amount_polarity(self):
        if self.type is not None and self.amount is not None:
            if self.type == TransactionType.EXPENSE and self.amount > 0:
                self.amount = -self.amount
            elif self.type == TransactionType.INCOME and self.amount < 0:
                self.amount = abs(self.amount)
        return self

class TransactionResponse(TransactionBase):
    id: UUID
    category_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class TransactionList(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    size: int
