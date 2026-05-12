// Dados mock para o painel administrativo (somente leitura).
// Substituir por queries reais quando o backend existir.

export interface AdminClienteMock {
  id: string;
  nome: string;
  oab: string;
  email: string;
  telefone: string;
  plano: "Essencial" | "Profissional" | "Estratégico" | "Sem plano";
  cadastradoEm: string; // dd/MM/yyyy
  ativo: boolean;
}

export interface AdminFuncionarioMock {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  pedidosAtivos: number;
  pedidosConcluidos: number;
  ativo: boolean;
}

export type AdminPedidoModalidade =
  | "plano_essencial"
  | "plano_profissional"
  | "plano_estrategico"
  | "peticao_avulsa"
  | "recurso_avulso"
  | "peticao_express"
  | "recurso_express";

export interface AdminPedidoComentario {
  id: string;
  autorNome: string;
  autorRole: "cliente" | "funcionario" | "admin";
  texto: string;
  dataISO: string;
}

export interface AdminPedidoAnexo {
  id: string;
  nome: string;
  tamanho: number;
  enviadoPor: string;
  dataISO: string;
}

export interface AdminPedidoHistorico {
  id: string;
  texto: string;
  dataISO: string;
}

export interface AdminPedidoParte {
  nome: string;
  tipo: string;
}

export interface AdminPedidoMock {
  id: string;
  numero: number;
  cliente: string;
  tipoServico: string;
  modalidade: AdminPedidoModalidade;
  status: "Em análise" | "Aguardando dados" | "Concluído";
  funcionarioId: string | null;
  /** Espelha o nome do funcionário para exibição rápida. */
  funcionario: string | null;
  /** ISO — prazo do cliente (calculado conforme modalidade). */
  prazoClienteISO: string;
  /** ISO — prazo interno (cliente − 2 dias corridos; igual ao cliente quando express). */
  prazoInternoISO: string;
  prazoCliente: string; // dd/MM/yyyy (legado, derivado)
  valor: number;
  criadoEm: string;
  finalizadoEm: string | null;
  splitPlataforma: number;
  splitFuncionario: number;

  // Dados completos do formulário (espelha o que o cliente preencheu).
  areaDireito: string;
  tipoPeticao: string;
  numeroProcesso: string;
  dataPublicacao: string; // dd/MM/yyyy ou ""
  competencia: string;
  comarca: string;
  justicaGratuita: boolean;
  tutelaUrgencia: boolean;
  advogadoSubscritor: string;
  resumoCaso: string;
  detalhes: string;
  partes: AdminPedidoParte[];

  comentarios: AdminPedidoComentario[];
  anexos: AdminPedidoAnexo[];
  historico: AdminPedidoHistorico[];
}

export const MODALIDADE_LABEL: Record<AdminPedidoModalidade, string> = {
  plano_essencial: "Plano Essencial",
  plano_profissional: "Plano Profissional",
  plano_estrategico: "Plano Estratégico",
  peticao_avulsa: "Petição Avulsa",
  recurso_avulso: "Recurso Avulso",
  peticao_express: "Petição Express",
  recurso_express: "Recurso Express",
};

export const isModalidadeExpress = (m: AdminPedidoModalidade) =>
  m === "peticao_express" || m === "recurso_express";

export const ADMIN_CLIENTES: AdminClienteMock[] = [
  {
    id: "c1",
    nome: "Marina Costa Almeida",
    oab: "SP 234.561",
    email: "marina.costa@adv.br",
    telefone: "(11) 98765-1122",
    plano: "Profissional",
    cadastradoEm: "12/01/2025",
    ativo: true,
  },
  {
    id: "c2",
    nome: "Rafael Mendonça",
    oab: "RJ 145.882",
    email: "rafael.m@adv.br",
    telefone: "(21) 99887-3344",
    plano: "Estratégico",
    cadastradoEm: "03/02/2025",
    ativo: true,
  },
  {
    id: "c3",
    nome: "Patrícia Lemos",
    oab: "MG 098.221",
    email: "patricia.lemos@adv.br",
    telefone: "(31) 98112-5566",
    plano: "Essencial",
    cadastradoEm: "21/02/2025",
    ativo: true,
  },
  {
    id: "c4",
    nome: "Eduardo Tavares",
    oab: "RS 412.339",
    email: "eduardo.t@adv.br",
    telefone: "(51) 99654-7788",
    plano: "Sem plano",
    cadastradoEm: "08/03/2025",
    ativo: false,
  },
];

