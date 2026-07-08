import { apiFetch } from "@/lib/api-fetch";

export type OnboardingCheck = {
  label: string;
  detail: string;
  status: "ok" | "pendente";
  statusLabel: string;
};

export type OnboardingDiagnostico = {
  ok: boolean;
  error?: string;
  protocolo?: string;
  fonte?: string;
  empresa?: {
    razao: string;
    protocolo: string | null;
  };
  checks?: OnboardingCheck[];
};

export async function fetchOnboardingDiagnostico(protocolo: string): Promise<OnboardingDiagnostico> {
  const code = encodeURIComponent(protocolo.trim());
  const res = await apiFetch(`/api/public/onboarding/${code}`, { auth: false });
  return (await res.json()) as OnboardingDiagnostico;
}
