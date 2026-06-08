import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(resetMs = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (value: string, label?: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(label ? `${label} copiado` : "Copiado para área de transferência");
        setTimeout(() => setCopied(false), resetMs);
        return true;
      } catch {
        toast.error("Não foi possível copiar");
        return false;
      }
    },
    [resetMs],
  );

  return { copied, copy };
}
