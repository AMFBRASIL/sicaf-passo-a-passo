import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

export type LaserPoint = { x: number; y: number } | null;

export type LaserClickRipple = {
  id: number;
  x: number;
  y: number;
};

type Props = {
  /** Coordenadas normalizadas 0–1 do conteúdo compartilhado */
  point: LaserPoint;
  clicks: LaserClickRipple[];
  /** Mapeia para a janela do navegador usando screen coords quando possível */
  mapToViewport?: boolean;
  className?: string;
  /** Overlay local no vídeo do atendente */
  localMode?: boolean;
  /** Em localMode, usa o vídeo para compensar object-contain */
  videoRef?: RefObject<HTMLVideoElement | null>;
};

function mapNormToViewport(nx: number, ny: number): { left: number; top: number; visible: boolean } {
  const sw = window.screen?.width || window.innerWidth;
  const sh = window.screen?.height || window.innerHeight;
  const absX = nx * sw;
  const absY = ny * sh;
  const sx = window.screenX ?? (window as Window & { screenLeft?: number }).screenLeft ?? 0;
  const sy = window.screenY ?? (window as Window & { screenTop?: number }).screenTop ?? 0;
  const borderX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
  const borderY = Math.max(0, window.outerHeight - window.innerHeight - borderX);
  const left = absX - sx - borderX;
  const top = absY - sy - borderY;
  const pad = 40;
  const visible =
    left >= -pad && top >= -pad && left <= window.innerWidth + pad && top <= window.innerHeight + pad;
  return { left, top, visible };
}

function normToVideoOffset(
  nx: number,
  ny: number,
  video: HTMLVideoElement,
): { left: number; top: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const rect = video.getBoundingClientRect();
  const parent = video.parentElement?.getBoundingClientRect();
  if (!vw || !vh || !rect.width || !rect.height || !parent) return null;
  const scale = Math.min(rect.width / vw, rect.height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const contentLeft = rect.left + (rect.width - dw) / 2 - parent.left;
  const contentTop = rect.top + (rect.height - dh) / 2 - parent.top;
  return {
    left: contentLeft + nx * dw,
    top: contentTop + ny * dh,
  };
}

export function RemoteLaserOverlay({
  point,
  clicks,
  mapToViewport = true,
  className,
  localMode = false,
  videoRef,
}: Props) {
  const [mapped, setMapped] = useState<{ left: number; top: number; visible: boolean } | null>(null);
  const [localPos, setLocalPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!point || localMode || !mapToViewport) {
      setMapped(null);
      return;
    }
    const apply = () => setMapped(mapNormToViewport(point.x, point.y));
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, true);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, [point, localMode, mapToViewport]);

  useEffect(() => {
    if (!localMode || !point || !videoRef?.current) {
      setLocalPos(null);
      return;
    }
    const apply = () => {
      const video = videoRef.current;
      if (!video) return;
      setLocalPos(normToVideoOffset(point.x, point.y, video));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [localMode, point, videoRef]);

  const showPoint = !!point;
  const localStyle =
    localMode && point
      ? localPos
        ? { left: localPos.left, top: localPos.top }
        : { left: `${point.x * 100}%`, top: `${point.y * 100}%` }
      : null;
  const remoteStyle =
    !localMode && point
      ? mapToViewport && mapped
        ? { left: mapped.left, top: mapped.top }
        : { left: `${point.x * 100}%`, top: `${point.y * 100}%` }
      : null;
  const pointVisible = localMode || !mapToViewport || mapped?.visible !== false;

  const clickStyle = (c: LaserClickRipple) => {
    if (localMode && videoRef?.current) {
      const pos = normToVideoOffset(c.x, c.y, videoRef.current);
      if (pos) return { left: pos.left, top: pos.top };
    }
    if (localMode) return { left: `${c.x * 100}%`, top: `${c.y * 100}%` };
    if (mapToViewport) {
      const m = mapNormToViewport(c.x, c.y);
      return { left: m.left, top: m.top };
    }
    return { left: `${c.x * 100}%`, top: `${c.y * 100}%` };
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[80] overflow-hidden",
        !localMode && "fixed",
        className,
      )}
      aria-hidden
    >
      {showPoint && pointVisible && (localStyle || remoteStyle) ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75 ease-out"
          style={localStyle || remoteStyle || undefined}
        >
          <span className="absolute inset-0 -m-3 animate-ping rounded-full bg-rose-500/40" />
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full bg-rose-500/30 ring-2 ring-rose-400/80" />
            <span className="relative h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]" />
          </span>
          {!localMode ? (
            <span className="absolute left-5 top-0 whitespace-nowrap rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
              Atendente
            </span>
          ) : null}
        </div>
      ) : null}

      {showPoint && !localMode && mapToViewport && mapped && !mapped.visible ? (
        <div className="absolute bottom-6 left-1/2 z-[81] -translate-x-1/2 rounded-full bg-rose-600/95 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          Atendente apontando fora desta janela
        </div>
      ) : null}

      {clicks.map((c) => (
        <span key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={clickStyle(c)}>
          <span className="laser-click-ring absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rose-400" />
          <span className="laser-click-dot absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500" />
        </span>
      ))}

      <style>{`
        @keyframes laser-ring {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.95; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
        @keyframes laser-dot {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
        }
        .laser-click-ring { animation: laser-ring 0.7s ease-out forwards; }
        .laser-click-dot { animation: laser-dot 0.55s ease-out forwards; }
      `}</style>
    </div>
  );
}

/** Converte mouse sobre <video object-contain> em coords normalizadas 0–1 do conteúdo. */
export function pointerNormFromVideoEvent(
  ev: { clientX: number; clientY: number },
  video: HTMLVideoElement,
): LaserPoint {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const rect = video.getBoundingClientRect();
  if (!vw || !vh || !rect.width || !rect.height) return null;

  const scale = Math.min(rect.width / vw, rect.height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const left = rect.left + (rect.width - dw) / 2;
  const top = rect.top + (rect.height - dh) / 2;
  const x = (ev.clientX - left) / dw;
  const y = (ev.clientY - top) / dh;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}
