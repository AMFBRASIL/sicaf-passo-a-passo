import { useEffect, useState, type ReactNode } from "react";

/** Evita mismatch de hidratação em UI que depende do browser (token, extensões, etc.) */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return fallback;
  return children;
}
