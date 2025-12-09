from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete

from typing import Optional, List
from uuid import UUID
from datetime import date
import calendar
from pydantic import BaseModel

from app.core.database import get_db
from app.etl.importer import import_transactions_from_file
from app.models.transaction import Transaction, TransactionType, Category
from app.models.recurring import RecurringTransaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionList

router = APIRouter()

@router.get("/", response_model=TransactionList, response_model_by_alias=True)
async def get_transactions(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    category: Optional[str] = None,
    search: Optional[str] = None,
    is_recurring: Optional[bool] = None,
    source_type: Optional[str] = None
):
    # Start with a join to get category details efficiently
    query = select(Transaction, Category.name.label("category_name")).outerjoin(
        Category, Transaction.category_id == Category.id
    )
    
    if month:
        query = query.filter(func.extract('month', Transaction.reference_date) == month)
    if year:
        query = query.filter(func.extract('year', Transaction.reference_date) == year)
    if category:
        # We can filter by category name or legacy category
        query = query.filter(
            (Transaction.category_legacy == category) | (Category.name == category)
        )
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
    if is_recurring is not None:
        query = query.filter(Transaction.is_recurring == is_recurring)
    if source_type:
        query = query.filter(Transaction.source_type == source_type)
        
    # Count total
    # We need to be careful with the count query when using joins
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Pagination
    query = query.order_by(desc(Transaction.date)).offset(skip).limit(limit)
    result = await db.execute(query)
    
    # The result will be a list of (Transaction, category_name) tuples
    rows = result.all()
    
    items = []
    for tx, cat_name in rows:
        # Convert to dict using Pydantic to handle attribute mapping correctly
        tx_data = TransactionResponse.model_validate(tx).model_dump(by_alias=True)
        tx_data["category_name"] = cat_name
        items.append(tx_data)
    
    return TransactionList(items=items, total=total or 0, page=(skip // limit) + 1, size=limit)

@router.post("/", response_model=TransactionResponse, response_model_by_alias=True)
async def create_transaction(
    transaction: TransactionCreate,
    db: AsyncSession = Depends(get_db)
):
    db_transaction = Transaction(
        date=transaction.date,
        description=transaction.description,
        amount=transaction.amount,
        category_legacy=transaction.category_legacy,
        type=transaction.type,
        raw_data=transaction.metadata,
        reference_date=transaction.reference_date or transaction.date
    )
    db.add(db_transaction)
    await db.commit()
    await db.refresh(db_transaction)
    return db_transaction

@router.post("/upload")
async def upload_transactions(
    file: List[UploadFile] = File(...),
    reference_year: Optional[int] = Form(None),
    reference_month: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    override_reference_date = None
    if reference_year and reference_month:
        try:
            override_reference_date = date(reference_year, reference_month, 1)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid year or month.")

    results = []
    total_imported = 0

    for f in file:
        if not f.filename.endswith('.csv'):
            results.append({
                "filename": f.filename, 
                "status": "error", 
                "message": "Invalid file format. Only CSV allowed."
            })
            continue

        try:
            transactions, candidates = await import_transactions_from_file(f.file, f.filename, db, override_reference_date)
            count = len(transactions)
            total_imported += count
            results.append({
                "filename": f.filename, 
                "status": "success", 
                "count": count,
                "reconciliation_candidates": candidates
            })
        except Exception as e:
            results.append({
                "filename": f.filename, 
                "status": "error", 
                "message": f"Processing error: {str(e)}"
            })
            
    return {
        "status": "success",
        "total_imported": total_imported,
        "results": results
    }

class ProjectRequest(BaseModel):
    month: int
    year: int

@router.post("/project")
async def project_transactions(
    request: ProjectRequest,
    db: AsyncSession = Depends(get_db)
):
    query = select(RecurringTransaction).where(RecurringTransaction.is_active == True)
    result = await db.execute(query)
    recurring_txs = result.scalars().all()
    
    if not recurring_txs:
        return {"status": "success", "message": "No active recurring transactions found", "count": 0}

    new_transactions = []
    _, last_day = calendar.monthrange(request.year, request.month)

    for template in recurring_txs:
        target_day = min(template.day_of_month, last_day)
        tx_date = date(request.year, request.month, target_day)
        
        new_tx = Transaction(
            date=tx_date,
            description=template.description,
            amount=template.amount,
            category_id=template.category_id,
            category_legacy=template.category_legacy,
            type=template.type,
            reference_date=tx_date,
            source_type="RECURRING",
            is_recurring=True 
        )
        new_transactions.append(new_tx)
    
    if new_transactions:
        db.add_all(new_transactions)
        await db.commit()
    
    return {
        "status": "success", 
        "message": f"Generated {len(new_transactions)} transactions for {request.month}/{request.year}",
        "count": len(new_transactions)
    }

@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    transaction_update: TransactionUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Transaction).filter(Transaction.id == transaction_id))
    db_transaction = result.scalar_one_or_none()
    
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = transaction_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_transaction, key, value)
        
    await db.commit()
    await db.refresh(db_transaction)
    return db_transaction

@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    await db.delete(transaction)
    await db.commit()
    return None

class BulkDeleteRequest(BaseModel):
    ids: List[UUID]

@router.post("/bulk-delete", status_code=204)
async def bulk_delete_transactions(
    request: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db)
):
    if not request.ids:
        return
        
    stmt = delete(Transaction).where(Transaction.id.in_(request.ids))
    await db.execute(stmt)
    await db.commit()
    return None
