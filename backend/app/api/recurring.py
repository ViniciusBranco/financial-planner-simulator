from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.models.recurring import RecurringTransaction
from app.schemas.recurring import RecurringTransactionCreate, RecurringTransactionResponse, RecurringTransactionUpdate

router = APIRouter()

@router.get("/", response_model=List[RecurringTransactionResponse])
async def get_recurring_transactions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RecurringTransaction))
    return result.scalars().all()

@router.post("/", response_model=RecurringTransactionResponse)
async def create_recurring_transaction(
    tx: RecurringTransactionCreate,
    db: AsyncSession = Depends(get_db)
):
    db_tx = RecurringTransaction(**tx.model_dump())
    db.add(db_tx)
    await db.commit()
    await db.refresh(db_tx)
    return db_tx

@router.put("/{tx_id}", response_model=RecurringTransactionResponse)
async def update_recurring_transaction(
    tx_id: UUID,
    tx_update: RecurringTransactionUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(RecurringTransaction).where(RecurringTransaction.id == tx_id))
    db_tx = result.scalar_one_or_none()
    if not db_tx:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    update_data = tx_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tx, key, value)
    
    await db.commit()
    await db.refresh(db_tx)
    return db_tx

@router.delete("/{tx_id}")
async def delete_recurring_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(RecurringTransaction).where(RecurringTransaction.id == tx_id))
    db_tx = result.scalar_one_or_none()
    if not db_tx:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    await db.delete(db_tx)
    await db.commit()
    return {"status": "success"}
