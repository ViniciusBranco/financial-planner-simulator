from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional
from decimal import Decimal
from uuid import UUID
from datetime import date
from app.models.transaction import TransactionType

class RecurringTransactionBase(BaseModel):
    model_config = ConfigDict(strict=True)

    description: str
    amount: Decimal
    type: TransactionType
    category_id: Optional[UUID] = None
    category_legacy: Optional[str] = None
    is_active: bool = True
    day_of_month: int = 1
    start_date: date
    end_date: Optional[date] = None
    source_type: str = "XP_ACCOUNT"

class RecurringTransactionCreate(RecurringTransactionBase):
    @model_validator(mode='after')
    def check_amount_polarity(self):
        if self.type == TransactionType.EXPENSE and self.amount > 0:
            self.amount = -self.amount
        elif self.type == TransactionType.INCOME and self.amount < 0:
            self.amount = abs(self.amount)
        return self

class RecurringTransactionUpdate(RecurringTransactionBase):
    model_config = ConfigDict(strict=True)

    description: Optional[str] = None
    amount: Optional[Decimal] = None
    type: Optional[TransactionType] = None
    is_active: Optional[bool] = None
    day_of_month: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    source_type: Optional[str] = None

    @model_validator(mode='after')
    def check_amount_polarity(self):
        if self.type is not None and self.amount is not None:
            if self.type == TransactionType.EXPENSE and self.amount > 0:
                self.amount = -self.amount
            elif self.type == TransactionType.INCOME and self.amount < 0:
                self.amount = abs(self.amount)
        return self

class RecurringTransactionResponse(RecurringTransactionBase):
    id: UUID

    class Config:
        from_attributes = True
