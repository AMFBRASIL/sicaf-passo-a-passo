import path from "node:path";
import { pathToFileURL } from "node:url";

type SicafBridge = {
  initSicafAgentModules: () => void;
  getSicafAgentModule: <T>(relativePath: string) => T;
  getAgentScriptPath: () => string;
};

let bridgePromise: Promise<SicafBridge> | null = null;

async function loadBridge(): Promise<SicafBridge> {
  if (!bridgePromise) {
    const bridgePath = path.join(process.cwd(), "lib", "sicaf-bridge.cjs");
    bridgePromise = import(/* webpackIgnore: true */ pathToFileURL(bridgePath).href) as Promise<SicafBridge>;
  }
  return bridgePromise;
}

export async function initSicafAgentModules(): Promise<void> {
  const bridge = await loadBridge();
  bridge.initSicafAgentModules();
}

export async function getSicafAgentModule<T>(relativePath: string): Promise<T> {
  const bridge = await loadBridge();
  return bridge.getSicafAgentModule<T>(relativePath);
}

export async function getAgentScriptPath(): Promise<string> {
  const bridge = await loadBridge();
  return bridge.getAgentScriptPath();
}
