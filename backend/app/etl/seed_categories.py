
import asyncio
import logging
from app.core.database import AsyncSessionLocal
from app.models.transaction import Category, CategoryEnum, TransactionType
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CATEGORY_TYPE_MAP = {
    CategoryEnum.HOUSING: TransactionType.EXPENSE,
    CategoryEnum.DOGS: TransactionType.EXPENSE,
    CategoryEnum.FOOD: TransactionType.EXPENSE,
    CategoryEnum.TRANSPORT: TransactionType.EXPENSE,
    CategoryEnum.HEALTH: TransactionType.EXPENSE,
    CategoryEnum.LEISURE: TransactionType.EXPENSE,
    CategoryEnum.STREAMING: TransactionType.EXPENSE,
    CategoryEnum.SUBSCRIPTIONS: TransactionType.EXPENSE,
    CategoryEnum.SHOPPING: TransactionType.EXPENSE,
    CategoryEnum.EDUCATION: TransactionType.EXPENSE,
    CategoryEnum.FINANCIAL: TransactionType.EXPENSE,
    CategoryEnum.DIVERSIFIED: TransactionType.EXPENSE,
    CategoryEnum.INVESTMENTS: TransactionType.EXPENSE,  # User can change to TRANSFER if preferred
    CategoryEnum.SALARY: TransactionType.INCOME,
    CategoryEnum.REVENUE: TransactionType.INCOME,
    CategoryEnum.UNCATEGORIZED: TransactionType.EXPENSE,
}

async def seed_categories():
    async with AsyncSessionLocal() as session:
        logger.info("Starting Category Seed...")
        
        for cat_enum in CategoryEnum:
            cat_name = cat_enum.value
            cat_type = CATEGORY_TYPE_MAP.get(cat_enum, TransactionType.EXPENSE)
            
            # Check if exists
            stmt = select(Category).where(Category.name == cat_name)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if not existing:
                logger.info(f"Creating category: {cat_name} ({cat_type})")
                new_cat = Category(name=cat_name, type=cat_type)
                session.add(new_cat)
            else:
                logger.debug(f"Category already exists: {cat_name}")
        
        await session.commit()
        logger.info("Category Seed Completed!")

if __name__ == "__main__":
    asyncio.run(seed_categories())
