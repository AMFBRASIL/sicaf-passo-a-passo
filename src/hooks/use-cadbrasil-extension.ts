import { useCallback, useEffect, useState } from "react";
import {
  CADBRASIL_EXTENSION_STORE_ID,
  CADBRASIL_EXTENSION_STORE_URL,
  detectCadBrasilExtension,
  getCachedCadBrasilExtension,
  openCadBrasilSicaf,
  startCadBrasilExtensionWatcher,
  subscribeCadBrasilExtension,
  waitForCadBrasilExtension,
} from "@/lib/cadbrasil-extension";
import { readAuthToken } from "@/lib/auth-cookie";

export {
  CADBRASIL_EXTENSION_STORE_ID,
  CADBRASIL_EXTENSION_STORE_URL,
};

export function useCadBrasilExtension() {
  const [status, setStatus] = useState(getCachedCadBrasilExtension);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const stopWatcher = startCadBrasilExtensionWatcher();
    const unsubscribe = subscribeCadBrasilExtension(setStatus);
    return () => {
      unsubscribe();
      stopWatcher();
    };
  }, []);

  const checkExtension = useCallback(async (options?: { waitMs?: number }) => {
    setChecking(true);
    try {
      if (options?.waitMs && options.waitMs > 0) {
        const result = await waitForCadBrasilExtension(options.waitMs);
        setStatus(result);
        return result.installed;
      }
      const result = await detectCadBrasilExtension();
      setStatus(result);
      return result.installed;
    } finally {
      setChecking(false);
    }
  }, []);

  const waitForExtension = useCallback(async (timeoutMs = 8000) => {
    setChecking(true);
    try {
      const result = await waitForCadBrasilExtension(timeoutMs);
      setStatus(result);
      return result.installed;
    } finally {
      setChecking(false);
    }
  }, []);

  const openSICAF = useCallback(async () => {
    const token = readAuthToken() || "";
    return openCadBrasilSicaf(token, window.location.origin);
  }, []);

  return {
    extensionInstalled: status.installed,
    extensionVersion: status.version,
    extensionChecking: checking,
    openSICAF,
    checkExtension,
    waitForExtension,
  };
}
