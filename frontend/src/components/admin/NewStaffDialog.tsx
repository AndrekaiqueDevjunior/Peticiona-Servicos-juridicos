import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { maskPhone } from "@/lib/masks";
import { api } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function NewStaffDialog({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const reset = () => {
    setNome("");
    setEmail("");
    setTelefone("");
    setSenha("");
    setErro(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.admin.staff.create({
        full_name: nome.trim(),
        email: email.trim().toLowerCase(),
        phone: telefone.trim() || null,
        password: senha,
      }),
    onSuccess: ({ staff_member }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      onCreated?.();
      toast({
        title: "Funcionario cadastrado",
        description: `${staff_member.nome} ja pode acessar a plataforma com o e-mail informado.`,
      });
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      setErro(err instanceof Error ? err.message : "Nao foi possivel cadastrar funcionario.");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErro(null);

    if (!nome.trim() || !email.trim() || !telefone.trim() || !senha.trim()) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErro("Informe um e-mail valido.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha deve ter ao menos 8 caracteres.");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Novo funcionario</DialogTitle>
          <DialogDescription>
            Cadastre um novo membro da equipe interna da plataforma.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-nome">Nome completo</Label>
            <Input
              id="staff-nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: Maria Oliveira"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-email">E-mail</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@peticiona.com.br"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff-tel">Telefone</Label>
              <Input
                id="staff-tel"
                value={telefone}
                onChange={(event) => setTelefone(maskPhone(event.target.value))}
                placeholder="(11) 90000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-senha">Senha provisoria</Label>
              <Input
                id="staff-senha"
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Minimo 8 caracteres"
              />
            </div>
          </div>

          {erro && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {mutation.isPending ? "Cadastrando..." : "Cadastrar funcionario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
