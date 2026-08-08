import { apiFetch } from "@/lib/api-fetch";

export type RemoteSupportStatus =
  | "waiting_attendant"
  | "attendant_joined"
  | "sharing"
  | "ended";

export type RemoteSupportRole = "cliente" | "atendente";

export type RemoteSupportSessao = {
  id: number;
  codigo: string;
  codigoFormatado: string;
  clienteId: number;
  clienteNome: string;
  atendenteId: number | null;
  atendenteNome: string | null;
  status: RemoteSupportStatus;
  resolucao: string | null;
  webrtcState: string | null;
  clienteOnline: boolean;
  atendenteOnline: boolean;
  connectedAt: string | null;
  sharingAt: string | null;
  endedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

export type RemoteSupportMensagem = {
  id: number;
  remetente: RemoteSupportRole;
  remetenteNome: string;
  texto: string;
  createdAt: string;
};

export type RemoteSupportSinal = {
  id: number;
  remetente: RemoteSupportRole;
  tipo: "offer" | "answer" | "ice";
  payload: unknown;
  createdAt: string;
};

type OkSessao = { ok: true; sessao: RemoteSupportSessao; error?: string };
type Fail = { ok: false; error?: string };
type PollOk = {
  ok: true;
  sessao: RemoteSupportSessao;
  mensagens: RemoteSupportMensagem[];
  sinais: RemoteSupportSinal[];
};

const CLIENT = "/api/suporte-remoto";
const ADMIN = "/api/admin/suporte-remoto";

function base(role: RemoteSupportRole) {
  return role === "atendente" ? ADMIN : CLIENT;
}

export async function criarSessaoRemota() {
  const res = await apiFetch(CLIENT, { method: "POST" });
  return res.json() as Promise<OkSessao | Fail>;
}

export async function entrarSessaoRemota(codigo: string) {
  const res = await apiFetch(ADMIN, {
    method: "POST",
    body: JSON.stringify({ codigo }),
  });
  return res.json() as Promise<OkSessao | Fail>;
}

export async function pollSessaoRemota(
  role: RemoteSupportRole,
  sessaoId: number,
  afterMessage = 0,
  afterSignal = 0,
) {
  const params = new URLSearchParams({
    afterMessage: String(afterMessage),
    afterSignal: String(afterSignal),
  });
  const res = await apiFetch(`${base(role)}/${sessaoId}?${params.toString()}`);
  return res.json() as Promise<PollOk | Fail>;
}

export async function postSessaoRemota(
  role: RemoteSupportRole,
  sessaoId: number,
  body: Record<string, unknown>,
) {
  const res = await apiFetch(`${base(role)}/${sessaoId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json() as Promise<
    | { ok: true; sessao?: RemoteSupportSessao; mensagem?: RemoteSupportMensagem; error?: string }
    | Fail
  >;
}

export function formatElapsed(from: string | Date | null | undefined) {
  if (!from) return "00:00";
  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return "00:00";
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function webrtcLabel(state: string | null | undefined) {
  const map: Record<string, string> = {
    new: "novo",
    connecting: "conectando",
    connected: "conectado",
    disconnected: "desconectado",
    failed: "falhou",
    closed: "encerrado",
  };
  return map[String(state || "new")] || state || "novo";
}

export function onlyDigits(value: string, max = 6) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}
