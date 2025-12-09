from pydantic import BaseModel, model_validator
from typing import List, Optional
from datetime import date
from app.models.transaction import TransactionType

class ScenarioItemBase(BaseModel):
    description: str
    amount: float
    type: TransactionType
    start_date: date
    installments: int = 1
    is_recurring: bool = False
    source_type: str = "MANUAL"

class ScenarioItemCreate(ScenarioItemBase):
    @model_validator(mode='after')
    def check_amount_polarity(self):
        if self.type == TransactionType.EXPENSE and self.amount > 0:
            self.amount = -self.amount
        elif self.type == TransactionType.INCOME and self.amount < 0:
            self.amount = abs(self.amount)
        return self

class ScenarioItem(ScenarioItemBase):
    id: int
    scenario_id: int

    class Config:
        from_attributes = True

class ScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None

class ScenarioCreate(ScenarioBase):
    pass

class Scenario(ScenarioBase):
    id: int
    items: List[ScenarioItem] = []

    class Config:
        from_attributes = True

class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
