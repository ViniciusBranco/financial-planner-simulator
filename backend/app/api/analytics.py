from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.services.analytics import AnalyticsService

router = APIRouter()

@router.get("/average-spending")
async def get_average_spending(
    source: str = Query('XP_CARD'),
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the average and median monthly spending for a given source over the last N months.
    Excludes the current month.
    """
    return await AnalyticsService.calculate_average_spending(db, source_type=source, months=months)
