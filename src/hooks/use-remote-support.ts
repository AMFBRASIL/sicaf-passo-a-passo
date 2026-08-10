import { useCallback, useEffect, useRef, useState } from "react";
import {
  pollSessaoRemota,
  postSessaoRemota,
  type RemoteLaserPoint,
  type RemoteSupportMensagem,
  type RemoteSupportRole,
  type RemoteSupportSessao,
  type RemoteSupportSinal,
} from "@/lib/suporte-remoto-api";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

const POINTER_HTTP_MIN_MS = 120;
const CLICK_TTL_MS = 700;

type Options = {
  role: RemoteSupportRole;
  sessaoId: number | null;
  enabled?: boolean;
};

export type RemoteLaserClick = RemoteLaserPoint & { id: number };

type LaserMsg =
  | { t: "m"; x: number; y: number }
  | { t: "c"; x: number; y: number }
  | { t: "h" };

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function useRemoteSupport({ role, sessaoId, enabled = true }: Options) {
  const [sessao, setSessao] = useState<RemoteSupportSessao | null>(null);
  const [mensagens, setMensagens] = useState<RemoteSupportMensagem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [webrtcState, setWebrtcState] = useState<string>("new");
  const [resolucao, setResolucao] = useState<string | null>(null);
  const [laserPoint, setLaserPoint] = useState<RemoteLaserPoint | null>(null);
  const [laserClicks, setLaserClicks] = useState<RemoteLaserClick[]>([]);
  const [laserReady, setLaserReady] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const afterMessageRef = useRef(0);
  const afterSignalRef = useRef(0);
  const inFlightRef = useRef(false);
  const makingOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessaoIdRef = useRef(sessaoId);
  const roleRef = useRef(role);
  const lastPointerHttpRef = useRef(0);
  const clickSeqRef = useRef(0);
  const laserHideTimerRef = useRef<number | null>(null);

  sessaoIdRef.current = sessaoId;
  roleRef.current = role;

  const clearLaserHideTimer = useCallback(() => {
    if (laserHideTimerRef.current != null) {
      window.clearTimeout(laserHideTimerRef.current);
      laserHideTimerRef.current = null;
    }
  }, []);

  const pushLaserClick = useCallback((x: number, y: number) => {
    const id = ++clickSeqRef.current;
    const point = { id, x: clamp01(x), y: clamp01(y) };
    setLaserClicks((prev) => [...prev.slice(-8), point]);
    window.setTimeout(() => {
      setLaserClicks((prev) => prev.filter((c) => c.id !== id));
    }, CLICK_TTL_MS);
  }, []);

  const applyLaserMessage = useCallback(
    (msg: LaserMsg) => {
      if (msg.t === "h") {
        setLaserPoint(null);
        return;
      }
      if (msg.t === "m") {
        clearLaserHideTimer();
        setLaserPoint({ x: clamp01(msg.x), y: clamp01(msg.y) });
        laserHideTimerRef.current = window.setTimeout(() => setLaserPoint(null), 2500);
        return;
      }
      if (msg.t === "c") {
        clearLaserHideTimer();
        setLaserPoint({ x: clamp01(msg.x), y: clamp01(msg.y) });
        pushLaserClick(msg.x, msg.y);
        laserHideTimerRef.current = window.setTimeout(() => setLaserPoint(null), 2500);
      }
    },
    [clearLaserHideTimer, pushLaserClick],
  );

  const wireDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.binaryType = "arraybuffer";

      const syncReady = () => setLaserReady(channel.readyState === "open");
      channel.onopen = () => syncReady();
      channel.onclose = () => {
        if (dataChannelRef.current === channel) dataChannelRef.current = null;
        setLaserReady(false);
      };
      channel.onerror = () => syncReady();
      channel.onmessage = (ev) => {
        if (roleRef.current !== "cliente") return;
        try {
          const raw = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data);
          const msg = JSON.parse(raw) as LaserMsg;
          if (!msg || typeof msg !== "object" || !("t" in msg)) return;
          applyLaserMessage(msg);
        } catch {
          /* ignore */
        }
      };
      syncReady();
    },
    [applyLaserMessage],
  );

  const sendSignal = useCallback(
    async (
      tipo: "offer" | "answer" | "ice" | "pointer" | "click",
      payload: unknown,
      extra: Record<string, unknown> = {},
    ) => {
      const id = sessaoIdRef.current;
      if (!id) return;
      await postSessaoRemota(roleRef.current, id, {
        acao: "sinal",
        tipo,
        payload,
        ...extra,
      });
    },
    [],
  );

  const sendLaserPayload = useCallback(
    (msg: LaserMsg) => {
      const ch = dataChannelRef.current;
      if (ch && ch.readyState === "open") {
        try {
          ch.send(JSON.stringify(msg));
          return true;
        } catch {
          /* fallback HTTP */
        }
      }
      return false;
    },
    [],
  );

  const enviarPonteiro = useCallback(
    (point: RemoteLaserPoint | null) => {
      if (roleRef.current !== "atendente") return;
      if (!point) {
        if (!sendLaserPayload({ t: "h" })) {
          const now = Date.now();
          if (now - lastPointerHttpRef.current >= POINTER_HTTP_MIN_MS) {
            lastPointerHttpRef.current = now;
            void sendSignal("pointer", { t: "h" });
          }
        }
        return;
      }
      const msg: LaserMsg = { t: "m", x: clamp01(point.x), y: clamp01(point.y) };
      if (sendLaserPayload(msg)) return;
      const now = Date.now();
      if (now - lastPointerHttpRef.current < POINTER_HTTP_MIN_MS) return;
      lastPointerHttpRef.current = now;
      void sendSignal("pointer", msg);
    },
    [sendLaserPayload, sendSignal],
  );

  const enviarCliqueLaser = useCallback(
    (point: RemoteLaserPoint) => {
      if (roleRef.current !== "atendente") return;
      const msg: LaserMsg = { t: "c", x: clamp01(point.x), y: clamp01(point.y) };
      // feedback local no atendente
      pushLaserClick(msg.x, msg.y);
      if (sendLaserPayload(msg)) return;
      void sendSignal("click", msg);
    },
    [pushLaserClick, sendLaserPayload, sendSignal],
  );

  const flushIce = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const queued = pendingIceRef.current.splice(0);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* candidato atrasado */
      }
    }
  }, []);

  const closePc = useCallback(() => {
    pendingIceRef.current = [];
    const channel = dataChannelRef.current;
    dataChannelRef.current = null;
    if (channel) {
      try {
        channel.onopen = null;
        channel.onclose = null;
        channel.onerror = null;
        channel.onmessage = null;
        channel.close();
      } catch {
        /* ignore */
      }
    }
    setLaserReady(false);
    setLaserPoint(null);
    setLaserClicks([]);
    clearLaserHideTimer();

    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.ondatachannel = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    setWebrtcState("closed");
    setRemoteStream(null);
  }, [clearLaserHideTimer]);

  const stopLocalTracks = useCallback(() => {
    const stream = localStreamRef.current;
    localStreamRef.current = null;
    setLocalStream(null);
    setSharing(false);
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const ensurePc = useCallback(() => {
    if (pcRef.current && pcRef.current.connectionState !== "closed") return pcRef.current;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      void sendSignal("ice", {
        candidate: ev.candidate.candidate,
        sdpMid: ev.candidate.sdpMid,
        sdpMLineIndex: ev.candidate.sdpMLineIndex,
      });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] || new MediaStream([ev.track]);
      setRemoteStream(stream);
      const settings = ev.track.getSettings?.();
      if (settings?.width && settings?.height) {
        setResolucao(`${settings.width}x${settings.height}`);
      }
    };

    pc.ondatachannel = (ev) => {
      if (ev.channel?.label === "laser") wireDataChannel(ev.channel);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setWebrtcState(state);
      const id = sessaoIdRef.current;
      if (!id) return;
      void postSessaoRemota(roleRef.current, id, {
        acao: "status",
        webrtcState: state,
      });
    };

    return pc;
  }, [sendSignal, wireDataChannel]);

  const handleSignal = useCallback(
    async (sinal: RemoteSupportSinal) => {
      const tipo = sinal.tipo;
      const payload = sinal.payload;

      if (tipo === "pointer" || tipo === "click") {
        if (roleRef.current !== "cliente") return;
        if (sinal.remetente !== "atendente") return;
        const msg = payload as LaserMsg;
        if (!msg || typeof msg !== "object" || !("t" in msg)) return;
        applyLaserMessage(msg);
        return;
      }

      if (!payload) return;

      if (tipo === "ice") {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingIceRef.current.push(payload as RTCIceCandidateInit);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
        } catch {
          /* ignore */
        }
        return;
      }

      if (tipo === "offer" && roleRef.current === "atendente") {
        const queuedIce = pendingIceRef.current.slice();
        closePc();
        pendingIceRef.current = queuedIce;
        const pc = ensurePc();
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal("answer", { type: answer.type, sdp: answer.sdp }, { webrtcState: pc.connectionState });
        return;
      }

      if (tipo === "answer" && roleRef.current === "cliente") {
        const pc = pcRef.current;
        if (!pc) return;
        if (pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        await flushIce(pc);
      }
    },
    [applyLaserMessage, closePc, ensurePc, flushIce, sendSignal],
  );

  useEffect(() => {
    if (!enabled || !sessaoId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await pollSessaoRemota(
          roleRef.current,
          sessaoId,
          afterMessageRef.current,
          afterSignalRef.current,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error || "Atendimento indisponível.");
          return;
        }
        setError(null);
        setSessao(res.sessao);
        if (res.mensagens.length) {
          afterMessageRef.current = Math.max(afterMessageRef.current, ...res.mensagens.map((m) => m.id));
          setMensagens((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const extra = res.mensagens.filter((m) => !seen.has(m.id));
            return extra.length ? [...prev, ...extra] : prev;
          });
        }
        if (res.sinais.length) {
          afterSignalRef.current = Math.max(afterSignalRef.current, ...res.sinais.map((s) => s.id));
          for (const sinal of res.sinais) {
            try {
              await handleSignal(sinal);
            } catch {
              /* signaling parcial */
            }
          }
        }
        if (res.sessao.status === "ended") {
          stopLocalTracks();
          closePc();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao atualizar atendimento.");
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, sessaoId, handleSignal, closePc, stopLocalTracks]);

  useEffect(() => {
    return () => {
      stopLocalTracks();
      closePc();
    };
  }, [closePc, stopLocalTracks]);

  useEffect(() => {
    afterMessageRef.current = 0;
    afterSignalRef.current = 0;
    pendingIceRef.current = [];
    setMensagens([]);
    setError(null);
    setResolucao(null);
    setLaserPoint(null);
    setLaserClicks([]);
    stopLocalTracks();
    closePc();
    setWebrtcState("new");
    if (!sessaoId) setSessao(null);
  }, [sessaoId, closePc, stopLocalTracks]);

  const enviarMensagem = useCallback(async (texto: string) => {
    const id = sessaoIdRef.current;
    if (!id) return { ok: false, error: "Atendimento não iniciado." };
    const res = await postSessaoRemota(roleRef.current, id, { acao: "mensagem", texto });
    if (res.ok && res.mensagem) {
      afterMessageRef.current = Math.max(afterMessageRef.current, res.mensagem.id);
      setMensagens((prev) => (prev.some((m) => m.id === res.mensagem!.id) ? prev : [...prev, res.mensagem!]));
    }
    return res;
  }, []);

  const encerrar = useCallback(async () => {
    const id = sessaoIdRef.current;
    stopLocalTracks();
    closePc();
    if (!id) return { ok: true };
    const res = await postSessaoRemota(roleRef.current, id, { acao: "encerrar" });
    if (res.ok && res.sessao) setSessao(res.sessao);
    else setSessao((prev) => (prev ? { ...prev, status: "ended" } : prev));
    return res;
  }, [closePc, stopLocalTracks]);

  const pararCompartilhamento = useCallback(async () => {
    stopLocalTracks();
    closePc();
    setResolucao(null);
    const id = sessaoIdRef.current;
    if (!id) return;
    await postSessaoRemota(roleRef.current, id, { acao: "parar-compartilhamento", webrtcState: "closed" });
  }, [closePc, stopLocalTracks]);

  const compartilharTela = useCallback(async () => {
    if (roleRef.current !== "cliente") return { ok: false, error: "Apenas o cliente compartilha a tela." };
    if (!sessaoIdRef.current) return { ok: false, error: "Atendimento não iniciado." };
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      return { ok: false, error: "Seu navegador não permite compartilhar a tela." };
    }

    try {
      makingOfferRef.current = true;
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setSharing(true);

      const video = stream.getVideoTracks()[0];
      const settings = video?.getSettings?.();
      const resLabel =
        settings?.width && settings?.height ? `${settings.width}x${settings.height}` : null;
      if (resLabel) setResolucao(resLabel);

      video?.addEventListener("ended", () => {
        void pararCompartilhamento();
      });

      closePc();
      const pc = ensurePc();
      const laserChannel = pc.createDataChannel("laser", { ordered: false, maxRetransmits: 0 });
      wireDataChannel(laserChannel);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("offer", { type: offer.type, sdp: offer.sdp }, {
        resolucao: resLabel,
        webrtcState: pc.connectionState,
      });
      await postSessaoRemota(roleRef.current, sessaoIdRef.current, {
        acao: "compartilhando",
        resolucao: resLabel,
        webrtcState: pc.connectionState,
      });
      return { ok: true };
    } catch (err) {
      stopLocalTracks();
      closePc();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        return { ok: false, error: "Compartilhamento cancelado no navegador." };
      }
      return { ok: false, error: err instanceof Error ? err.message : "Não foi possível compartilhar a tela." };
    } finally {
      makingOfferRef.current = false;
    }
  }, [closePc, ensurePc, pararCompartilhamento, sendSignal, stopLocalTracks, wireDataChannel]);

  return {
    sessao,
    mensagens,
    error,
    sharing,
    localStream,
    remoteStream,
    webrtcState,
    resolucao: resolucao || sessao?.resolucao || null,
    laserPoint,
    laserClicks,
    laserReady,
    enviarMensagem,
    enviarPonteiro,
    enviarCliqueLaser,
    encerrar,
    compartilharTela,
    pararCompartilhamento,
    setSessao,
  };
}
