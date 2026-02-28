from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete

from typing import Optional, List
from uuid import UUID
from datetime import date
import calendar
from pydantic import BaseModel, ConfigDict

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
    source_type: Optional[str] = None,
    sort_by: Optional[str] = Query("date", regex="^(date|amount|description|category|source_type)$"),
    sort_order: Optional[str] = Query("desc", regex="^(asc|desc)$"),
    unverified_only: bool = False
):
    print(f"DEBUG: get_transactions sort_by={sort_by} sort_order={sort_order} unverified_only={unverified_only}")
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
    if unverified_only:
        query = query.filter(Transaction.is_verified == False)
        
    # Count total
    # We need to be careful with the count query when using joins
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Sorting
    if sort_by == "date":
        sort_col = Transaction.date
    elif sort_by == "amount":
        sort_col = Transaction.amount
    elif sort_by == "description":
        sort_col = Transaction.description
    elif sort_by == "category":
        sort_col = func.coalesce(Category.name, Transaction.category_legacy)
    elif sort_by == "source_type":
        sort_col = Transaction.source_type
    else:
        sort_col = Transaction.date

    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Secondary sort by date always useful (or ID) to ensure stability
    if sort_by != "date":
        query = query.order_by(Transaction.date.desc())

    # Pagination
    query = query.offset(skip).limit(limit)
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
    manual_reference_date: Optional[date] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    override_reference_date = manual_reference_date

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
    model_config = ConfigDict(strict=True)

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
    
    # Logic to link category_id if category name is provided
    if 'category_legacy' in update_data:
        cat_name = update_data['category_legacy']
        if cat_name:
            # Check if this category exists in DB (efficient enough for single update)
            stmt = select(Category).where(Category.name == cat_name)
            res = await db.execute(stmt)
            category = res.scalar_one_or_none()
            
            if category:
                db_transaction.category_id = category.id
            else:
                # If custom text not matching any category, unlink from previous category
                # so the frontend displays the legacy text instead of the old linked category name
                db_transaction.category_id = None
        else:
             # If cleared
             db_transaction.category_id = None

    # Sync reference_date if date is changed and reference_date is not manually set
    # This prevents the bug where moving a transaction's date doesn't move it to the correct month view.
    # We apply this for all types for now, as requested.
    if 'date' in update_data and 'reference_date' not in update_data:
        update_data['reference_date'] = update_data['date']

    for key, value in update_data.items():
        setattr(db_transaction, key, value)
        
    db_transaction.is_verified = True
    await db.commit()
    await db.refresh(db_transaction)
    
    # Eager load the category name to return correct response
    # We might need to refetch or manually set it for the response model
    if db_transaction.category_id:
         stmt = select(Category.name).where(Category.id == db_transaction.category_id)
         res = await db.execute(stmt)
         cat_name = res.scalar_one_or_none()
         # Check if response model has field for category_name, typically 'category_legacy' might be used or extra field
         # TransactionResponse has category_name
         # We can't easily patch the db_transaction object with a non-column field without simple hacks
         pass 

    return db_transaction

@router.delete("/batch-delete")
async def batch_delete_transactions(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    source_type: Optional[str] = None,
    category_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    stmt = delete(Transaction).where(
        Transaction.reference_date >= start_date,
        Transaction.reference_date <= end_date
    )

    if source_type:
        stmt = stmt.where(Transaction.source_type == source_type)
    
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)

    result = await db.execute(stmt)
    await db.commit()
    
    return {
        "deleted_count": result.rowcount,
        "message": f"Deleted {result.rowcount} transactions"
    }

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
    model_config = ConfigDict(strict=True)

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


