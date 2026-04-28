/**
 * CRUD — Testes de lógica de negócio (stores + funções puras)
 * Sem renderização React. Cada describe isola o estado via vi.resetModules().
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PEDIDO_BASE = {
  areaDireito: "Cível",
  tipoPeticao: "Contestação",
  numeroProcesso: "0001234-55.2025.8.26.0100",
  dataPublicacao: "2025-04-01",
  competencia: "Estadual",
  comarca: "São Paulo",
  justicaGratuita: false,
  tutelaUrgencia: false,
  advogadoSubscritor: "Fulano OAB/SP 999",
  resumoCaso: "Resumo do caso de teste.",
  detalhes: "Detalhe adicional.",
  partes: [{ nome: "João Silva", tipo: "Réu" }],
  anexosOriginais: [],
  modalidadeLabel: "Padrão (Avulso)",
  valor: 180,
} as const;

// ---------------------------------------------------------------------------
// 1. MASKS — funções puras
// ---------------------------------------------------------------------------
describe("masks", () => {
  // Importação síncrona é segura: sem estado de módulo
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let maskCPF: (v: string) => string;
  let maskPhone: (v: string) => string;
  let maskOAB: (v: string) => string;
  let isValidCPF: (v: string) => boolean;

  beforeEach(async () => {
    vi.resetModules();
    ({ maskCPF, maskPhone, maskOAB, isValidCPF } = await import("@/lib/masks"));
  });

  it("maskCPF: formata 11 dígitos corretamente", () => {
    expect(maskCPF("12345678909")).toBe("123.456.789-09");
  });

  it("maskCPF: formata parcialmente enquanto digita", () => {
    expect(maskCPF("123")).toBe("123");
    expect(maskCPF("12345")).toBe("123.45");
    expect(maskCPF("12345678")).toBe("123.456.78");
  });

  it("maskCPF: ignora caracteres não numéricos", () => {
    expect(maskCPF("abc123def456ghi789jk09")).toBe("123.456.789-09");
  });

  it("maskPhone: formata celular (11 dígitos)", () => {
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("maskPhone: formata telefone fixo (10 dígitos)", () => {
    expect(maskPhone("1132345678")).toBe("(11) 3234-5678");
  });

  it("maskOAB: mantém apenas dígitos, max 10", () => {
    expect(maskOAB("123abc456")).toBe("123456");
    expect(maskOAB("12345678901234")).toBe("1234567890");
  });

  it("isValidCPF: aceita CPF válido", () => {
    // CPF matematicamente válido
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });

  it("isValidCPF: rejeita CPF com dígitos todos iguais", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("000.000.000-00")).toBe(false);
  });

  it("isValidCPF: rejeita CPF com dígito verificador errado", () => {
    expect(isValidCPF("529.982.247-26")).toBe(false);
  });

  it("isValidCPF: rejeita CPF com menos de 11 dígitos", () => {
    expect(isValidCPF("123.456.789")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. ROLES — roles e redirect paths
// ---------------------------------------------------------------------------
describe("roles", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it("dashboardPathForRole: retorna path correto para cada role", async () => {
    const { dashboardPathForRole } = await import("@/lib/roles");
    expect(dashboardPathForRole("cliente")).toBe("/area-cliente");
    expect(dashboardPathForRole("funcionario")).toBe("/area-interna");
    expect(dashboardPathForRole("admin")).toBe("/admin");
  });

  it("setRole / getRole: mantém a role em memória", async () => {
    const { setRole, getRole } = await import("@/lib/roles");
    setRole("admin");
    expect(getRole()).toBe("admin");
    expect(localStorage.getItem("peticiona:role:v1")).toBeNull();
  });

  it("setRole: troca de role reflete em getRole", async () => {
    const { setRole, getRole } = await import("@/lib/roles");
    setRole("funcionario");
    expect(getRole()).toBe("funcionario");
    setRole("cliente");
    expect(getRole()).toBe("cliente");
  });

  it("getRole: retorna 'cliente' quando localStorage está vazio", async () => {
    const { getRole } = await import("@/lib/roles");
    expect(getRole()).toBe("cliente");
  });
});

// ---------------------------------------------------------------------------
// 3. STAFF STATUS — bloquear / desbloquear funcionários
// ---------------------------------------------------------------------------
describe("staffStatus", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it("isStaffActive: retorna status padrão do adminMocks (f1=true, f3=false)", async () => {
    const { isStaffActive } = await import("@/lib/staffStatus");
    expect(isStaffActive("f1")).toBe(true);
    expect(isStaffActive("f3")).toBe(false);
  });

  it("toggleStaffActive: inverte status ativo", async () => {
    const { toggleStaffActive, isStaffActive } = await import("@/lib/staffStatus");
    const result = toggleStaffActive("f1");
    expect(result).toBe(false);
    expect(isStaffActive("f1")).toBe(false);
  });

  it("toggleStaffActive: desbloqueia funcionário bloqueado", async () => {
    const { toggleStaffActive, isStaffActive } = await import("@/lib/staffStatus");
    const result = toggleStaffActive("f3"); // f3 começa bloqueado
    expect(result).toBe(true);
    expect(isStaffActive("f3")).toBe(true);
  });

  it("toggleStaffActive: persiste no localStorage", async () => {
    const { toggleStaffActive } = await import("@/lib/staffStatus");
    toggleStaffActive("f2");
    const raw = localStorage.getItem("peticiona:staff:status:v1");
    expect(raw).not.toBeNull();
    const map = JSON.parse(raw!);
    expect(map["f2"]).toBe(false);
  });

  it("toggleStaffActive: grava log de auditoria", async () => {
    const { toggleStaffActive } = await import("@/lib/staffStatus");
    toggleStaffActive("f1");
    const log = JSON.parse(localStorage.getItem("peticiona:audit:v1") ?? "[]");
    expect(log).toHaveLength(1);
    expect(log[0].acao).toBe("bloquear_funcionario");
    expect(log[0].funcionarioId).toBe("f1");
  });
});

// ---------------------------------------------------------------------------
// 4. CLIENT PROFILE — CRUD do perfil do cliente
// ---------------------------------------------------------------------------
describe("clientProfile", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it("setProfileOnSignup (CREATE): persiste todos os campos", async () => {
    const { setProfileOnSignup } = await import("@/lib/clientProfile");
    setProfileOnSignup({
      fullName: "Maria da Silva",
      cpf: "529.982.247-25",
      oab: "12345",
      oabUf: "SP",
      phone: "(11) 91234-5678",
      email: "maria@example.com",
    });
    const stored = JSON.parse(localStorage.getItem("peticiona:client-profile:v1") ?? "{}");
    expect(stored.fullName).toBe("Maria da Silva");
    expect(stored.cpf).toBe("529.982.247-25");
    expect(stored.oab).toBe("12345");
    expect(stored.oabUf).toBe("SP");
  });

  it("updateEditableProfile (UPDATE): atualiza phone e email", async () => {
    const { setProfileOnSignup, updateEditableProfile } = await import("@/lib/clientProfile");
    setProfileOnSignup({
      fullName: "Maria da Silva",
      cpf: "529.982.247-25",
      oab: "12345",
      oabUf: "SP",
      phone: "(11) 91234-5678",
      email: "maria@example.com",
    });
    updateEditableProfile({ phone: "(21) 99999-0000", email: "novo@example.com" });
    const stored = JSON.parse(localStorage.getItem("peticiona:client-profile:v1") ?? "{}");
    expect(stored.phone).toBe("(21) 99999-0000");
    expect(stored.email).toBe("novo@example.com");
    // Campos imutáveis preservados
    expect(stored.fullName).toBe("Maria da Silva");
    expect(stored.cpf).toBe("529.982.247-25");
  });

  it("profileEditableSchema: valida phone e email válidos", async () => {
    const { profileEditableSchema } = await import("@/lib/clientProfile");
    const result = profileEditableSchema.safeParse({
      phone: "(11) 91234-5678",
      email: "valido@email.com",
    });
    expect(result.success).toBe(true);
  });

  it("profileEditableSchema: rejeita email inválido", async () => {
    const { profileEditableSchema } = await import("@/lib/clientProfile");
    const result = profileEditableSchema.safeParse({ phone: "(11) 91234-5678", email: "nao-email" });
    expect(result.success).toBe(false);
  });

  it("profileEditableSchema: rejeita telefone com formato errado", async () => {
    const { profileEditableSchema } = await import("@/lib/clientProfile");
    const result = profileEditableSchema.safeParse({ phone: "123", email: "ok@ok.com" });
    expect(result.success).toBe(false);
  });

  it("profileSignupSchema: valida cadastro completo", async () => {
    const { profileSignupSchema } = await import("@/lib/clientProfile");
    const result = profileSignupSchema.safeParse({
      fullName: "João da Silva",
      cpf: "529.982.247-25",
      oab: "12345",
      oabUf: "SP",
      phone: "(11) 91234-5678",
      email: "joao@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("profileSignupSchema: rejeita UF inválida", async () => {
    const { profileSignupSchema } = await import("@/lib/clientProfile");
    const result = profileSignupSchema.safeParse({
      fullName: "João",
      cpf: "529.982.247-25",
      oab: "12345",
      oabUf: "XX", // UF inválida
      phone: "(11) 91234-5678",
      email: "joao@example.com",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. PEDIDOS — CRUD completo do store de pedidos
// ---------------------------------------------------------------------------
describe("pedidos", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it("criarPedido (CREATE): retorna pedido com campos gerados automaticamente", async () => {
    const { criarPedido } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    expect(p.id).toBeTruthy();
    expect(p.numero).toBe(1234); // NUMERO_INICIAL
    expect(p.reference).toMatch(/^PT-\d{4}-1234$/);
    expect(p.status).toBe("em_analise");
    expect(p.comentarios).toEqual([]);
    expect(p.anexosCliente).toEqual([]);
    expect(p.entregasFinais).toEqual([]);
  });

  it("criarPedido (CREATE): persiste no localStorage", async () => {
    const { criarPedido } = await import("@/lib/pedidos");
    criarPedido({ ...PEDIDO_BASE });
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    expect(stored.pedidos).toHaveLength(1);
    expect(stored.pedidos[0].areaDireito).toBe("Cível");
  });

  it("criarPedido (CREATE): números sequenciais em criações consecutivas", async () => {
    const { criarPedido } = await import("@/lib/pedidos");
    const p1 = criarPedido({ ...PEDIDO_BASE });
    const p2 = criarPedido({ ...PEDIDO_BASE, tipoPeticao: "Apelação" });
    expect(p1.numero).toBe(1234);
    expect(p2.numero).toBe(1235);
  });

  it("criarPedido (CREATE): prazo do cliente é 5 dias a partir de agora", async () => {
    const { criarPedido } = await import("@/lib/pedidos");
    const antes = Date.now();
    const p = criarPedido({ ...PEDIDO_BASE });
    const prazo = new Date(p.prazoEntregaClienteISO).getTime();
    const diffDias = (prazo - antes) / (1000 * 60 * 60 * 24);
    expect(diffDias).toBeGreaterThanOrEqual(4.9);
    expect(diffDias).toBeLessThanOrEqual(5.1);
  });

  it("criarPedido (CREATE): prazo interno é 2 dias antes do prazo do cliente", async () => {
    const { criarPedido } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    const cliente = new Date(p.prazoEntregaClienteISO).getTime();
    const interno = new Date(p.prazoEntregaInternoISO).getTime();
    const diffDias = (cliente - interno) / (1000 * 60 * 60 * 24);
    expect(diffDias).toBeCloseTo(2, 0);
  });

  it("adicionarComentario (UPDATE): adiciona comentário de cliente ao pedido", async () => {
    const { criarPedido, adicionarComentario } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    adicionarComentario(p.id, "Preciso de ajuda", "cliente", "Você");
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido = stored.pedidos.find((x: { id: string }) => x.id === p.id);
    expect(pedido.comentarios).toHaveLength(1);
    expect(pedido.comentarios[0].texto).toBe("Preciso de ajuda");
    expect(pedido.comentarios[0].autor).toBe("cliente");
    expect(pedido.comentarios[0].interno).toBe(false);
  });

  it("adicionarComentario (UPDATE): comentário interno da equipe", async () => {
    const { criarPedido, adicionarComentario } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    adicionarComentario(p.id, "Nota interna", "equipe", "Equipe Peticiona", true);
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido = stored.pedidos.find((x: { id: string }) => x.id === p.id);
    expect(pedido.comentarios[0].interno).toBe(true);
    expect(pedido.comentarios[0].autor).toBe("equipe");
  });

  it("adicionarAnexosCliente (UPDATE): adiciona anexos ao pedido", async () => {
    const { criarPedido, adicionarAnexosCliente } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    const file = new File(["conteúdo"], "doc.pdf", { type: "application/pdf" });
    adicionarAnexosCliente(p.id, [file]);
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido = stored.pedidos.find((x: { id: string }) => x.id === p.id);
    expect(pedido.anexosCliente).toHaveLength(1);
    expect(pedido.anexosCliente[0].nome).toBe("doc.pdf");
  });

  it("atualizarStatus (UPDATE): muda status para aguardando_dados", async () => {
    const { criarPedido, atualizarStatus } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    atualizarStatus(p.id, "aguardando_dados");
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido = stored.pedidos.find((x: { id: string }) => x.id === p.id);
    expect(pedido.status).toBe("aguardando_dados");
    expect(pedido.finalizadoEmISO).toBeUndefined();
  });

  it("atualizarStatus (UPDATE): seta finalizadoEmISO ao concluir", async () => {
    const { criarPedido, atualizarStatus } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    atualizarStatus(p.id, "concluido");
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido = stored.pedidos.find((x: { id: string }) => x.id === p.id);
    expect(pedido.status).toBe("concluido");
    expect(pedido.finalizadoEmISO).toBeTruthy();
  });

  it("adicionarEntregaFinal (UPDATE): registra arquivo de entrega", async () => {
    const { criarPedido, adicionarEntregaFinal } = await import("@/lib/pedidos");
    const p = criarPedido({ ...PEDIDO_BASE });
    const file = new File(["peticao"], "peticao_final.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    adicionarEntregaFinal(p.id, [file]);
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido = stored.pedidos.find((x: { id: string }) => x.id === p.id);
    expect(pedido.entregasFinais).toHaveLength(1);
    expect(pedido.entregasFinais[0].nome).toBe("peticao_final.docx");
    expect(pedido.entregasFinais[0].enviadoPor).toBe("Equipe Peticiona");
  });

  it("nenhum pedido afeta outros (isolamento de ID)", async () => {
    const { criarPedido, adicionarComentario } = await import("@/lib/pedidos");
    const p1 = criarPedido({ ...PEDIDO_BASE });
    const p2 = criarPedido({ ...PEDIDO_BASE, tipoPeticao: "Apelação" });
    adicionarComentario(p1.id, "Só no p1");
    const stored = JSON.parse(localStorage.getItem("peticiona:pedidos:v1") ?? "{}");
    const pedido2 = stored.pedidos.find((x: { id: string }) => x.id === p2.id);
    expect(pedido2.comentarios).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. BALANCE — saldo, planos, créditos avulsos e débitos
// ---------------------------------------------------------------------------
describe("balance", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it("getSaldoTotal: retorna soma de saldoPlano + saldoAvulso", async () => {
    const { getSaldoTotal } = await import("@/lib/balance");
    expect(getSaldoTotal({ saldoPlano: 300, saldoAvulso: 200 } as never)).toBe(500);
    expect(getSaldoTotal({ saldoPlano: 0, saldoAvulso: 0 } as never)).toBe(0);
  });

  it("assinarPlano (CREATE): credita saldo e cria movimentação", async () => {
    const { assinarPlano } = await import("@/lib/balance");
    assinarPlano("essencial"); // R$ 540,00
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "{}");
    expect(stored.saldoPlano).toBe(540);
    expect(stored.planoAtivo).toBe("essencial");
    expect(stored.movements).toHaveLength(1);
    expect(stored.movements[0].type).toBe("in");
    expect(stored.movements[0].amount).toBe(540);
  });

  it("comprarCreditoAvulso (CREATE): credita saldo avulso", async () => {
    const { comprarCreditoAvulso } = await import("@/lib/balance");
    comprarCreditoAvulso("peticao_avulsa"); // R$ 180,00
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "{}");
    expect(stored.saldoAvulso).toBe(180);
    expect(stored.movements[0].type).toBe("in");
    expect(stored.movements[0].source).toBe("avulso");
  });

  it("comprarCreditoAvulso (CREATE): qtd > 1 multiplica valor", async () => {
    const { comprarCreditoAvulso } = await import("@/lib/balance");
    comprarCreditoAvulso("recurso_avulso", 3); // 3 × R$ 200 = R$ 600
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "{}");
    expect(stored.saldoAvulso).toBe(600);
  });

  it("debitarPedido (UPDATE): debita do saldo do plano primeiro", async () => {
    const { assinarPlano, comprarCreditoAvulso, debitarPedido } = await import("@/lib/balance");
    assinarPlano("essencial"); // plano = 540
    comprarCreditoAvulso("peticao_avulsa"); // avulso = 180
    const resultado = debitarPedido(160, "Pedido PT-2025-0001");
    expect(resultado.ok).toBe(true);
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "{}");
    expect(stored.saldoPlano).toBe(380); // 540 - 160
    expect(stored.saldoAvulso).toBe(180); // intocado
    expect(stored.movements[0].type).toBe("out");
    expect(stored.movements[0].source).toBe("plano");
  });

  it("debitarPedido (UPDATE): usa mix quando saldo do plano não cobre tudo", async () => {
    const { assinarPlano, comprarCreditoAvulso, debitarPedido } = await import("@/lib/balance");
    assinarPlano("essencial"); // plano = 540
    comprarCreditoAvulso("peticao_avulsa"); // avulso = 180
    // Esgota quase todo o plano
    debitarPedido(500, "Pedido 1"); // plano = 40, avulso = 180
    const resultado = debitarPedido(100, "Pedido 2"); // plano(40) + avulso(60)
    expect(resultado.ok).toBe(true);
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "{}");
    expect(stored.saldoPlano).toBe(0);
    expect(stored.saldoAvulso).toBe(120); // 180 - 60
    expect(stored.movements[0].source).toBe("mix");
  });

  it("debitarPedido: falha quando saldo insuficiente", async () => {
    const { debitarPedido } = await import("@/lib/balance");
    const resultado = debitarPedido(100, "Pedido sem saldo");
    expect(resultado.ok).toBe(false);
    expect(resultado.faltante).toBe(100);
    // Nenhuma movimentação criada
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "null");
    expect(stored?.movements ?? []).toHaveLength(0);
  });

  it("peticao_express: ativa flag peticaoExpressDisponivel", async () => {
    const { comprarCreditoAvulso } = await import("@/lib/balance");
    comprarCreditoAvulso("peticao_express");
    const stored = JSON.parse(localStorage.getItem("peticiona:balance:v1") ?? "{}");
    expect(stored.peticaoExpressDisponivel).toBe(true);
    expect(stored.recursoExpressDisponivel).toBe(false);
  });
});
