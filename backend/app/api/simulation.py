from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import date, timedelta
import polars as pl
from dateutil.relativedelta import relativedelta

from app.core.database import get_db
from app.models.transaction import Transaction, TransactionType
from app.models.recurring import RecurringTransaction

router = APIRouter()

@router.get("/projection")
async def get_simulation_projection(
    months: int = Query(12, ge=1, le=60),
    scenario_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Project future financial state based on:
    1. Active Recurring Transactions
    2. Remaining Installments from existing Transactions
    3. (Optional) Scenario Overlay
    """
    
    today = date.today()
    # Start projection from next month to allow "clean" look? 
    # Or include current month remainder? 
    # Usually forecasting starts 'next month' or full current month if we ignore actuals.
    # Let's start from *next* month to avoid conflict with partially filled current month for now,
    # or let's say "Future Baseline".
    start_date = (today.replace(day=1) + relativedelta(months=1))
    
    # Generate Headers
    month_headers = []
    projection_dates = []
    for i in range(months):
        d = start_date + relativedelta(months=i)
        projection_dates.append(d)
        month_headers.append(d.strftime("%b %Y"))
        
    line_items = []

    # --- PART A: RECURRING TRANSACTIONS ---
    q_recurring = select(RecurringTransaction).where(RecurringTransaction.is_active == True)
    res_recurring = await db.execute(q_recurring)
    recurring_txs = res_recurring.scalars().all()
    
    for tmpl in recurring_txs:
        values = []
        
        # Tuple comparison for robustness (Year, Month)
        s_ym = (tmpl.start_date.year, tmpl.start_date.month)
        e_ym = (tmpl.end_date.year, tmpl.end_date.month) if tmpl.end_date else None
        
        for d in projection_dates:
            p_ym = (d.year, d.month)
            
            # target >= start
            after_start = p_ym >= s_ym
            
            # target <= end (if end exists)
            before_end = True
            if e_ym:
                before_end = p_ym <= e_ym
                
            if after_start and before_end:
                values.append(float(tmpl.amount))
            else:
                values.append(0.0)
            
            
        line_items.append({
            "name": tmpl.description,
            "type": tmpl.type,
            "values": values,
            "source": tmpl.source_type
        })

    # --- PART B: EXISTING INSTALLMENTS ---
    # Time Window: Only consider active plans from the last 90 days
    cutoff_date = today - timedelta(days=90)
    
    q_installments = select(Transaction).where(
        Transaction.installment_total > 1,
        Transaction.installment_current != None,
        Transaction.date >= cutoff_date
    )
    res_installments = await db.execute(q_installments)
    tx_rows = res_installments.scalars().all()
    
    if tx_rows:
        data = []
        for tx in tx_rows:
            data.append({
                "description": tx.description,
                "amount": float(tx.amount),
                "total_installments": tx.installment_total,
                "current_installment": tx.installment_current,
                "date": tx.reference_date or tx.date, # Fallback to tx.date if ref missing
                "type": tx.type,
                "source": tx.source_type
            })
            
        df = pl.DataFrame(data)
        
        if not df.is_empty():
            # Normalize description for grouping
            df = df.with_columns(
                pl.col('description').str.to_lowercase().str.strip_chars().alias('norm_desc')
            )
            
            # Group by unique plan identifiers: Description + Total Installments
            # We pick the LATEST transaction by Date to see where we stand
            latest_txs = df.sort("date").group_by(['norm_desc', 'total_installments']).last()
            
            for row in latest_txs.to_dicts():
                total = row['total_installments']
                max_n = row['current_installment']
                last_date = row['date']
                
                # Validation: Only project if plan is NOT finished
                if max_n < total:
                    remaining = total - max_n
                    
                    # Values for projection
                    amount = row['amount']
                    tx_type = row['type']
                    original_desc = row['description']
                    source = row['source']
                    
                    values = [0.0] * months
                    next_due = last_date + relativedelta(months=1)
                    
                    due_dates = []
                    current_d = next_due
                    for _ in range(remaining):
                        due_dates.append((current_d.year, current_d.month))
                        current_d += relativedelta(months=1)
                        
                    for i, p_date in enumerate(projection_dates):
                        if (p_date.year, p_date.month) in due_dates:
                            # Amount is already signed in DB usually
                            values[i] = amount 
                    
                    if any(v != 0 for v in values):
                        line_items.append({
                            "name": original_desc + f" ({max_n + 1}/{total})", # Enhanced label
                            "type": tx_type,
                            "values": values,
                            "source": source
                        })

    # --- PART C: SCENARIO OVERLAY ---
    if scenario_id:
        from app.models.scenario import Scenario
        from sqlalchemy.orm import selectinload
        
        q_scenario = select(Scenario).options(selectinload(Scenario.items)).where(Scenario.id == scenario_id)
        res_scenario = await db.execute(q_scenario)
        scenario_obj = res_scenario.scalars().first()
        
        if scenario_obj:
            for item in scenario_obj.items:
                values = [0.0] * months
                amount = float(item.amount)
                signed_amount = amount
                
                if item.is_recurring:
                    # Recurring from start_date
                    s_ym = (item.start_date.year, item.start_date.month)
                    for i, p_date in enumerate(projection_dates):
                        if (p_date.year, p_date.month) >= s_ym:
                            values[i] = signed_amount
                else:
                    # Finite Installments
                    due_dates = set()
                    current_d = item.start_date
                    for _ in range(item.installments):
                        due_dates.add((current_d.year, current_d.month))
                        current_d += relativedelta(months=1)
                        
                    for i, p_date in enumerate(projection_dates):
                        if (p_date.year, p_date.month) in due_dates:
                            values[i] = signed_amount

                line_items.append({
                    "name": f"[{scenario_obj.name}] {item.description}",
                    "type": item.type,
                    "values": values,
                    "source": item.source_type
                })

    return {
        "month_headers": month_headers,
        "items": line_items
    }
