from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine
from app.models.transaction import Base
from app.api import transactions, dashboard, recurring, simulation, scenarios

app = FastAPI(title="Personal Finance API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# @app.on_event("startup")
# async def startup():
#     # Create tables on startup (convenient for dev)
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)

app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(recurring.router, prefix="/recurring", tags=["Recurring"])
app.include_router(simulation.router, prefix="/simulation", tags=["Simulation"])
app.include_router(scenarios.router, prefix="/scenarios", tags=["Scenarios"])

@app.get("/")
def read_root():
    return {"message": "Finance API is running"}