@router.post("/auto-categorize")
async def auto_categorize_transactions(
    limit: int = Query(100, ge=1, le=100),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    from app.services.categorizer import AICategorizer
    from app.models.transaction import CategoryEnum
    
    # Initialize Categorizer
    categorizer = AICategorizer()
    await categorizer.load_history(db)
    
    # 1. Get ID for "Não Categorizado"
    stmt_uncat = select(Category).where(Category.name == CategoryEnum.UNCATEGORIZED.value)
    res_uncat = await db.execute(stmt_uncat)
    uncat_category = res_uncat.scalar_one_or_none()
    
    if not uncat_category:
        return {"processed": 0, "message": "Category 'Não Categorizado' not found."}
        
    uncat_id = uncat_category.id
    
    # 2. Build Query
    stmt_tx = select(Transaction)
    
    if month and year:
        # Month-specific mode
        _, last_day = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)
        
        stmt_tx = stmt_tx.where(
            Transaction.reference_date >= start_date,
            Transaction.reference_date <= end_date
        )
        
        if not force:
            # Only uncat
            stmt_tx = stmt_tx.where(
                (Transaction.category_id == None) | (Transaction.category_id == uncat_id)
            )
        else:
            # Force mode: re-evaluate ALL transactions in that month
            # BUT: Do not overwrite verified transactions
            stmt_tx = stmt_tx.where(Transaction.is_verified == False)
            
        # If month/year is specified, we might want to process ALL of them, not just 100.
        # But to be safe, maybe increase limit or just remove it? 
        # User said "Select ALL".
        # We won't apply .limit(limit) here.
        
    else:
        # Standard mode: Next N uncategorized
        # Also ensure we don't pick up verified ones that happen to be uncategorized (unlikely but possible)
        stmt_tx = stmt_tx.where(
            (Transaction.category_id == None) | (Transaction.category_id == uncat_id)
        ).where(Transaction.is_verified == False).limit(limit)
    
    result_tx = await db.execute(stmt_tx)
    transactions = result_tx.scalars().all()
    
    if not transactions:
        return {"processed": 0, "message": "No uncategorized transactions found."}
        
    # Pre-fetch all categories for looking up IDs
    stmt_cats = select(Category)
    res_cats = await db.execute(stmt_cats)
    all_categories = {c.name: c.id for c in res_cats.scalars().all()}
    
    processed_count = 0
    updated_count = 0
    
    for tx in transactions:
        try:
            processed_count += 1
            # Skip if description is empty
            if not tx.description: 
                continue
                
            predicted_name = await categorizer.predict_category(tx.description, float(tx.amount), db=db)
            
            # If AI returns UNCAT, we don't need to change anything if it's already UNCAT.
            # But if it was NULL, we should set it to UNCAT ID.
            
            new_cat_id = all_categories.get(predicted_name)
            
            # Fallback to UNCAT if not found
            if not new_cat_id:
                new_cat_id = uncat_id
            
            # Update fields
            # Only update if it actually changes something meaningful 
            # (e.g. from NULL to UNCAT, or UNCAT to SOMETHING ELSE)
            if tx.category_id != new_cat_id:
                tx.category_id = new_cat_id
                tx.category_legacy = predicted_name
                tx.manual_tag = predicted_name # Store AI guess
                tx.is_verified = False # Automatic classification is not verified
                updated_count += 1
            elif tx.category_id == uncat_id and new_cat_id == uncat_id:
                 # It was UNCAT, and AI said UNCAT. 
                 # Maybe we just want to mark we tried? 
                 # For now, do nothing.
                 pass

        except Exception as e:
            print(f"Error auto-categorizing transaction {tx.id}: {e}")
            # Continue to next
            continue
            
    await db.commit()
    
    return {
        "processed": processed_count,
        "updated": updated_count,
        "message": f"Processed {processed_count} transactions. Updated {updated_count}. Run again to continue."
    }

class PayInvoiceRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    amount: float
    date: date
    account_source_id: Optional[str] = "XP_ACCOUNT"
    card_source_id: Optional[str] = "XP_CARD"

@router.post("/pay-invoice")
async def pay_invoice(
    request: PayInvoiceRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates two transactions to represent paying a credit card invoice:
    1. Debit from Checking Account (XP_ACCOUNT)
    2. Credit to Credit Card (XP_CARD) to reduce liability
    """
    
    # Ensure positive amount for calculation
    amt = abs(request.amount)
    
    # 1. Debit from Source Account
    debit_tx = Transaction(
        date=request.date,
        description="Pagamento Fatura Cartão",
        amount=-amt,
        type=TransactionType.TRANSFER,
        source_type=request.account_source_id,
        category_legacy="Transferência/Ajuste",
        reference_date=request.date,
        is_verified=True,
        manual_tag="InvoicePayment"
    )
    
    # 2. Credit to Card Source (Reduces the negative balance/liability)
    credit_tx = Transaction(
        date=request.date,
        description="Pagamento Recebido (Ajuste)",
        amount=amt,
        type=TransactionType.TRANSFER,
        source_type=request.card_source_id,
        category_legacy="Transferência/Ajuste",
        reference_date=request.date,
        is_verified=True,
        manual_tag="InvoicePayment"
    )
    
    db.add(debit_tx)
    db.add(credit_tx)
    await db.commit()
    
    return {"status": "success", "message": "Invoice payment recorded successfully"}
