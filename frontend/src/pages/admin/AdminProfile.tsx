import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  setContactInfo,
  useContactInfo,
  whatsappDisplayToRaw,
} from "@/lib/contactInfo";

export default function AdminProfile() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Dados do perfil
  const [telefone, setTelefone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [cep, setCep] = useState(user?.zip_code || "");
  const [logradouro, setLogradouro] = useState(user?.street || "");
  const [numero, setNumero] = useState(user?.street_number || "");
  const [complemento, setComplemento] = useState(user?.address_complement || "");
  const [bairro, setBairro] = useState(user?.neighborhood || "");
  const [cidade, setCidade] = useState(user?.city || "");
  const [uf, setUf] = useState(user?.state || "");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await api.admin.profile.update({
        phone: telefone.trim() || null,
        email: email.trim() || null,
        zip_code: cep.trim() || null,
        street: logradouro.trim() || null,
        street_number: numero.trim() || null,
        address_complement: complemento.trim() || null,
        neighborhood: bairro.trim() || null,
        city: cidade.trim() || null,
        state: uf.trim().toUpperCase() || null,
      });
      
      toast({ title: "Perfil atualizado com sucesso." });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({ 
        title: "Erro ao atualizar perfil", 
        description: "Tente novamente mais tarde.",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
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
            <ReadonlyInput label="Nome completo" value={user?.full_name || ""} className="sm:col-span-2" />
            <ReadonlyInput label="CPF" value={user?.cpf || ""} />
            <ReadonlyInput label="Cargo" value={user?.role_title || "Administrador da plataforma"} />
            <ReadonlyInput label="OAB" value={user?.oab_number || ""} />
            <ReadonlyInput label="Função" value={user?.role || "admin"} />
            <ReadonlyInput label="ID Usuário" value={user?.id?.toString() || ""} className="sm:col-span-2" />

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
              <Button 
                type="submit" 
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoading}
              >
                {isLoading ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ContactSettingsCard />
    </div>
  );
}

function ContactSettingsCard() {
  const current = useContactInfo();
  const [email, setEmail] = useState(current.email);
  const [whatsapp, setWhatsapp] = useState(current.whatsappDisplay);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedWhats = whatsapp.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    if (trimmedWhats.replace(/\D/g, "").length < 10) {
      toast({ title: "WhatsApp inválido", variant: "destructive" });
      return;
    }
    setContactInfo({
      email: trimmedEmail,
      whatsappDisplay: trimmedWhats,
      whatsappRaw: whatsappDisplayToRaw(trimmedWhats),
    });
    toast({ title: "Contato atualizado em todo o site." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Contato global da plataforma</CardTitle>
        <CardDescription>
          Estes dados aparecem no rodapé do site, no formulário de contato e no modal de Ajuda da área do cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="contato-email">E-mail de contato</Label>
            <Input
              id="contato-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@peticiona.app.br"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="contato-whats">WhatsApp</Label>
            <Input
              id="contato-whats"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 97494-0551"
            />
            <p className="text-xs text-muted-foreground">
              Use formato com DDD. O link do WhatsApp será gerado automaticamente.
            </p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Salvar contato
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
