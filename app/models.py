from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class WebhookEvent(BaseModel):
    id: str
    timestamp: str
    method: str
    path: str
    client_ip: str
    headers: Dict[str, str]
    query_params: Dict[str, str]
    body: Optional[str] = None
    json_data: Optional[Any] = None
    content_type: str = "text/plain"
    size_bytes: int = 0

class ReplayRequest(BaseModel):
    target_url: str = Field(..., description="URL de destino para retransmitir a requisição, ex: http://localhost:3000/webhook")
    event_id: str

class ReplayResponse(BaseModel):
    status_code: int
    response_time_ms: float
    headers: Dict[str, str]
    body: str
