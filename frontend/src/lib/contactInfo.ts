import { useEffect, useState } from "react";

export interface ContactInfo {
  email: string;
  whatsappDisplay: string; // e.g. "(11) 97494-0551"
  whatsappRaw: string; // digits only with country code, e.g. "5511974940551"
}

const STORAGE_KEY = "peticiona:contact-info";

export const DEFAULT_CONTACT: ContactInfo = {
  email: "contato@peticiona.app.br",
  whatsappDisplay: "(11) 97494-0551",
  whatsappRaw: "5511974940551",
};

const EVENT = "peticiona:contact-info:update";

export function getContactInfo(): ContactInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTACT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONTACT, ...parsed };
  } catch {
    return DEFAULT_CONTACT;
  }
}

export function setContactInfo(info: ContactInfo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function whatsappDisplayToRaw(display: string): string {
  const digits = display.replace(/\D/g, "");
  // Prepend Brazil country code if missing
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function useContactInfo(): ContactInfo {
  const [info, setInfo] = useState<ContactInfo>(() => getContactInfo());

  useEffect(() => {
    const handler = () => setInfo(getContactInfo());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return info;
}