export const ADMIN_FUNCIONARIOS: AdminFuncionarioMock[] = [
  {
    id: "f1",
    nome: "Ana Beatriz Souza",
    email: "ana.souza@peticiona.com.br",
    telefone: "(11) 98765-4321",
    pedidosAtivos: 4,
    pedidosConcluidos: 23,
    ativo: true,
  },
  {
    id: "f2",
    nome: "Carlos Henrique Lima",
    email: "carlos.lima@peticiona.com.br",
    telefone: "(11) 91234-9988",
    pedidosAtivos: 2,
    pedidosConcluidos: 18,
    ativo: true,
  },
  {
    id: "f3",
    nome: "Juliana Ribeiro",
    email: "juliana.r@peticiona.com.br",
    telefone: "(11) 99887-1234",
    pedidosAtivos: 0,
    pedidosConcluidos: 7,
    ativo: false,
  },
];

export type AdminCompraTipo = "plano" | "avulso";

export interface AdminCompraMock {
  id: string;
  cliente: string;
  tipo: AdminCompraTipo;
  /** Nome do plano ou do crédito avulso adquirido. */
  produto: string;
  valor: number;
  /** ISO — usado para filtrar por mês/ano. */
  dataISO: string;
}

export const ADMIN_COMPRAS: AdminCompraMock[] = [
  {
    id: "co1",
    cliente: "Marina Costa Almeida",
    tipo: "plano",
    produto: "Plano Profissional",
    valor: 750,
    dataISO: "2026-04-02T10:15:00",
  },
  {
    id: "co2",
    cliente: "Rafael Mendonça",
    tipo: "plano",
    produto: "Plano Estratégico",
    valor: 2800,
    dataISO: "2026-04-05T09:42:00",
  },
  {
    id: "co3",
    cliente: "Patrícia Lemos",
    tipo: "plano",
    produto: "Plano Essencial",
    valor: 480,
    dataISO: "2026-04-08T14:00:00",
  },
  {
    id: "co4",
    cliente: "Eduardo Tavares",
    tipo: "avulso",
    produto: "Recurso Avulso",
    valor: 200,
    dataISO: "2026-04-21T08:50:00",
  },
  {
    id: "co5",
    cliente: "Patrícia Lemos",
    tipo: "avulso",
    produto: "Petição Express",
    valor: 220,
    dataISO: "2026-04-19T09:55:00",
  },
  {
    id: "co6",
    cliente: "Marina Costa Almeida",
    tipo: "plano",
    produto: "Plano Profissional",
    valor: 750,
    dataISO: "2026-03-02T11:00:00",
  },
  {
    id: "co7",
    cliente: "Rafael Mendonça",
    tipo: "avulso",
    produto: "Petição Avulsa",
    valor: 180,
    dataISO: "2026-03-15T16:20:00",
  },
];

// Helpers para gerar datas relativas — assim os prazos aparecem coerentes mesmo
// rodando após a data dos mocks originais.
const _now = () => new Date();
const _addDays = (d: Date, days: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
};
const _addHours = (d: Date, h: number) => {
  const r = new Date(d);
  r.setHours(r.getHours() + h);
  return r;
};
const _ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const _criadoBase1 = _addDays(_now(), -1);
const _criadoBase2 = _addDays(_now(), -2);
const _criadoBase3 = _addDays(_now(), -3);
const _criadoBase4 = _addDays(_now(), 0);

const _prazoCliente1 = _addDays(_criadoBase1, 3);
const _prazoCliente2 = _addDays(_criadoBase2, 2);
const _prazoCliente3 = _addHours(_criadoBase3, 24); // express
const _prazoCliente4 = _addDays(_criadoBase4, 3);

