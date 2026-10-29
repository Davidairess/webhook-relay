import time
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx

from app.models import WebhookEvent, ReplayRequest, ReplayResponse
from app.storage import store
from app.ws_manager import manager

app = FastAPI(
    title="Webhook Relay & Inspector",
    description="Captura, inspeciona e retransmite webhooks em tempo real com WebSockets.",
    version="1.0.0"
)

# Habilita CORS amplo para desenvolvimento
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>Painel em construção...</h1>")
    return FileResponse(index_file)

# -------------------------------------------------------------
# WEBSOCKET
# -------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Mantém conexão ativa para ping/pong
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# -------------------------------------------------------------
# CATCH-ALL WEBHOOK RECEPTOR
# -------------------------------------------------------------
@app.api_route("/webhook", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
@app.api_route("/webhook/{subpath:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def catch_webhook(request: Request, subpath: str = ""):
    # 1. Extração do corpo
    raw_body_bytes = await request.body()
    body_str = raw_body_bytes.decode("utf-8", errors="replace") if raw_body_bytes else None

    # Tenta fazer parse de JSON se aplicável
    json_data = None
    if body_str:
        try:
            json_data = json.loads(body_str)
        except Exception:
            json_data = None

    # 2. Extração de cabeçalhos e query params
    headers_dict = dict(request.headers)
    query_params_dict = dict(request.query_params)
    client_ip = request.client.host if request.client else "unknown"

    event_id = str(uuid.uuid4())
    event_timestamp = datetime.now(timezone.utc).isoformat()
    content_type = headers_dict.get("content-type", "text/plain")

    full_path = f"/webhook/{subpath}" if subpath else "/webhook"

    event = WebhookEvent(
        id=event_id,
        timestamp=event_timestamp,
        method=request.method.upper(),
        path=full_path,
        client_ip=client_ip,
        headers=headers_dict,
        query_params=query_params_dict,
        body=body_str,
        json_data=json_data,
        content_type=content_type,
        size_bytes=len(raw_body_bytes)
    )

    # Armazena
    store.add(event)

    # Notifica via WebSocket em tempo real para os navegadores conectados
    await manager.broadcast({
        "type": "NEW_EVENT",
        "event": event.model_dump()
    })

    return {
        "status": "success",
        "message": "Webhook captured successfully",
        "id": event.id,
        "timestamp": event.timestamp
    }

# -------------------------------------------------------------
# API REST (Histórico e Inspeção)
# -------------------------------------------------------------
@app.get("/api/events")
async def list_events():
    return [e.model_dump() for e in store.list_all()]

@app.get("/api/events/{event_id}")
async def get_event(event_id: str):
    event = store.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return event.model_dump()

@app.delete("/api/events")
async def clear_events():
    store.clear()
    await manager.broadcast({"type": "CLEAR_EVENTS"})
    return {"status": "ok", "message": "Histórico limpo com sucesso"}

# -------------------------------------------------------------
# REPLAY / RETRANSMISSÃO
# -------------------------------------------------------------
@app.post("/api/replay", response_model=ReplayResponse)
async def replay_webhook(payload: ReplayRequest):
    event = store.get(payload.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Webhook não encontrado para retransmissão")

    # Filtra headers que causam conflito ao reenviar
    headers_to_forward = {}
    excluded_headers = {"host", "content-length", "connection"}
    for k, v in event.headers.items():
        if k.lower() not in excluded_headers:
            headers_to_forward[k] = v

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.request(
                method=event.method,
                url=payload.target_url,
                headers=headers_to_forward,
                params=event.query_params,
                content=event.body.encode("utf-8") if event.body else None
            )
            elapsed_ms = (time.time() - start_time) * 1000.0

            return ReplayResponse(
                status_code=resp.status_code,
                response_time_ms=round(elapsed_ms, 2),
                headers=dict(resp.headers),
                body=resp.text[:2000]  # Limita para visualização
            )
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000.0
        return ReplayResponse(
            status_code=502,
            response_time_ms=round(elapsed_ms, 2),
            headers={},
            body=f"Erro ao conectar com o destino: {str(e)}"
        )
