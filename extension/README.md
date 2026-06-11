# CadBrasil — Extensão Assistente SICAF

Extensão de browser (Chrome / Edge / Firefox) que abre o **side panel** no portal ComprasNet/SICAF e carrega o chat IA via iframe do portal CadBrasil.

## Instalação (Chrome — desenvolvimento)

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione a pasta `extension/dist/chrome`  
   (ou `extension/` para desenvolvimento; gere o build com `build-browser-packages.ps1`)

## URLs de desenvolvimento

A extensão detecta automaticamente o portal em:

- `http://localhost:5173` (Vite — frontend)
- `http://localhost:8080` / `8081`
- `http://localhost:3001` (backend — fallback)

O chat é carregado em **`/sicaf-assistant-chat`** (iframe). As APIs ficam em **`/api/sicaf-assistant/*`** (proxy → backend `:3001`).

## Fluxo

```
ComprasNet/SICAF  →  content.js (lê tela)
       ↓
sidepanel.js  →  iframe → /sicaf-assistant-chat
       ↓
POST /api/sicaf-assistant/chat  →  OpenAI (backend)
```

## Build multi-browser

```powershell
cd extension
.\build-browser-packages.ps1
```

Saída em `extension/dist/chrome`, `dist/edge`, `dist/firefox`.

## Configuração

- Validação CNPJ: `GET /api/clients/consulta-cnpj` (header `x-api-key` se `CNPJ_CONSULTA_API_KEY` estiver no `.env` do backend)
- Token JWT: passado via `?token=` na URL do iframe ou `localStorage` do portal
