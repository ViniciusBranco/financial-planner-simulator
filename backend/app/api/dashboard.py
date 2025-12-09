from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Optional, List, Dict

from app.core.database import get_db
from app.models.transaction import Transaction, TransactionType, Category

router = APIRouter()

@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    year: int = Query(2025)
):
    """
    Returns aggregated data for the dashboard:
    - Total Income/Expense for the year
    - Monthly breakdown
    """
    
    # Monthly breakdown
    # We want: Month, Income, Expense
    
    query = select(
        func.extract('month', Transaction.reference_date).label('month'),
        func.sum(case((Transaction.type == TransactionType.INCOME, Transaction.amount), else_=0)).label('income'),
        func.sum(case((Transaction.type == TransactionType.EXPENSE, Transaction.amount), else_=0)).label('expense')
    ).filter(
        func.extract('year', Transaction.reference_date) == year,
        Transaction.type.in_([TransactionType.INCOME, TransactionType.EXPENSE])
    ).group_by(
        func.extract('month', Transaction.reference_date)
    ).order_by(
        func.extract('month', Transaction.reference_date)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    monthly_data = []
    total_income = 0
    total_expense = 0
    
    # Initialize all 12 months with 0
    data_map = {m: {"income": 0, "expense": 0} for m in range(1, 13)}
    
    for row in rows:
        m = int(row.month)
        inc = float(row.income or 0)
        exp = float(row.expense or 0)
        
        data_map[m]["income"] = inc
        data_map[m]["expense"] = exp
        
        total_income += inc
        total_expense += exp
        
    for m in range(1, 13):
        monthly_data.append({
            "month": m,
            "income": data_map[m]["income"],
            "expense": data_map[m]["expense"]
        })
        
    return {
        "year": year,
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income + total_expense,
        "monthly_data": monthly_data
    }

@router.get("/breakdown")
async def get_dashboard_breakdown(
    db: AsyncSession = Depends(get_db),
    year: int = Query(2025),
    month: Optional[int] = Query(None)
):
    # 1. Source Breakdown
    query_source = select(
        Transaction.source_type,
        func.sum(Transaction.amount).label('total')
    ).filter(
        func.extract('year', Transaction.reference_date) == year
    )
    
    if month:
        query_source = query_source.filter(func.extract('month', Transaction.reference_date) == month)
        
    query_source = query_source.group_by(Transaction.source_type)
    
    res_source = await db.execute(query_source)
    by_source = {row.source_type: float(row.total or 0) for row in res_source}

    # 2. Category Breakdown
    # Prioritize Category.name, then legacy, then 'Uncategorized'
    cat_field = func.coalesce(Category.name, Transaction.category_legacy, 'Uncategorized')
    
    query_cat = select(
        cat_field.label('name'),
        Transaction.type,
        func.sum(Transaction.amount).label('value')
    ).outerjoin(
        Category, Transaction.category_id == Category.id
    ).filter(
        func.extract('year', Transaction.reference_date) == year,
        Transaction.type != TransactionType.TRANSFER
    )
    
    if month:
        query_cat = query_cat.filter(func.extract('month', Transaction.reference_date) == month)
        
    query_cat = query_cat.group_by(cat_field, Transaction.type).order_by(func.sum(Transaction.amount))
    
    res_cat = await db.execute(query_cat)
    by_category = [
        {"name": row.name, "type": row.type, "value": float(row.value or 0)}
        for row in res_cat.all()
    ]
    
    return {
        "by_source": by_source,
        "by_category": by_category
    }
