import sys
import os
import asyncio
# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.etl.importer import process_csv
import json
from decimal import Decimal
from datetime import date
import uuid

# Helper to serialize for printing
def default_serializer(obj):
    if isinstance(obj, (Decimal, date)):
        return str(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

async def main():
    transactions = await process_csv("test_data.csv")
    print(f"Found {len(transactions)} detailed records.")
    for t in transactions:
        print(f"{t['date']} | {t['type']} | {t['amount']} | {t['category_legacy']}")

if __name__ == "__main__":
    asyncio.run(main())
