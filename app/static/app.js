let events = [];
let selectedEventId = null;
let ws = null;

// DOM Elements
const eventsList = document.getElementById('events-list');
const emptyState = document.getElementById('empty-state');
const noSelection = document.getElementById('no-selection');
const detailsContainer = document.getElementById('details-container');
const searchInput = document.getElementById('search-input');
const wsStatus = document.getElementById('ws-status');
const wsStatusText = document.getElementById('ws-status-text');
const copyUrlBtn = document.getElementById('copy-url-btn');
const clearBtn = document.getElementById('clear-btn');

// Detail Elements
const detailMethodBadge = document.getElementById('detail-method-badge');
const detailPath = document.getElementById('detail-path');
const detailTime = document.getElementById('detail-time');
const payloadCode = document.getElementById('payload-code');
const payloadType = document.getElementById('payload-type');
const headersTableBody = document.getElementById('headers-table-body');
const queryTableBody = document.getElementById('query-table-body');
const headersCount = document.getElementById('headers-count');
const queryCount = document.getElementById('query-count');
const copyCurlBtn = document.getElementById('copy-curl-btn');
const copyPayloadBtn = document.getElementById('copy-payload-btn');

// Modal Elements
const openReplayBtn = document.getElementById('open-replay-btn');
const replayModal = document.getElementById('replay-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelReplayBtn = document.getElementById('cancel-replay-btn');
const executeReplayBtn = document.getElementById('execute-replay-btn');
const replayUrlInput = document.getElementById('replay-url-input');
const replayResult = document.getElementById('replay-result');
const replayStatusBadge = document.getElementById('replay-status-badge');
const replayLatency = document.getElementById('replay-latency');
const replayBodyCode = document.getElementById('replay-body-code');

// Cores por método HTTP
const METHOD_COLORS = {
  POST: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  GET: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  PUT: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  PATCH: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  DELETE: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
  DEFAULT: 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
};

function getMethodClass(method) {
  return METHOD_COLORS[method.toUpperCase()] || METHOD_COLORS.DEFAULT;
}

// -------------------------------------------------------------
// WEBSOCKET
// -------------------------------------------------------------
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    wsStatus.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    wsStatusText.textContent = 'Conectado (Ao Vivo)';
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_EVENT') {
        events.unshift(data.event);
        renderEvents();
        // Se for o primeiro evento, seleciona automaticamente
        if (events.length === 1 && !selectedEventId) {
          selectEvent(data.event.id);
        }
      } else if (data.type === 'CLEAR_EVENTS') {
        events = [];
        selectedEventId = null;
        renderEvents();
        showNoSelection();
      }
    } catch (e) {
      console.error('Erro ao processar mensagem do WebSocket:', e);
    }
  };

  ws.onclose = () => {
    wsStatus.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20';
    wsStatusText.textContent = 'Reconectando...';
    setTimeout(initWebSocket, 2000);
  };
}

// -------------------------------------------------------------
// FETCH INICIAL
// -------------------------------------------------------------
async function fetchEvents() {
  try {
    const res = await fetch('/api/events');
    events = await res.json();
    renderEvents();
    if (events.length > 0 && !selectedEventId) {
      selectEvent(events[0].id);
    }
  } catch (err) {
    console.error('Erro ao buscar eventos:', err);
  }
}

// -------------------------------------------------------------
// RENDERIZAÇÃO DA LISTA LATERAL
// -------------------------------------------------------------
function renderEvents() {
  const filter = searchInput.value.toLowerCase().trim();
  const filtered = events.filter(e => 
    e.method.toLowerCase().includes(filter) || 
    e.path.toLowerCase().includes(filter)
  );

  if (filtered.length === 0) {
    eventsList.innerHTML = '';
    eventsList.appendChild(emptyState);
    return;
  }

  eventsList.innerHTML = '';

  filtered.forEach(ev => {
    const isSelected = ev.id === selectedEventId;
    const timeFormatted = new Date(ev.timestamp).toLocaleTimeString();
    const sizeKb = (ev.size_bytes / 1024).toFixed(1);

    const item = document.createElement('div');
    item.className = `p-3.5 cursor-pointer transition-all border-l-2 ${
      isSelected 
        ? 'bg-blue-600/10 border-blue-500 text-white' 
        : 'border-transparent hover:bg-slate-800/60 text-slate-300'
    }`;
    item.onclick = () => selectEvent(ev.id);

    item.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11px] font-bold px-2 py-0.5 rounded ${getMethodClass(ev.method)}">${ev.method}</span>
        <span class="text-[10px] text-slate-500 font-mono">${timeFormatted}</span>
      </div>
      <div class="text-xs font-mono font-medium truncate mb-1 text-slate-200">${ev.path}</div>
      <div class="flex items-center justify-between text-[10px] text-slate-500">
        <span>IP: ${ev.client_ip}</span>
        <span>${sizeKb} KB</span>
      </div>
    `;

    eventsList.appendChild(item);
  });

  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// SELEÇÃO & INSPEÇÃO DE EVENTO
// -------------------------------------------------------------
function selectEvent(id) {
  selectedEventId = id;
  const ev = events.find(e => e.id === id);
  if (!ev) return;

  renderEvents();

  noSelection.classList.add('hidden');
  detailsContainer.classList.remove('hidden');

  // Cabeçalho dos detalhes
  detailMethodBadge.textContent = ev.method;
  detailMethodBadge.className = `px-2.5 py-1 rounded text-xs font-extrabold uppercase ${getMethodClass(ev.method)}`;
  detailPath.textContent = ev.path;
  detailTime.textContent = new Date(ev.timestamp).toLocaleString();

  // Payload
  payloadType.textContent = ev.content_type;
  if (ev.json_data) {
    payloadCode.textContent = JSON.stringify(ev.json_data, null, 2);
  } else if (ev.body) {
    payloadCode.textContent = ev.body;
  } else {
    payloadCode.textContent = '// Nenhum corpo enviado nesta requisição';
  }

  // Headers Table
  headersTableBody.innerHTML = '';
  const headerKeys = Object.keys(ev.headers);
  headersCount.textContent = headerKeys.length;

  headerKeys.sort().forEach(key => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/80';
    tr.innerHTML = `
      <td class="py-2 px-4 text-blue-400 font-semibold select-text">${key}</td>
      <td class="py-2 px-4 break-all select-text">${ev.headers[key]}</td>
    `;
    headersTableBody.appendChild(tr);
  });

  // Query Params Table
  queryTableBody.innerHTML = '';
  const queryKeys = Object.keys(ev.query_params);
  queryCount.textContent = queryKeys.length;

  if (queryKeys.length === 0) {
    queryTableBody.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-slate-500">Nenhum parâmetro de query (?chave=valor)</td></tr>`;
  } else {
    queryKeys.sort().forEach(key => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/80';
      tr.innerHTML = `
        <td class="py-2 px-4 text-amber-400 font-semibold select-text">${key}</td>
        <td class="py-2 px-4 break-all select-text">${ev.query_params[key]}</td>
      `;
      queryTableBody.appendChild(tr);
    });
  }

  if (window.lucide) lucide.createIcons();
}

