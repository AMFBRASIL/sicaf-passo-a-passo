export const CADBRASIL_EXTENSION_STORE_URL =
  "https://chromewebstore.google.com/detail/cadbrasil-%E2%80%94-assistente-si/cdhhdgcabgbjdambnhkmdibhnmfkaicd?utm_source=item-share-cb";

export const CADBRASIL_EXTENSION_STORE_ID = "cdhhdgcabgbjdambnhkmdibhnmfkaicd";

const EXTENSION_ID_STORAGE_KEY = "cadbrasil_extension_id";
const PROBE_EVENT = "cadbrasil-extension-probe";
const READY_EVENT = "cadbrasil-extension-ready";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

export type ExtensionDetection = {
  installed: boolean;
  extensionId?: string;
  version?: string;
};

type Listener = (state: ExtensionDetection) => void;

let cachedId = "";
let cachedVersion = "";
let listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let watcherCount = 0;
let readyListenerAttached = false;

function hasChromeRuntime(): boolean {
  return typeof chrome !== "undefined" && !!chrome?.runtime?.sendMessage;
}

function buildState(): ExtensionDetection {
  return {
    installed: !!cachedId,
    extensionId: cachedId || undefined,
    version: cachedVersion || undefined,
  };
}

function statesEqual(a: ExtensionDetection, b: ExtensionDetection): boolean {
  return (
    a.installed === b.installed &&
    a.extensionId === b.extensionId &&
    a.version === b.version
  );
}

let lastNotified = buildState();

function notify() {
  const state = buildState();
  if (statesEqual(state, lastNotified)) return;
  lastNotified = state;
  listeners.forEach((fn) => fn(state));
}

function persistId(id: string, version?: string) {
  if (!id) return;
  const changed = cachedId !== id || (version && cachedVersion !== version);
  if (!changed) return;
  cachedId = id;
  if (version) cachedVersion = version;
  localStorage.setItem(EXTENSION_ID_STORAGE_KEY, id);
  notify();
}

function clearCachedId() {
  if (!cachedId && !cachedVersion) return;
  cachedId = "";
  cachedVersion = "";
  notify();
}

function readDomId(): string | null {
  return document.documentElement.getAttribute("data-cadbrasil-extension-id");
}

function collectCandidateIds(): string[] {
  const ids = new Set<string>();
  const domId = readDomId();
  if (domId) ids.add(domId);
  const stored = localStorage.getItem(EXTENSION_ID_STORAGE_KEY);
  if (stored) ids.add(stored);
  if (cachedId) ids.add(cachedId);
  ids.add(CADBRASIL_EXTENSION_STORE_ID);
  return [...ids];
}

export function probeCadBrasilExtension(): void {
  window.dispatchEvent(new CustomEvent(PROBE_EVENT));
}

function pingViaChrome(extId: string, timeoutMs = 2500): Promise<{ ok: boolean; version?: string }> {
  if (!extId || !hasChromeRuntime()) {
    return Promise.resolve({ ok: false });
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false }), timeoutMs);
    try {
      chrome.runtime.sendMessage(extId, { action: "ping" }, (response: any) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError || !response?.ok) {
          resolve({ ok: false });
        } else {
          resolve({ ok: true, version: response.version });
        }
      });
    } catch {
      clearTimeout(timeout);
      resolve({ ok: false });
    }
  });
}

function pingViaPostMessage(timeoutMs = 2500): Promise<{ ok: boolean; version?: string }> {
  probeCadBrasilExtension();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ ok: false });
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.type !== "cadbrasil-extension-response" || data?.action !== "ping") return;
      cleanup();
      resolve({
        ok: !!data.response?.ok,
        version: data.response?.version,
      });
    };

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { type: "cadbrasil-portal-message", action: "ping", payload: {} },
      "*",
    );
  });
}

