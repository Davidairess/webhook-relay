from typing import List, Optional, Dict
from collections import deque
from app.models import WebhookEvent

MAX_HISTORY = 300

class WebhookStore:
    def __init__(self, max_size: int = MAX_HISTORY):
        self.max_size = max_size
        self._events: deque[WebhookEvent] = deque(maxlen=max_size)
        self._index: Dict[str, WebhookEvent] = {}

    def add(self, event: WebhookEvent) -> WebhookEvent:
        if len(self._events) >= self.max_size:
            # Se atingiu o limite, remove a referência do mais antigo
            oldest = self._events[0]
            self._index.pop(oldest.id, None)

        self._events.append(event)
        self._index[event.id] = event
        return event

    def list_all(self) -> List[WebhookEvent]:
        # Retorna da mais recente para a mais antiga
        return list(reversed(self._events))

    def get(self, event_id: str) -> Optional[WebhookEvent]:
        return self._index.get(event_id)

    def clear(self):
        self._events.clear()
        self._index.clear()

store = WebhookStore()
