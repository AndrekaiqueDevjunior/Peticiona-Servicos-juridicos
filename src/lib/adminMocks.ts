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

export interface AdminPedidoMock {
  id: string;
  numero: number;
  cliente: string;
  tipoServico: string;
  status: "Em análise" | "Aguardando dados" | "Concluído";
  funcionario: string | null;
  prazoCliente: string; // dd/MM/yyyy
  valor: number;
  criadoEm: string;
  finalizadoEm: string | null;
  splitPlataforma: number; // %
  splitFuncionario: number; // %
}

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
    email: "ana.souza@peticiona.app.br",
    telefone: "(11) 98765-4321",
    pedidosAtivos: 4,
    pedidosConcluidos: 23,
    ativo: true,
  },
  {
    id: "f2",
    nome: "Carlos Henrique Lima",
    email: "carlos.lima@peticiona.app.br",
    telefone: "(11) 91234-9988",
    pedidosAtivos: 2,
    pedidosConcluidos: 18,
    ativo: true,
  },
  {
    id: "f3",
    nome: "Juliana Ribeiro",
    email: "juliana.r@peticiona.app.br",
    telefone: "(11) 99887-1234",
    pedidosAtivos: 0,
    pedidosConcluidos: 7,
    ativo: false,
  },
];

export const ADMIN_PEDIDOS: AdminPedidoMock[] = [
  {
    id: "p1",
    numero: 1234,
    cliente: "Marina Costa Almeida",
    tipoServico: "Petição → Cível → Contestação",
    status: "Em análise",
    funcionario: "Ana Beatriz Souza",
    prazoCliente: "25/04/2026",
    valor: 160,
    criadoEm: "20/04/2026 09:12",
    finalizadoEm: null,
    splitPlataforma: 40,
    splitFuncionario: 60,
  },
  {
    id: "p2",
    numero: 1235,
    cliente: "Rafael Mendonça",
    tipoServico: "Petição → Trabalhista → Apelação",
    status: "Aguardando dados",
    funcionario: "Carlos Henrique Lima",
    prazoCliente: "24/04/2026",
    valor: 150,
    criadoEm: "20/04/2026 14:38",
    finalizadoEm: null,
    splitPlataforma: 40,
    splitFuncionario: 60,
  },
  {
    id: "p3",
    numero: 1236,
    cliente: "Patrícia Lemos",
    tipoServico: "Petição Express → Cível → Contestação",
    status: "Concluído",
    funcionario: "Ana Beatriz Souza",
    prazoCliente: "21/04/2026",
    valor: 230,
    criadoEm: "19/04/2026 10:00",
    finalizadoEm: "20/04/2026 18:32",
    splitPlataforma: 35,
    splitFuncionario: 65,
  },
  {
    id: "p4",
    numero: 1237,
    cliente: "Eduardo Tavares",
    tipoServico: "Recurso Avulso → Apelação",
    status: "Em análise",
    funcionario: null,
    prazoCliente: "27/04/2026",
    valor: 200,
    criadoEm: "21/04/2026 08:55",
    finalizadoEm: null,
    splitPlataforma: 100,
    splitFuncionario: 0,
  },
];
