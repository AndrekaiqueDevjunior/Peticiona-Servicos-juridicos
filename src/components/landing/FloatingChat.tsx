import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const FloatingChat = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    toast({
      title: "Mensagem enviada",
      description: "Em breve nossa equipe entrará em contato.",
    });
    setName("");
    setEmail("");
    setMessage("");
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(360px,calc(100vw-3rem))] animate-fade-up border border-border bg-card shadow-elegant">
          <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
            <div>
              <p className="font-display text-base">Fale conosco</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Resposta rápida</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <Input
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Textarea
              placeholder="Como podemos ajudar?"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary-glow">
              Enviar mensagem <Send className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar chat" : "Abrir chat"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-gold transition-elegant hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
};

export default FloatingChat;
