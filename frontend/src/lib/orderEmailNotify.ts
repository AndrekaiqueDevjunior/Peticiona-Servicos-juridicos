// Notificações por e-mail para eventos de pedidos.
//
// Toda criação de pedido e todo comentário publicado disparam um e-mail
// para o endereço de contato global da plataforma (gerido em /admin).
//
// Como o projeto ainda não tem backend dedicado, esta função:
//   1) Tenta um POST para /api/notify-email (no-op até o DEV implementar).
//      Falhas de rede são silenciosas — não atrapalham a UX.
//   2) Mantém um "outbox" em localStorage com as últimas 50 notificações
//      enviadas, útil para depuração e auditoria.
//   3) Loga no console para visibilidade durante o desenvolvimento.
//
// Quando o backend existir, basta o DEV implementar /api/notify-email
// recebendo { to, subject, body } e despachar via Pagar.me/Resend/SES.

import { getContactInfo } from "./contactInfo";

export type OrderEmailEvent =
  | "pedido_criado"
  | "comentario_publicado";

interface NotifyInput {
  event: OrderEmailEvent;
  pedidoNumero: number | string;
  pedidoReference?: string;
  cliente?: string;
  /** Conteúdo principal (resumo do pedido ou texto do comentário). */
  detalhes?: string;
  /** Autor do comentário, quando aplicável. */
  autor?: string;
}

interface OutboxEntry {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAtISO: string;
  delivered: boolean;
}

const OUTBOX_KEY = "peticiona:email-outbox:v1";
const MAX_OUTBOX = 50;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const readOutbox = (): OutboxEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
};

const writeOutbox = (entries: OutboxEntry[]) => {
  try {
    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify(entries.slice(-MAX_OUTBOX)),
    );
  } catch {
    /* noop */
  }
};

const buildSubject = (input: NotifyInput): string => {
  const ref = input.pedidoReference ?? `Nº ${input.pedidoNumero}`;
  if (input.event === "pedido_criado") {
    return `[Peticiona] Novo pedido cadastrado — ${ref}`;
  }
  return `[Peticiona] Novo comentário no pedido ${ref}`;
};

const buildBody = (input: NotifyInput): string => {
  const ref = input.pedidoReference ?? `Nº ${input.pedidoNumero}`;
  const linhas: string[] = [];
  if (input.event === "pedido_criado") {
    linhas.push("Um novo pedido foi cadastrado na plataforma Peticiona.");
    linhas.push("");
    linhas.push(`Pedido: ${ref}`);
    if (input.cliente) linhas.push(`Cliente: ${input.cliente}`);
    if (input.detalhes) {
      linhas.push("");
      linhas.push("Resumo:");
      linhas.push(input.detalhes);
    }
  } else {
    linhas.push("Um novo comentário foi publicado em um pedido.");
    linhas.push("");
    linhas.push(`Pedido: ${ref}`);
    if (input.cliente) linhas.push(`Cliente: ${input.cliente}`);
    if (input.autor) linhas.push(`Autor: ${input.autor}`);
    if (input.detalhes) {
      linhas.push("");
      linhas.push("Comentário:");
      linhas.push(input.detalhes);
    }
  }
  linhas.push("");
  linhas.push("---");
  linhas.push("Esta é uma notificação automática da plataforma Peticiona.");
  return linhas.join("\n");
};

export const notifyOrderEvent = async (input: NotifyInput): Promise<void> => {
  const to = getContactInfo().email;
  const subject = buildSubject(input);
  const body = buildBody(input);

  // Tenta entregar via endpoint backend (silencioso em caso de falha).
  let delivered = false;
  try {
    const res = await fetch("/api/notify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, event: input.event }),
    });
    delivered = res.ok;
  } catch {
    delivered = false;
  }

  // Outbox local (auditoria + fallback até o backend existir).
  const entry: OutboxEntry = {
    id: newId(),
    to,
    subject,
    body,
    sentAtISO: new Date().toISOString(),
    delivered,
  };
  const outbox = readOutbox();
  writeOutbox([...outbox, entry]);

  if (typeof console !== "undefined") {
    console.info(
      `[email→${to}] ${subject}${delivered ? "" : " (queued — backend offline)"}`,
    );
  }
};

export const getEmailOutbox = (): OutboxEntry[] => readOutbox();