export async function detectCadBrasilExtension(): Promise<ExtensionDetection> {
  const domId = readDomId();
  if (domId) {
    persistId(domId);
    const postPing = await pingViaPostMessage(1800);
    if (postPing.ok) {
      persistId(domId, postPing.version);
      return buildState();
    }
    const chromePing = await pingViaChrome(domId, 1800);
    if (chromePing.ok) {
      persistId(domId, chromePing.version);
      return buildState();
    }
    return { installed: true, extensionId: domId, version: cachedVersion || undefined };
  }

  const postPing = await pingViaPostMessage(2500);
  if (postPing.ok) {
    const id = readDomId() || localStorage.getItem(EXTENSION_ID_STORAGE_KEY) || CADBRASIL_EXTENSION_STORE_ID;
    persistId(id, postPing.version);
    return buildState();
  }

  for (const id of collectCandidateIds()) {
    const chromePing = await pingViaChrome(id, 2000);
    if (chromePing.ok) {
      persistId(id, chromePing.version);
      return buildState();
    }
  }

  clearCachedId();
  return { installed: false };
}

export async function waitForCadBrasilExtension(timeoutMs = 8000): Promise<ExtensionDetection> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    let settled = false;

    const finish = async () => {
      const result = await detectCadBrasilExtension();
      if (result.installed && !settled) {
        settled = true;
        cleanup();
        resolve(result);
        return true;
      }
      return false;
    };

    const onReady = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.extensionId) {
        persistId(detail.extensionId, detail.version);
        if (!settled) {
          settled = true;
          cleanup();
          resolve(buildState());
        }
      }
    };

    const interval = setInterval(async () => {
      if (await finish()) return;
      if (Date.now() >= deadline && !settled) {
        settled = true;
        cleanup();
        resolve({ installed: false });
      }
    }, 450);

    const cleanup = () => {
      clearInterval(interval);
      window.removeEventListener(READY_EVENT, onReady);
    };

    window.addEventListener(READY_EVENT, onReady);
    void finish();
  });
}

export function getCachedCadBrasilExtension(): ExtensionDetection {
  return buildState();
}

export function subscribeCadBrasilExtension(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastNotified);
  return () => listeners.delete(listener);
}

function onReadyEvent(e: Event) {
  const detail = (e as CustomEvent).detail;
  if (detail?.extensionId) {
    persistId(detail.extensionId, detail.version);
  }
}

export function startCadBrasilExtensionWatcher(): () => void {
  watcherCount += 1;

  if (!readyListenerAttached) {
    window.addEventListener(READY_EVENT, onReadyEvent);
    readyListenerAttached = true;
  }

  if (!pollTimer) {
    void detectCadBrasilExtension();
    pollTimer = setInterval(() => {
      void detectCadBrasilExtension();
    }, 3000);
  }

  return () => {
    watcherCount = Math.max(0, watcherCount - 1);
    if (watcherCount === 0) {
      if (readyListenerAttached) {
        window.removeEventListener(READY_EVENT, onReadyEvent);
        readyListenerAttached = false;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  };
}

export async function openCadBrasilSicaf(token: string, apiBaseUrl: string): Promise<boolean> {
  const detection = await detectCadBrasilExtension();
  const extId = detection.extensionId || cachedId || readDomId() || "";

  if (extId && hasChromeRuntime()) {
    const ok = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 4000);
      try {
        chrome.runtime.sendMessage(
          extId,
          { action: "open-sicaf", token, apiBaseUrl },
          (response: any) => {
            clearTimeout(timeout);
            resolve(!chrome.runtime.lastError && !!response?.ok);
          },
        );
      } catch {
        clearTimeout(timeout);
        resolve(false);
      }
    });
    if (ok) return true;
  }

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(false);
    }, 4000);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.type !== "cadbrasil-extension-response" || data?.action !== "open-sicaf") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(!!data.response?.ok);
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        type: "cadbrasil-portal-message",
        action: "open-sicaf",
        payload: { token, apiBaseUrl },
      },
      "*",
    );
  });
}
