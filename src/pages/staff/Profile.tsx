import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

// Mock — em produção, viria do backend.
const dadosFixos = {
  nomeCompleto: "Ana Beatriz Souza",
  cpf: "123.456.789-00",
  cargo: "Advogada Sênior",
  matricula: "PT-EQ-0042",
  oab: "SP 345.678",
  dataAdmissao: "12/03/2023",
};

export default function StaffProfile() {
  const [telefone, setTelefone] = useState("(11) 98765-4321");
  const [email, setEmail] = useState("ana.souza@peticiona.app.br");
  const [cep, setCep] = useState("01310-100");
  const [logradouro, setLogradouro] = useState("Av. Paulista");
  const [numero, setNumero] = useState("1000");
  const [complemento, setComplemento] = useState("Sala 1201");
  const [bairro, setBairro] = useState("Bela Vista");
  const [cidade, setCidade] = useState("São Paulo");
  const [uf, setUf] = useState("SP");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Dados atualizados com sucesso." });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meu perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode editar telefone, e-mail e endereço. Demais dados são somente leitura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <ReadonlyInput label="Nome completo" value={dadosFixos.nomeCompleto} className="sm:col-span-2" />
            <ReadonlyInput label="CPF" value={dadosFixos.cpf} />
            <ReadonlyInput label="Matrícula" value={dadosFixos.matricula} />
            <ReadonlyInput label="Cargo" value={dadosFixos.cargo} />
            <ReadonlyInput label="OAB" value={dadosFixos.oab} />
            <ReadonlyInput label="Data de admissão" value={dadosFixos.dataAdmissao} className="sm:col-span-2" />

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>

            <div className="sm:col-span-2 mt-2">
              <h3 className="text-sm font-semibold text-foreground">Endereço</h3>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input id="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uf">UF</Label>
              <Input id="uf" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadonlyInput({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value} disabled />
    </div>
  );
}
