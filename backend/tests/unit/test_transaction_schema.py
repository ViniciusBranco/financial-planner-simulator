import pytest
from app.schemas.transaction import TransactionCreate
from app.models.transaction import TransactionType
from decimal import Decimal
from datetime import date

def test_transaction_create_schema_coercion():
    payload = {
        "description": "Teste",
        "amount": "10.50",
        "date": "2026-02-28",
        "type": "INCOME",
        "source_type": "XP_ACCOUNT"
    }
    
    # This should parse correctly despite strict=True mode on TransactionBase
    transaction = TransactionCreate(**payload)
    
    assert transaction.description == "Teste"
    assert transaction.amount == Decimal("10.50")
    assert transaction.date == date(2026, 2, 28)
    assert transaction.type == TransactionType.INCOME

def test_transaction_create_schema_expense_polarity():
    payload = {
        "description": "Teste Despesa",
        "amount": "10.50",
        "date": "2026-02-28",
        "type": "EXPENSE",
        "source_type": "XP_ACCOUNT"
    }
    
    # This should parse correctly and invert the amount
    transaction = TransactionCreate(**payload)
    
    assert transaction.amount == Decimal("-10.50")
