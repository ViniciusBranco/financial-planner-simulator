from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core.database import engine
from app.models.transaction import Base
from app.api import transactions, dashboard, recurring, simulation, scenarios, analytics

app = FastAPI(title="Personal Finance API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("uvicorn.error")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    exc_str = f"Validation Error (422) for request {request.url}. Errors: {exc.errors()} - Body: {exc.body}"
    logger.error(exc_str)
    return JSONResponse(
        status_code=422,
        content={"message": "Validation Error", "details": exc.errors()}
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
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])

@app.get("/")
def read_root():
    return {"message": "Finance API is running"}
