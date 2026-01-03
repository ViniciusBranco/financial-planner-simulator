from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.models.scenario import Scenario, ScenarioItem
from app.schemas.scenario import ScenarioCreate, Scenario as ScenarioSchema, ScenarioItemCreate

router = APIRouter()

@router.get("/", response_model=List[ScenarioSchema])
async def get_scenarios(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).options(selectinload(Scenario.items)))
    return result.scalars().all()

@router.post("/", response_model=ScenarioSchema)
async def create_scenario(scenario: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    db_scenario = Scenario(**scenario.dict())
    db.add(db_scenario)
    await db.commit()
    await db.commit()
    
    # Re-fetch to ensure relationship is loaded (avoids MissingGreenlet and empty list hack)
    result = await db.execute(
        select(Scenario).options(selectinload(Scenario.items)).where(Scenario.id == db_scenario.id)
    )
    db_scenario = result.scalars().first()
    
    return db_scenario

@router.get("/{scenario_id}", response_model=ScenarioSchema)
async def get_scenario(scenario_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).options(selectinload(Scenario.items)).where(Scenario.id == scenario_id))
    scenario = result.scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

@router.post("/{scenario_id}/items", response_model=ScenarioSchema)
async def add_scenario_item(scenario_id: int, item: ScenarioItemCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    db_item = ScenarioItem(**item.dict(), scenario_id=scenario_id)
    db.add(db_item)
    await db.commit()
    
    # Return updated scenario
    result = await db.execute(select(Scenario).options(selectinload(Scenario.items)).where(Scenario.id == scenario_id))
    return result.scalars().first()

@router.delete("/{scenario_id}")
async def delete_scenario(scenario_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    await db.delete(scenario)
    await db.commit()
    
    return {"message": "Scenario deleted successfully"}
