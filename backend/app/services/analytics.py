from datetime import date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from statistics import mean, median

from app.models.transaction import Transaction, TransactionType

class AnalyticsService:
    @staticmethod
    async def calculate_average_spending(
        db: AsyncSession, 
        source_type: str = 'XP_CARD', 
        months: int = 12
    ) -> Dict[str, any]:
        """
        Calculates the average monthly spending for a specific source over the last N months.
        Excludes the current month to ensure complete data.
        """
        
        # 1. Determine Date Range
        today = date.today()
        # First day of current month
        current_month_start = date(today.year, today.month, 1)
        
        # End date is the last day of the previous month (essentially < current_month_start)
        end_date = current_month_start - timedelta(days=1)
        
        # Start date: Go back N months from current_month_start
        # Simple approximation for start date: subtract 365 days / 12 * months? 
        # Better: Strict month calculation
        
        # Helper to subtract months
        def subtract_months(dt, n):
            year = dt.year
            month = dt.month
            
            new_month = month - n
            while new_month <= 0:
                new_month += 12
                year -= 1
            return date(year, new_month, 1)

        start_date = subtract_months(current_month_start, months)
        
        # 2. Query
        # We group by Year-Month
        query = select(
            func.extract('year', Transaction.reference_date).label('year'),
            func.extract('month', Transaction.reference_date).label('month'),
            func.sum(Transaction.amount).label('total')
        ).where(
            and_(
                Transaction.source_type == source_type,
                Transaction.type == TransactionType.EXPENSE,
                Transaction.reference_date >= start_date,
                Transaction.reference_date < current_month_start
            )
        ).group_by(
            func.extract('year', Transaction.reference_date),
            func.extract('month', Transaction.reference_date)
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        # 3. Process Data
        # Ensure we have absolute values since EXPENSE is negative often? 
        # Actually in this DB, EXPENSE is signed? The previous prompt said "liability... is negative".
        # Let's assume expenses are stored as negative or positive, but usually for "spending" we want magnitude.
        # Let's check `TransactionTable.tsx`... if amount > 0 is INCOME, amount < 0 is EXPENSE.
        # So sum will be negative. We take abs().
        
        monthly_totals = []
        for row in rows:
            val = float(row.total or 0)
            monthly_totals.append(abs(val))
            
        # Handle empty case
        if not monthly_totals:
            return {
                "average": 0.0,
                "median": 0.0,
                "history": [],
                "count": 0
            }
            
        avg_val = mean(monthly_totals)
        med_val = median(monthly_totals)
        
        return {
            "average": avg_val,
            "median": med_val,
            "history": monthly_totals,
            "count": len(monthly_totals)
        }