export const ADMIN_PEDIDOS: AdminPedidoMock[] = [
  {
    id: "p1",
    numero: 1234,
    cliente: "Marina Costa Almeida",
    tipoServico: "Petição → Cível → Contestação",
    modalidade: "plano_profissional",
    status: "Em análise",
    funcionarioId: "f1",
    funcionario: "Ana Beatriz Souza",
    prazoClienteISO: _prazoCliente1.toISOString(),
    prazoInternoISO: _addDays(_prazoCliente1, -2).toISOString(),
    prazoCliente: _ddmmyyyy(_prazoCliente1),
    valor: 150,
    criadoEm: `${_ddmmyyyy(_criadoBase1)} 09:12`,
    finalizadoEm: null,
    splitPlataforma: 40,
    splitFuncionario: 60,
    areaDireito: "Direito Civil",
    tipoPeticao: "Contestação",
    numeroProcesso: "1003456-78.2025.8.26.0100",
    dataPublicacao: _ddmmyyyy(_addDays(_criadoBase1, -10)),
    competencia: "Justiça Estadual",
    comarca: "São Paulo / SP",
    justicaGratuita: false,
    tutelaUrgencia: false,
    advogadoSubscritor: "Marina Costa Almeida — OAB/SP 234.561",
    resumoCaso:
      "Cliente sofreu cobrança indevida de tarifas bancárias. Necessária contestação para afastar a tese da instituição financeira.",
    detalhes:
      "Abordar prescrição trienal, ônus da prova invertido (CDC), pedido de devolução em dobro.",
    partes: [
      { nome: "João Pereira da Silva", tipo: "Autor" },
      { nome: "Banco XYZ S/A", tipo: "Réu" },
    ],
    comentarios: [
      {
        id: "c1",
        autorNome: "Marina Costa Almeida",
        autorRole: "cliente",
        texto: "Anexei a inicial do banco; favor focar nas teses de prescrição.",
        dataISO: _addDays(_now(), -1).toISOString(),
      },
    ],
    anexos: [
      {
        id: "a1",
        nome: "inicial-banco.pdf",
        tamanho: 412_000,
        enviadoPor: "Marina Costa Almeida",
        dataISO: _addDays(_now(), -1).toISOString(),
      },
    ],
    historico: [
      {
        id: "h1",
        texto: "Pedido criado pelo cliente.",
        dataISO: _criadoBase1.toISOString(),
      },
      {
        id: "h2",
        texto: "Pedido vinculado a Ana Beatriz Souza por Admin Peticiona.",
        dataISO: _addHours(_criadoBase1, 1).toISOString(),
      },
    ],
  },
  {
    id: "p2",
    numero: 1235,
    cliente: "Rafael Mendonça",
    tipoServico: "Petição → Trabalhista → Apelação",
    modalidade: "plano_estrategico",
    status: "Aguardando dados",
    funcionarioId: "f2",
    funcionario: "Carlos Henrique Lima",
    prazoClienteISO: _prazoCliente2.toISOString(),
    prazoInternoISO: _addDays(_prazoCliente2, -2).toISOString(),
    prazoCliente: _ddmmyyyy(_prazoCliente2),
    valor: 140,
    criadoEm: `${_ddmmyyyy(_criadoBase2)} 14:38`,
    finalizadoEm: null,
    splitPlataforma: 40,
    splitFuncionario: 60,
    areaDireito: "Direito Trabalhista",
    tipoPeticao: "Apelação",
    numeroProcesso: "0011234-55.2024.5.02.0001",
    dataPublicacao: _ddmmyyyy(_addDays(_criadoBase2, -8)),
    competencia: "Justiça do Trabalho",
    comarca: "São Paulo / SP",
    justicaGratuita: true,
    tutelaUrgencia: false,
    advogadoSubscritor: "Rafael Mendonça — OAB/RJ 145.882",
    resumoCaso:
      "Reforma da sentença que julgou improcedentes os pedidos de horas extras e adicional de insalubridade.",
    detalhes:
      "Pleitear nulidade do laudo pericial; reanálise das provas testemunhais.",
    partes: [
      { nome: "Marcos Aurélio Lima", tipo: "Recorrente" },
      { nome: "Indústria ABC Ltda.", tipo: "Recorrido" },
    ],
    comentarios: [],
    anexos: [],
    historico: [
      {
        id: "h1",
        texto: "Pedido criado pelo cliente.",
        dataISO: _criadoBase2.toISOString(),
      },
      {
        id: "h2",
        texto: "Pedido vinculado a Carlos Henrique Lima por Admin Peticiona.",
        dataISO: _addHours(_criadoBase2, 2).toISOString(),
      },
      {
        id: "h3",
        texto: "Status alterado para 'Aguardando dados' por Carlos Henrique Lima.",
        dataISO: _addHours(_criadoBase2, 6).toISOString(),
      },
    ],
  },
  {
    id: "p3",
    numero: 1236,
    cliente: "Patrícia Lemos",
    tipoServico: "Petição Express → Cível → Contestação",
    modalidade: "peticao_express",
    status: "Concluído",
    funcionarioId: "f1",
    funcionario: "Ana Beatriz Souza",
    prazoClienteISO: _prazoCliente3.toISOString(),
    prazoInternoISO: _prazoCliente3.toISOString(), // express: igual ao cliente
    prazoCliente: _ddmmyyyy(_prazoCliente3),
    valor: 220,
    criadoEm: `${_ddmmyyyy(_criadoBase3)} 10:00`,
    finalizadoEm: `${_ddmmyyyy(_addDays(_criadoBase3, 1))} 18:32`,
    splitPlataforma: 35,
    splitFuncionario: 65,
    areaDireito: "Direito Civil",
    tipoPeticao: "Contestação",
    numeroProcesso: "1004411-22.2025.8.13.0024",
    dataPublicacao: _ddmmyyyy(_addDays(_criadoBase3, -5)),
    competencia: "Justiça Estadual",
    comarca: "Belo Horizonte / MG",
    justicaGratuita: false,
    tutelaUrgencia: true,
    advogadoSubscritor: "Patrícia Lemos — OAB/MG 098.221",
    resumoCaso:
      "Defesa em ação de cobrança com pedido de tutela de urgência para suspensão de protesto.",
    detalhes: "Demonstrar quitação parcial e abusividade dos encargos.",
    partes: [
      { nome: "Empresa Alpha Ltda.", tipo: "Réu" },
      { nome: "Beta Comércio S/A", tipo: "Autor" },
    ],
    comentarios: [
      {
        id: "c1",
        autorNome: "Ana Beatriz Souza",
        autorRole: "funcionario",
        texto: "Entrega final enviada — confira o documento anexado.",
        dataISO: _addDays(_now(), -2).toISOString(),
      },
    ],
    anexos: [
      {
        id: "a1",
        nome: "contestacao-final.docx",
        tamanho: 188_000,
        enviadoPor: "Ana Beatriz Souza",
        dataISO: _addDays(_now(), -2).toISOString(),
      },
    ],
    historico: [
      {
        id: "h1",
        texto: "Pedido criado pelo cliente (modalidade Express — URGENTE).",
        dataISO: _criadoBase3.toISOString(),
      },
      {
        id: "h2",
        texto: "Pedido vinculado a Ana Beatriz Souza por Admin Peticiona.",
        dataISO: _addHours(_criadoBase3, 1).toISOString(),
      },
      {
        id: "h3",
        texto: "Status alterado para 'Concluído' por Ana Beatriz Souza.",
        dataISO: _addDays(_criadoBase3, 1).toISOString(),
      },
    ],
  },
  {
    id: "p4",
    numero: 1237,
    cliente: "Eduardo Tavares",
    tipoServico: "Recurso Avulso → Apelação",
    modalidade: "recurso_avulso",
    status: "Em análise",
    funcionarioId: null,
    funcionario: null,
    prazoClienteISO: _prazoCliente4.toISOString(),
    prazoInternoISO: _addDays(_prazoCliente4, -2).toISOString(),
    prazoCliente: _ddmmyyyy(_prazoCliente4),
    valor: 200,
    criadoEm: `${_ddmmyyyy(_criadoBase4)} 08:55`,
    finalizadoEm: null,
    splitPlataforma: 100,
    splitFuncionario: 0,
    areaDireito: "Direito Civil",
    tipoPeticao: "Apelação",
    numeroProcesso: "1009988-77.2025.8.21.0010",
    dataPublicacao: _ddmmyyyy(_addDays(_criadoBase4, -7)),
    competencia: "Justiça Estadual",
    comarca: "Porto Alegre / RS",
    justicaGratuita: false,
    tutelaUrgencia: false,
    advogadoSubscritor: "Eduardo Tavares — OAB/RS 412.339",
    resumoCaso:
      "Apelação contra sentença de improcedência em ação de indenização por danos morais.",
    detalhes: "Reforço probatório quanto ao nexo causal e à extensão do dano.",
    partes: [
      { nome: "Eduardo Tavares (cliente)", tipo: "Recorrente" },
      { nome: "Construtora Delta S/A", tipo: "Recorrido" },
    ],
    comentarios: [],
    anexos: [],
    historico: [
      {
        id: "h1",
        texto: "Pedido criado pelo cliente.",
        dataISO: _criadoBase4.toISOString(),
      },
    ],
  },
];
