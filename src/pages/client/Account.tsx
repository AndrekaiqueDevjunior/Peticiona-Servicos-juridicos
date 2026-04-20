import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Account = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie suas informações pessoais e preferências.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" defaultValue="João da Silva" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" defaultValue="joao@exemplo.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input id="phone" defaultValue="(11) 99999-9999" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doc">CPF / CNPJ</Label>
              <Input id="doc" defaultValue="000.000.000-00" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oab">OAB (opcional)</Label>
              <Input id="oab" placeholder="UF 000000" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Segurança</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Senha</p>
            <p className="text-sm text-muted-foreground">
              Última alteração há 30 dias.
            </p>
          </div>
          <Button variant="outline">Alterar senha</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;
