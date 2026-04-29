import { api, type TermsAcceptanceData } from "@/lib/api";

export const TERMS_VERSION = "1.0.0";

export interface TermsAcceptance {
  version: string;
  acceptedAt: string; // ISO
  ip: string | null;
}

export const mapTermsAcceptance = (data?: TermsAcceptanceData | null): TermsAcceptance | null => {
  if (!data?.acceptance) return null;
  return {
    version: data.acceptance.version,
    acceptedAt: data.acceptance.accepted_at,
    ip: data.acceptance.ip_address ?? null,
  };
};

export const acceptTerms = async () => {
  return api.me.acceptTerms();
};

export const hasAcceptedCurrentTerms = (data?: TermsAcceptanceData | null) =>
  Boolean(data?.accepted && data.current_version === TERMS_VERSION);
