from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, Date, Enum
from sqlalchemy.orm import relationship
from app.models.transaction import Base, TransactionType

class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)

    items = relationship("ScenarioItem", back_populates="scenario", cascade="all, delete-orphan")

class ScenarioItem(Base):
    __tablename__ = "scenario_items"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    description = Column(String)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    
    # We can use a specific date to trigger this item. 
    # If it's recurring, it starts on this date.
    start_date = Column(Date, nullable=False)
    
    installments = Column(Integer, default=1)
    is_recurring = Column(Boolean, default=False)
    source_type = Column(String, default="MANUAL", nullable=False)

    scenario = relationship("Scenario", back_populates="items")