function showNoSelection() {
  noSelection.classList.remove('hidden');
  detailsContainer.classList.add('hidden');
}

// -------------------------------------------------------------
// TABS NAVIGATION
// -------------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    const targetTab = btn.getAttribute('data-tab');

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.className = 'tab-btn py-3 text-slate-400 hover:text-slate-200';
    });
    btn.className = 'tab-btn py-3 text-blue-400 border-b-2 border-blue-400';

    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${targetTab}`).classList.remove('hidden');
  };
});

// -------------------------------------------------------------
// GERADOR DE CURL
// -------------------------------------------------------------
copyCurlBtn.onclick = () => {
  const ev = events.find(e => e.id === selectedEventId);
  if (!ev) return;

  const url = `${window.location.origin}${ev.path}`;
  let curl = `curl -X ${ev.method} "${url}"`;

  for (const [k, v] of Object.entries(ev.headers)) {
    if (!['host', 'content-length'].includes(k.toLowerCase())) {
      curl += ` \\\n  -H "${k}: ${v}"`;
    }
  }

  if (ev.body) {
    curl += ` \\\n  -d '${ev.body.replace(/'/g, "'\\''")}'`;
  }

  navigator.clipboard.writeText(curl);
  showToast('Comando cURL copiado!');
};

// Copiar Payload
copyPayloadBtn.onclick = () => {
  const text = payloadCode.textContent;
  navigator.clipboard.writeText(text);
  showToast('Payload copiado!');
};

// Copiar URL do Webhook
copyUrlBtn.onclick = () => {
  const url = `${window.location.origin}/webhook`;
  navigator.clipboard.writeText(url);
  showToast(`URL copiada: ${url}`);
};

// Limpar Histórico
clearBtn.onclick = async () => {
  if (confirm('Deseja limpar todo o histórico de webhooks?')) {
    await fetch('/api/events', { method: 'DELETE' });
  }
};

// Busca em tempo real
searchInput.oninput = () => renderEvents();

// -------------------------------------------------------------
// REPLAY MODAL LOGIC
// -------------------------------------------------------------
openReplayBtn.onclick = () => {
  replayResult.classList.add('hidden');
  replayModal.classList.remove('hidden');
  replayModal.classList.add('flex');
};

function closeModal() {
  replayModal.classList.add('hidden');
  replayModal.classList.remove('flex');
}

closeModalBtn.onclick = closeModal;
cancelReplayBtn.onclick = closeModal;

executeReplayBtn.onclick = async () => {
  const targetUrl = replayUrlInput.value.trim();
  if (!targetUrl) {
    alert('Por favor, informe a URL de destino.');
    return;
  }

  executeReplayBtn.disabled = true;
  executeReplayBtn.innerHTML = '<span class="animate-spin">⏳</span> Disparando...';

  try {
    const res = await fetch('/api/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_url: targetUrl,
        event_id: selectedEventId
      })
    });

    const data = await res.json();
    replayResult.classList.remove('hidden');

    replayStatusBadge.textContent = `${data.status_code}`;
    if (data.status_code >= 200 && data.status_code < 300) {
      replayStatusBadge.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    } else {
      replayStatusBadge.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
    }

    replayLatency.textContent = `Latência: ${data.response_time_ms} ms`;
    replayBodyCode.textContent = data.body || '// Sem resposta no corpo';
  } catch (err) {
    alert('Erro ao disparar replay: ' + err.message);
  } finally {
    executeReplayBtn.disabled = false;
    executeReplayBtn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Disparar Replay</span>';
    if (window.lucide) lucide.createIcons();
  }
};

// Toast notification simples
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-5 right-5 bg-blue-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-blue-400/30 z-50 animate-bounce';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// Iniciação
initWebSocket();
fetchEvents();
if (window.lucide) lucide.createIcons();
