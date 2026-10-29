import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.storage import store

@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()

@pytest.mark.asyncio
async def test_catch_post_webhook():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"event": "payment.succeeded", "amount": 1000}
        response = await client.post(
            "/webhook",
            json=payload,
            headers={"X-Custom-Signature": "sig_123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "id" in data

        # Verifica na listagem de eventos
        list_resp = await client.get("/api/events")
        assert list_resp.status_code == 200
        events = list_resp.json()
        assert len(events) == 1
        assert events[0]["method"] == "POST"
        assert events[0]["path"] == "/webhook"
        assert events[0]["json_data"] == payload
        assert events[0]["headers"]["x-custom-signature"] == "sig_123"

@pytest.mark.asyncio
async def test_catch_subpath_webhook():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put(
            "/webhook/stripe/v1/checkout",
            params={"source": "ecommerce"},
            content="raw text payload"
        )
        assert response.status_code == 200
        event_id = response.json()["id"]

        # Busca por ID específico
        detail_resp = await client.get(f"/api/events/{event_id}")
        assert detail_resp.status_code == 200
        event = detail_resp.json()
        assert event["method"] == "PUT"
        assert event["path"] == "/webhook/stripe/v1/checkout"
        assert event["query_params"]["source"] == "ecommerce"
        assert event["body"] == "raw text payload"

@pytest.mark.asyncio
async def test_clear_events():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/webhook", json={"test": 1})
        assert len(store.list_all()) == 1

        del_resp = await client.delete("/api/events")
        assert del_resp.status_code == 200
        assert len(store.list_all()) == 0
