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

@router.get("/health-ratio")
async def get_health_ratio(
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = Query(None)
):
    """
    Returns the financial health ratio (Liquidity / Liability).
    - Params: year (optional, strictly mainly considers ALL TIME up to reference date, but let's base it on the current snapshot).
    - Logic:
     - liquidity: Sum of amount where source_type IN ('XP_ACCOUNT', 'MANUAL').
     - liability: Sum of amount where source_type = 'XP_CARD'. (This should be negative).
     - coverage_ratio: (liquidity / abs(liability)) * 100.
    - Return: {"liquidity": float, "liability": float, "ratio": float, "status": "SURVIVAL" | "COMFORT"}.
     - Status is "COMFORT" if liquidity >= abs(liability).
    """

    # We calculate the running balance (sum of signed amounts).
    # If year is provided, we filter for transactions referencing a date up to the end of that year.
    # Otherwise, we sum everything (current snapshot).

    query = select(
        func.sum(
            case(
                (Transaction.source_type.in_(['XP_ACCOUNT', 'MANUAL']), Transaction.amount),
                else_=0
            )
        ).label('liquidity'),
        func.sum(
            case(
                (Transaction.source_type == 'XP_CARD', Transaction.amount),
                else_=0
            )
        ).label('liability')
    )

    if year:
        # Filter for all transactions up to the end of the specified year
        query = query.filter(func.extract('year', Transaction.reference_date) <= year)

    result = await db.execute(query)
    row = result.one()

    liquidity = float(row.liquidity or 0)
    liability = float(row.liability or 0)
    abs_liability = abs(liability)

    ratio = 0.0
    # Avoid division by zero
    if abs_liability > 0:
        ratio = (liquidity / abs_liability) * 100
    else:
        # If no liability, and we have positive liquidity, we are reasonably "100%" safe or more.
        if liquidity >= 0:
            ratio = 100.0  # Or treat as infinite coverage
    
    status = "SURVIVAL"
    # Status is "COMFORT" if liquidity >= abs(liability).
    # This implies we can pay off the debt immediately.
    if liquidity >= abs_liability:
        status = "COMFORT"

    return {
        "liquidity": liquidity,
        "liability": liability,
        "ratio": ratio,
        "status": status
    }
