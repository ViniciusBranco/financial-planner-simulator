import pytest
import httpx

@pytest.mark.asyncio
async def test_create_transaction_coercion():
    url = "http://localhost:8000/transactions/"
    payload = {
        "description": "Teste Integracao Strict Type",
        "amount": "10.50",
        "date": "2026-02-28",
        "source_type": "XP_ACCOUNT",
        "type": "INCOME"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert data["description"] == "Teste Integracao Strict Type"
    assert data["amount"] == "10.50"
    assert data["type"] == "INCOME"
