# ⚡ Webhook Relay & Inspector

> **Serviço moderno, open source e em tempo real para capturar, inspecionar e retransmitir webhooks com WebSockets e interface dark mode.**

[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-orange.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📌 Por que o Webhook Relay existe?
Desenvolver integrações que dependem de **Webhooks** (como Stripe, Mercado Pago, GitHub, Twilio ou Shopify) costuma ser frustrante:
* Serviços externos cobram por túneis ou limitam históricos.
* Inspecionar cabeçalhos de autenticação e assinaturas criptográficas (`X-Signature`) sem uma ferramenta visual é demorado.
* Reenviar um payload que falhou no seu código local exige disparar todo o fluxo da plataforma novamente.

O **`Webhook Relay & Inspector`** resolve isso: ele roda localmente ou na sua VPS, recebe as requisições em tempo real via **WebSockets**, permite inspecionar cada detalhe (headers, JSON, queries) e retransmitir (*replay*) para o seu backend local com 1 clique!

---

## ✨ Funcionalidades Principais

- ⚡ **Tempo Real com WebSockets:** Receba eventos instantaneamente na tela sem precisar recarregar a página (`F5`).
- 🎯 **Catch-All Receptivo:** Aceita qualquer método HTTP (`POST`, `GET`, `PUT`, `PATCH`, `DELETE`) em `/webhook` e subrotas (ex: `/webhook/stripe/payments`).
- 🔄 **Webhook Replay:** Retransmita qualquer evento capturado para um endpoint local (ex: `http://localhost:3000/api/webhook`) e veja a resposta e a latência na hora.
- 📋 **Gerador de cURL:** Copie a requisição exata com headers e body formatados para rodar no seu terminal.
- 🎨 **Dashboard Dark Mode:** Interface rápida e responsiva construída com Tailwind CSS, busca instantânea e formatação de JSON.
- 🐳 **Docker-Ready:** Suba a aplicação completa em segundos usando Docker Compose.

---

## 🚀 Como Executar Localmente

### Opção 1: Com Python

```bash
# 1. Clonar o repositório
git clone https://github.com/Davidairess/webhook-relay.git
cd webhook-relay

# 2. Criar e ativar o ambiente virtual
python -m venv .venv

# No Windows:
.\.venv\Scripts\activate
# No Linux / macOS:
source .venv/bin/activate

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Iniciar o servidor
uvicorn app.main:app --reload --port 8000
```

Abra seu navegador em **`http://localhost:8000`** para acessar o painel!

---

### Opção 2: Com Docker Compose (1 comando)

```bash
docker compose up -d
```
Acesse `http://localhost:8000`.

---

## 🧪 Como Testar o Envio de Webhooks

Com o painel aberto no navegador, abra outro terminal e dispare um evento de teste:

### Exemplo 1: Webhook com JSON (POST)
```bash
curl -X POST "http://localhost:8000/webhook/stripe" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=161234,v1=abcdef0123456789" \
  -d '{
    "id": "evt_1MvXYZ",
    "type": "payment_intent.succeeded",
    "data": {
      "amount": 9900,
      "currency": "brl",
      "customer": "cus_david"
    }
  }'
```

*O evento aparecerá instantaneamente no seu painel com badge verde `POST`, cabeçalhos destacados e syntax highlighting!*

---

## 📂 Estrutura do Projeto

```text
webhook-relay/
├── .github/workflows/ci.yml   # Pipeline de CI automático
├── app/
│   ├── __init__.py
│   ├── main.py                # Rotas da API, receptor de webhook e WebSocket
│   ├── models.py              # Modelos Pydantic (WebhookEvent, Replay)
│   ├── storage.py             # Armazenamento em memória com buffer circular
│   ├── ws_manager.py          # Gerenciador de conexões WebSockets ativas
│   └── static/
│       ├── index.html         # Dashboard SPA moderno
│       └── app.js             # Lógica reativa de WebSockets e Replay
├── tests/
│   └── test_webhook.py        # Suíte de testes automatizados com pytest-asyncio
├── Dockerfile                 # Imagem container otimizada
├── docker-compose.yml         # Orquestração local em 1 comando
├── pytest.ini                 # Configuração do pytest
├── requirements.txt           # Dependências de produção e testes
└── README.md                  # Documentação completa
```

---

## 🧪 Testes Automatizados

Para rodar os testes unitários assíncronos:

```bash
pytest -v
```

---

## 📜 Licença
Distribuído sob a licença **MIT**. Veja `LICENSE` para detalhes.
